"""
cleaREDiq Email Service
Uses Resend — free tier covers 3,000 emails/mo
Sign up at resend.com, get API key, add to .env as RESEND_API_KEY
"""
import httpx
import structlog

log = structlog.get_logger()

RESEND_API = "https://api.resend.com/emails"
FROM_EMAIL = "cleaREDiq <hello@clearediq.com>"

NAVY = "#1a1f3a"
RED  = "#E02020"

def _base_template(title: str, body: str) -> str:
    return f"""
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:{NAVY};padding:24px 32px;">
        <span style="font-size:22px;font-weight:700;color:#fff;">clea<span style="color:{RED};">RED</span>iq</span>
        <span style="font-size:11px;color:#6b7280;margin-left:8px;">AI Fraud Detection</span>
      </div>
      <div style="padding:32px;">
        <h2 style="color:{NAVY};margin-top:0;">{title}</h2>
        {body}
        <hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0;">
        <p style="font-size:11px;color:#9ca3af;">cleaREDiq · clearediq.com · hello@clearediq.com</p>
      </div>
    </div>"""


async def send_email(to: str, subject: str, html: str, api_key: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                RESEND_API,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"from": FROM_EMAIL, "to": [to], "subject": subject, "html": html}
            )
        return r.status_code == 200
    except Exception as e:
        log.error("Email send failed", error=str(e))
        return False


async def send_welcome_email(to: str, name: str, company: str, api_key: str):
    html = _base_template(
        f"Welcome to cleaREDiq, {name}!",
        f"""
        <p>Your account for <strong>{company}</strong> is ready.</p>
        <p>Start by uploading your first receipt — cleaREDiq will analyze it in seconds and show you exactly what it finds.</p>
        <a href="https://clearediq.com/dashboard/upload"
           style="display:inline-block;background:{RED};color:#fff;padding:12px 24px;
                  border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
          Upload your first receipt
        </a>
        <p style="color:#6b7280;font-size:13px;">Your 14-day free trial is active. No credit card needed until you're ready.</p>
        """
    )
    await send_email(to, "Welcome to cleaREDiq — your fraud protection is active", html, api_key)


async def send_fraud_alert(
    to: str, reviewer_name: str,
    merchant: str, amount: float, score: int,
    receipt_id: str, flags: list,
    api_key: str
):
    flag_items = "".join([
        f'<li style="margin-bottom:6px;color:#374151;">{f.get("title","Flag")}</li>'
        for f in flags[:5]
    ])
    color = RED if score >= 75 else "#f97316" if score >= 55 else "#ca8a04"
    risk  = "CRITICAL" if score >= 75 else "HIGH" if score >= 55 else "MEDIUM"

    html = _base_template(
        f"⚠️ {risk} risk receipt flagged — {merchant}",
        f"""
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:20px;">
          <div style="font-size:32px;font-weight:700;color:{color};">{score}<span style="font-size:14px;color:#9ca3af;">/100</span></div>
          <div style="font-size:13px;color:{color};font-weight:600;">{risk} FRAUD RISK</div>
        </div>
        <p><strong>{merchant}</strong> · ${amount:.2f}</p>
        <p style="color:#6b7280;font-size:13px;">Flags detected:</p>
        <ul>{flag_items}</ul>
        <a href="https://clearediq.com/dashboard/receipts/{receipt_id}"
           style="display:inline-block;background:{RED};color:#fff;padding:12px 24px;
                  border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
          Review this receipt
        </a>
        <p style="font-size:12px;color:#9ca3af;">You are receiving this because you are a reviewer on this account.</p>
        """
    )
    await send_email(
        to,
        f"🚩 A {risk.lower()} risk receipt needs your review — {merchant} ${amount:.2f}",
        html, api_key
    )


async def send_receipt_approved(to: str, merchant: str, amount: float, api_key: str):
    html = _base_template(
        "Your receipt was approved ✓",
        f"""
        <p>Your receipt from <strong>{merchant}</strong> for <strong>${amount:.2f}</strong>
        has been reviewed and approved.</p>
        <p style="color:#16a34a;font-weight:600;">✓ Approved for reimbursement</p>
        """
    )
    await send_email(to, f"Receipt approved — {merchant} ${amount:.2f}", html, api_key)


async def send_receipt_rejected(
    to: str, merchant: str, amount: float,
    reason: str, api_key: str
):
    html = _base_template(
        "Your receipt requires attention",
        f"""
        <p>Your receipt from <strong>{merchant}</strong> for <strong>${amount:.2f}</strong>
        could not be approved at this time.</p>
        <div style="background:#fef2f2;border-left:4px solid {RED};padding:12px 16px;margin:16px 0;">
          <p style="margin:0;color:#991b1b;">{reason or "Please contact your manager for details."}</p>
        </div>
        <p style="color:#6b7280;font-size:13px;">
          If you believe this is an error, please contact your finance team with the original receipt.
        </p>
        """
    )
    await send_email(to, f"Receipt needs review — {merchant} ${amount:.2f}", html, api_key)


async def send_payment_failed(to: str, name: str, api_key: str):
    html = _base_template(
        "Action needed — payment failed",
        f"""
        <p>Hi {name}, we were unable to process your cleaREDiq subscription payment.</p>
        <p>Your fraud protection is still active for now, but please update your payment method
        to avoid any interruption.</p>
        <a href="https://clearediq.com/dashboard/settings"
           style="display:inline-block;background:{RED};color:#fff;padding:12px 24px;
                  border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
          Update payment method
        </a>
        """
    )
    await send_email(to, "Action required — cleaREDiq payment failed", html, api_key)
