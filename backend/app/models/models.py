import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime,
    ForeignKey, Text, JSON, Enum as SAEnum, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


def gen_uuid():
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
    owner = "owner"
    admin = "admin"
    reviewer = "reviewer"
    viewer = "viewer"


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ReceiptStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    reviewed = "reviewed"
    approved = "approved"
    rejected = "rejected"
    escalated = "escalated"


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    plan = Column(String(50), default="starter")
    receipts_limit = Column(Integer, default=500)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    users = relationship("User", back_populates="organization")
    receipts = relationship("Receipt", back_populates="organization")
    merchant_templates = relationship("MerchantTemplate", back_populates="organization")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=False), ForeignKey("organizations.id"), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    role = Column(SAEnum(UserRole), default=UserRole.reviewer)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)

    organization = relationship("Organization", back_populates="users")
    receipts = relationship("Receipt", foreign_keys="Receipt.submitted_by_id", back_populates="submitted_by")
    audit_events = relationship("AuditEvent", back_populates="user")


class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=False), ForeignKey("organizations.id"), nullable=False)
    submitted_by_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    reviewed_by_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)

    # File info
    original_filename = Column(String(500))
    file_hash = Column(String(64), index=True)
    file_size_bytes = Column(Integer)
    mime_type = Column(String(100))
    storage_key = Column(String(500))
    storage_url = Column(Text)

    # Status
    status = Column(SAEnum(ReceiptStatus), default=ReceiptStatus.pending)
    risk_level = Column(SAEnum(RiskLevel))
    risk_score = Column(Integer)

    # EXIF / metadata
    exif_data = Column(JSON)
    upload_ip = Column(String(45))

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime)
    reviewed_at = Column(DateTime)

    # Notes
    reviewer_notes = Column(Text)

    organization = relationship("Organization", back_populates="receipts")
    submitted_by = relationship("User", foreign_keys=[submitted_by_id], back_populates="receipts")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    ocr_result = relationship("OCRResult", back_populates="receipt", uselist=False)
    fraud_score = relationship("FraudScore", back_populates="receipt", uselist=False)
    fraud_flags = relationship("FraudFlag", back_populates="receipt")
    upload_log = relationship("UploadLog", back_populates="receipt", uselist=False)
    audit_events = relationship("AuditEvent", back_populates="receipt")

    __table_args__ = (
        Index("ix_receipts_org_status", "organization_id", "status"),
        Index("ix_receipts_org_risk", "organization_id", "risk_level"),
    )


class OCRResult(Base):
    __tablename__ = "ocr_results"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    receipt_id = Column(UUID(as_uuid=False), ForeignKey("receipts.id"), unique=True, nullable=False)

    provider = Column(String(50))  # google_vision | aws_textract
    confidence_score = Column(Float)

    # Extracted fields
    merchant_name = Column(String(500))
    merchant_address = Column(Text)
    merchant_phone = Column(String(50))
    transaction_date = Column(String(50))
    transaction_time = Column(String(50))
    transaction_id = Column(String(200))

    subtotal = Column(Float)
    tax_amount = Column(Float)
    tax_rate = Column(Float)
    tip_amount = Column(Float)
    total_amount = Column(Float)

    payment_method = Column(String(100))
    card_last_four = Column(String(4))

    line_items = Column(JSON)  # [{description, quantity, unit_price, total}]
    raw_text = Column(Text)
    field_confidences = Column(JSON)  # per-field confidence scores

    created_at = Column(DateTime, default=datetime.utcnow)

    receipt = relationship("Receipt", back_populates="ocr_result")


class FraudScore(Base):
    __tablename__ = "fraud_scores"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    receipt_id = Column(UUID(as_uuid=False), ForeignKey("receipts.id"), unique=True, nullable=False)

    overall_score = Column(Integer)  # 0–100
    risk_level = Column(SAEnum(RiskLevel))

    # Component scores
    math_validation_score = Column(Integer)
    tax_validation_score = Column(Integer)
    timestamp_score = Column(Integer)
    duplicate_score = Column(Integer)
    merchant_score = Column(Integer)
    image_forensics_score = Column(Integer)
    metadata_score = Column(Integer)

    score_breakdown = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    receipt = relationship("Receipt", back_populates="fraud_score")


class FraudFlag(Base):
    __tablename__ = "fraud_flags"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    receipt_id = Column(UUID(as_uuid=False), ForeignKey("receipts.id"), nullable=False)

    flag_type = Column(String(100))
    severity = Column(String(20))  # low | medium | high | critical
    title = Column(String(500))
    description = Column(Text)
    evidence = Column(JSON)
    weight = Column(Float)

    created_at = Column(DateTime, default=datetime.utcnow)

    receipt = relationship("Receipt", back_populates="fraud_flags")


class MerchantTemplate(Base):
    __tablename__ = "merchant_templates"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=False), ForeignKey("organizations.id"), nullable=True)

    merchant_name = Column(String(500), nullable=False, index=True)
    merchant_domain = Column(String(255))
    expected_tax_rates = Column(JSON)  # {state: rate}
    receipt_layout_signature = Column(JSON)
    known_fonts = Column(JSON)
    sample_count = Column(Integer, default=0)
    is_global = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization", back_populates="merchant_templates")


class UploadLog(Base):
    __tablename__ = "upload_logs"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    receipt_id = Column(UUID(as_uuid=False), ForeignKey("receipts.id"), unique=True, nullable=False)

    upload_method = Column(String(50))  # web | api | email | mobile
    ip_address = Column(String(45))
    user_agent = Column(Text)
    processing_time_ms = Column(Integer)
    error_message = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)

    receipt = relationship("Receipt", back_populates="upload_log")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=False), ForeignKey("organizations.id"), nullable=False)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    receipt_id = Column(UUID(as_uuid=False), ForeignKey("receipts.id"), nullable=True)

    event_type = Column(String(100))
    event_data = Column(JSON)
    ip_address = Column(String(45))

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_events")
    receipt = relationship("Receipt", back_populates="audit_events")
