from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.models import Receipt, FraudScore
from app.schemas.schemas import DashboardStats, AnalyticsPoint

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    org_id = current_user.organization_id
    week_ago = datetime.utcnow() - timedelta(days=7)

    total = db.query(func.count(Receipt.id)).filter(
        Receipt.organization_id == org_id
    ).scalar() or 0

    high_risk = db.query(func.count(Receipt.id)).filter(
        Receipt.organization_id == org_id,
        Receipt.risk_level.in_(["HIGH", "CRITICAL"]),
    ).scalar() or 0

    pending = db.query(func.count(Receipt.id)).filter(
        Receipt.organization_id == org_id,
        Receipt.status == "pending",
    ).scalar() or 0

    approved = db.query(func.count(Receipt.id)).filter(
        Receipt.organization_id == org_id,
        Receipt.status == "approved",
    ).scalar() or 0

    this_week = db.query(func.count(Receipt.id)).filter(
        Receipt.organization_id == org_id,
        Receipt.created_at >= week_ago,
    ).scalar() or 0

    avg_score = db.query(func.avg(FraudScore.overall_score)).join(Receipt).filter(
        Receipt.organization_id == org_id
    ).scalar() or 0

    return DashboardStats(
        total_receipts=total,
        high_risk_count=high_risk,
        pending_review_count=pending,
        auto_approved_count=approved,
        flag_rate=round(high_risk / total * 100, 1) if total > 0 else 0,
        avg_risk_score=round(float(avg_score), 1),
        receipts_this_week=this_week,
    )


@router.get("/analytics", response_model=list[AnalyticsPoint])
def get_analytics(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    org_id = current_user.organization_id
    since = datetime.utcnow() - timedelta(days=days)

    rows = db.query(
        func.date(Receipt.created_at).label("date"),
        func.count(Receipt.id).label("total"),
        func.count(Receipt.id).filter(
            Receipt.risk_level.in_(["HIGH", "CRITICAL"])
        ).label("flagged"),
        func.count(Receipt.id).filter(
            Receipt.status == "approved"
        ).label("approved"),
    ).filter(
        Receipt.organization_id == org_id,
        Receipt.created_at >= since,
    ).group_by(
        func.date(Receipt.created_at)
    ).order_by(
        func.date(Receipt.created_at)
    ).all()

    return [
        AnalyticsPoint(
            date=str(r.date),
            total=r.total,
            flagged=r.flagged,
            approved=r.approved,
        )
        for r in rows
    ]
