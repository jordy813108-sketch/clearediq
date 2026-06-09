import hashlib
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.models import Receipt, OCRResult, FraudScore, FraudFlag, UploadLog, AuditEvent
from app.schemas.schemas import ReceiptOut, ReceiptListItem, ReceiptReviewRequest
from app.services.storage_service import storage_service
from app.services.ocr_service import ocr_service
from app.services.fraud_engine import fraud_engine
import structlog

log = structlog.get_logger()
router = APIRouter(prefix="/receipts", tags=["receipts"])

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/heic", "image/heif",
    "application/pdf", "image/webp",
}
MAX_SIZE_MB = 20


@router.post("/upload", response_model=ReceiptOut, status_code=201)
async def upload_receipt(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Validate
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"File type {file.content_type} not supported")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File exceeds {MAX_SIZE_MB}MB limit")

    file_hash = hashlib.sha256(file_bytes).hexdigest()

    # Duplicate check
    existing = db.query(Receipt).filter(
        Receipt.organization_id == current_user.organization_id,
        Receipt.file_hash == file_hash,
    ).first()
    if existing:
        raise HTTPException(409, f"Duplicate receipt — already uploaded (id: {existing.id})")

    # Upload to storage
    storage_meta = await storage_service.upload(
        file_bytes, file.filename or "receipt",
        current_user.organization_id, file.content_type,
    )

    # Create receipt record
    receipt = Receipt(
        organization_id=current_user.organization_id,
        submitted_by_id=current_user.id,
        original_filename=file.filename,
        file_hash=file_hash,
        file_size_bytes=storage_meta["file_size_bytes"],
        mime_type=file.content_type,
        storage_key=storage_meta["storage_key"],
        storage_url=storage_meta["storage_url"],
        status="processing",
    )
    db.add(receipt)
    db.flush()

    upload_log = UploadLog(
        receipt_id=receipt.id,
        upload_method="web",
    )
    db.add(upload_log)
    db.commit()
    db.refresh(receipt)

    # Process synchronously (move to Celery worker in production)
    background_tasks.add_task(
        _process_receipt, receipt.id, file_bytes, file.content_type
    )

    return receipt


async def _process_receipt(receipt_id: str, file_bytes: bytes, mime_type: str):
    """Background task: run OCR + fraud analysis."""
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
        if not receipt:
            return

        start = datetime.utcnow()

        # OCR
        ocr_data = await ocr_service.extract(file_bytes, mime_type)

        ocr_result = OCRResult(
            receipt_id=receipt.id,
            provider=ocr_data.get("provider"),
            confidence_score=ocr_data.get("confidence_score"),
            merchant_name=ocr_data.get("merchant_name"),
            merchant_address=ocr_data.get("merchant_address"),
            transaction_date=ocr_data.get("transaction_date"),
            transaction_time=ocr_data.get("transaction_time"),
            transaction_id=ocr_data.get("transaction_id"),
            subtotal=ocr_data.get("subtotal"),
            tax_amount=ocr_data.get("tax_amount"),
            tax_rate=ocr_data.get("tax_rate"),
            tip_amount=ocr_data.get("tip_amount"),
            total_amount=ocr_data.get("total_amount"),
            payment_method=ocr_data.get("payment_method"),
            card_last_four=ocr_data.get("card_last_four"),
            line_items=ocr_data.get("line_items", []),
            raw_text=ocr_data.get("raw_text"),
        )
        db.add(ocr_result)

        # Fraud analysis
        result = fraud_engine.analyze(ocr_data, receipt.file_hash or "", file_bytes)

        fraud_score = FraudScore(
            receipt_id=receipt.id,
            overall_score=result["overall_score"],
            risk_level=result["risk_level"],
            math_validation_score=result.get("math_validation_score"),
            tax_validation_score=result.get("tax_validation_score"),
            timestamp_score=result.get("timestamp_score"),
            duplicate_score=result.get("duplicate_score"),
            merchant_score=result.get("merchant_score"),
            image_forensics_score=result.get("image_forensics_score"),
            metadata_score=result.get("metadata_score"),
            score_breakdown=result.get("score_breakdown"),
        )
        db.add(fraud_score)

        for flag in result["flags"]:
            db.add(FraudFlag(
                receipt_id=receipt.id,
                flag_type=flag["flag_type"],
                severity=flag["severity"],
                title=flag["title"],
                description=flag.get("description"),
                weight=flag.get("weight"),
            ))

        receipt.risk_score = result["overall_score"]
        receipt.risk_level = result["risk_level"]
        receipt.status = "reviewed" if result["overall_score"] < 30 else "pending"
        if result["overall_score"] < 30:
            receipt.status = "approved"
        receipt.processed_at = datetime.utcnow()

        ms = int((datetime.utcnow() - start).total_seconds() * 1000)
        if receipt.upload_log:
            receipt.upload_log.processing_time_ms = ms

        db.commit()
        log.info("Receipt processed", receipt_id=receipt_id, score=result["overall_score"])

    except Exception as e:
        log.error("Receipt processing failed", receipt_id=receipt_id, error=str(e))
        db.rollback()
        try:
            receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
            if receipt:
                receipt.status = "pending"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.get("", response_model=list[ReceiptListItem])
def list_receipts(
    status: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(Receipt).filter(
        Receipt.organization_id == current_user.organization_id
    ).options(
        joinedload(Receipt.submitted_by),
        joinedload(Receipt.ocr_result),
    )
    if status:
        q = q.filter(Receipt.status == status)
    if risk_level:
        q = q.filter(Receipt.risk_level == risk_level)

    receipts = q.order_by(Receipt.created_at.desc()).offset(offset).limit(limit).all()

    # Attach merchant name and total from OCR
    items = []
    for r in receipts:
        item = ReceiptListItem.model_validate(r)
        if r.ocr_result:
            item.merchant_name = r.ocr_result.merchant_name
            item.total_amount = r.ocr_result.total_amount
        items.append(item)
    return items


@router.get("/{receipt_id}", response_model=ReceiptOut)
def get_receipt(
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    receipt = db.query(Receipt).filter(
        Receipt.id == receipt_id,
        Receipt.organization_id == current_user.organization_id,
    ).options(
        joinedload(Receipt.ocr_result),
        joinedload(Receipt.fraud_score),
        joinedload(Receipt.fraud_flags),
        joinedload(Receipt.submitted_by),
    ).first()
    if not receipt:
        raise HTTPException(404, "Receipt not found")
    return receipt


@router.post("/{receipt_id}/review", response_model=ReceiptOut)
def review_receipt(
    receipt_id: str,
    payload: ReceiptReviewRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    receipt = db.query(Receipt).filter(
        Receipt.id == receipt_id,
        Receipt.organization_id == current_user.organization_id,
    ).first()
    if not receipt:
        raise HTTPException(404, "Receipt not found")

    action_map = {
        "approve": "approved",
        "reject": "rejected",
        "escalate": "escalated",
    }
    if payload.action not in action_map:
        raise HTTPException(400, "Action must be approve, reject, or escalate")

    receipt.status = action_map[payload.action]
    receipt.reviewed_by_id = current_user.id
    receipt.reviewed_at = datetime.utcnow()
    receipt.reviewer_notes = payload.notes

    db.add(AuditEvent(
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        receipt_id=receipt.id,
        event_type=f"receipt_{payload.action}",
        event_data={"notes": payload.notes},
    ))
    db.commit()
    db.refresh(receipt)
    return receipt
