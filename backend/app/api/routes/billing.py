"""
cleaREDiq Stripe Billing
Handles subscription creation, webhooks, and billing portal
"""
import stripe
import structlog
from fastapi import APIRouter, Request, HTTPException, Header
from app.core.config import settings
from app.core.database import get_db
from app.models.models import Organization
from sqlalchemy.orm import Session
from fastapi import Depends

log = structlog.get_logger()
router = APIRouter(prefix="/billing", tags=["billing"])

# Price IDs — create these in your Stripe dashboard
PRICE_IDS = {
    "starter":  "price_starter_monthly",   # $49/mo — replace with real Stripe price ID
    "business": "price_business_monthly",  # $99/mo — replace with real Stripe price ID
    "enterprise": None,                    # Custom — contact sales
}

def get_stripe():
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


@router.post("/create-checkout")
async def create_checkout_session(
    plan: str,
    org_id: str,
    db: Session = Depends(get_db),
):
    """Create a Stripe checkout session for a subscription."""
    if plan not in PRICE_IDS or not PRICE_IDS[plan]:
        raise HTTPException(400, "Invalid plan")

    s = get_stripe()
    price_id = PRICE_IDS[plan]

    try:
        session = s.checkout.Session.create(
            payment_method_types=["card"],
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{settings.FRONTEND_URL}/dashboard?payment=success",
            cancel_url=f"{settings.FRONTEND_URL}/pricing?payment=cancelled",
            metadata={"org_id": org_id, "plan": plan},
            allow_promotion_codes=True,
            billing_address_collection="required",
        )
        return {"checkout_url": session.url, "session_id": session.id}

    except stripe.error.StripeError as e:
        log.error("Stripe checkout error", error=str(e))
        raise HTTPException(500, "Payment setup failed")


@router.post("/portal")
async def create_billing_portal(org_id: str, db: Session = Depends(get_db)):
    """Create a Stripe billing portal session for managing subscriptions."""
    s = get_stripe()

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org or not org.stripe_customer_id:
        raise HTTPException(404, "No billing account found")

    try:
        session = s.billing_portal.Session.create(
            customer=org.stripe_customer_id,
            return_url=f"{settings.FRONTEND_URL}/dashboard/settings",
        )
        return {"portal_url": session.url}
    except stripe.error.StripeError as e:
        log.error("Stripe portal error", error=str(e))
        raise HTTPException(500, "Billing portal failed")


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None),
):
    """Handle Stripe webhook events."""
    s = get_stripe()
    payload = await request.body()

    try:
        event = s.Webhook.construct_event(
            payload, stripe_signature, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception as e:
        log.error("Webhook signature failed", error=str(e))
        raise HTTPException(400, "Invalid webhook")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        org_id  = data["metadata"].get("org_id")
        plan    = data["metadata"].get("plan")
        cust_id = data.get("customer")
        sub_id  = data.get("subscription")
        log.info("Subscription created", org_id=org_id, plan=plan)
        # TODO: Update org.plan, org.stripe_customer_id, org.stripe_subscription_id in DB

    elif event_type == "customer.subscription.deleted":
        log.info("Subscription cancelled", customer=data.get("customer"))
        # TODO: Downgrade org to free tier

    elif event_type == "invoice.payment_failed":
        log.warning("Payment failed", customer=data.get("customer"))
        # TODO: Send payment failed email

    return {"status": "ok"}
