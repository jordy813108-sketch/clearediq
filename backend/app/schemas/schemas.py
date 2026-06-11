from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ReceiptStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    reviewed = "reviewed"
    approved = "approved"
    rejected = "rejected"
    escalated = "escalated"


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    organization_name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    role: str
    organization_id: str

    class Config:
        from_attributes = True


# ── Organization ──────────────────────────────────────────────────────────────

class OrganizationOut(BaseModel):
    id: str
    name: str
    slug: str
    plan: str
    receipts_limit: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Receipt ───────────────────────────────────────────────────────────────────

class ReceiptOut(BaseModel):
    id: str
    original_filename: Optional[str]
    file_hash: Optional[str]
    file_size_bytes: Optional[int]
    mime_type: Optional[str]
    storage_url: Optional[str]
    # Short-lived presigned URL for displaying the receipt image; generated
    # per-request in the detail endpoint (never persisted).
    image_url: Optional[str] = None
    status: str
    risk_level: Optional[str]
    risk_score: Optional[int]
    created_at: datetime
    processed_at: Optional[datetime]
    submitted_by: Optional[UserOut]
    ocr_result: Optional["OCRResultOut"]
    fraud_score: Optional["FraudScoreOut"]
    fraud_flags: List["FraudFlagOut"] = []

    class Config:
        from_attributes = True


class ReceiptListItem(BaseModel):
    id: str
    original_filename: Optional[str]
    status: str
    risk_level: Optional[str]
    risk_score: Optional[int]
    created_at: datetime
    submitted_by: Optional[UserOut]
    merchant_name: Optional[str] = None
    total_amount: Optional[float] = None

    class Config:
        from_attributes = True


class ReceiptReviewRequest(BaseModel):
    action: str  # approve | reject | escalate
    notes: Optional[str]


# ── OCR ───────────────────────────────────────────────────────────────────────

class LineItem(BaseModel):
    description: str
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    total: Optional[float] = None


class OCRResultOut(BaseModel):
    id: str
    provider: Optional[str]
    confidence_score: Optional[float]
    merchant_name: Optional[str]
    merchant_address: Optional[str]
    transaction_date: Optional[str]
    transaction_time: Optional[str]
    transaction_id: Optional[str]
    subtotal: Optional[float]
    tax_amount: Optional[float]
    tax_rate: Optional[float]
    tip_amount: Optional[float]
    total_amount: Optional[float]
    payment_method: Optional[str]
    card_last_four: Optional[str]
    line_items: Optional[List[LineItem]]
    field_confidences: Optional[Any]

    class Config:
        from_attributes = True


# ── Fraud ──────────────────────────────────────────────────────────────────────

class FraudFlagOut(BaseModel):
    id: str
    flag_type: str
    severity: str
    title: str
    description: Optional[str]
    evidence: Optional[Any]
    weight: Optional[float]

    class Config:
        from_attributes = True


class FraudScoreOut(BaseModel):
    id: str
    overall_score: int
    risk_level: str
    math_validation_score: Optional[int]
    tax_validation_score: Optional[int]
    timestamp_score: Optional[int]
    duplicate_score: Optional[int]
    merchant_score: Optional[int]
    image_forensics_score: Optional[int]
    metadata_score: Optional[int]
    score_breakdown: Optional[Any]

    class Config:
        from_attributes = True


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_receipts: int
    high_risk_count: int
    pending_review_count: int
    auto_approved_count: int
    flag_rate: float
    avg_risk_score: float
    receipts_this_week: int


class AnalyticsPoint(BaseModel):
    date: str
    total: int
    flagged: int
    approved: int


# Update forward refs
TokenResponse.model_rebuild()
ReceiptOut.model_rebuild()
