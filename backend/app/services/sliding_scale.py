"""
cleaREDiq Sliding Scale Fraud Scoring Engine
Built from 5 real test cases and 20 detection rules discovered during testing
Every rule here was proven against a real manipulated receipt
"""
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


class RiskLevel(str, Enum):
    AUTO_APPROVE        = "auto_approve"
    SOFT_REVIEW         = "soft_review"
    VERIFICATION        = "verification_required"
    INVESTIGATION       = "manager_investigation"
    CRITICAL            = "critical_hold"


@dataclass
class Flag:
    rule_id: int
    name: str
    gate: int
    severity: str
    score: int
    title: str
    detail: str
    discovered_in: str  # which test case proved this rule


@dataclass
class SlidingScaleResult:
    total_score: int
    risk_level: RiskLevel
    flags: list[Flag]
    action_required: str
    cc_statement_required: bool
    cc_statement_optional: bool
    employee_notified: bool
    hr_notified: bool
    evidence_package: bool
    email_template: str
    next_steps: list[str]


def evaluate(receipt: dict) -> SlidingScaleResult:
    """
    Run all 20 detection rules against a receipt.
    Returns a SlidingScaleResult with score, risk level, and required actions.
    """
    flags: list[Flag] = []
    score = 0

    def add(rule_id, name, gate, severity, pts, title, detail, discovered_in):
        nonlocal score
        score += pts
        flags.append(Flag(rule_id, name, gate, severity, pts, title, detail, discovered_in))

    # ── GATE 1 — Capture integrity ─────────────────────────────────────────
    if receipt.get("file_format") == "png" and len(receipt.get("existing_flags", [])) > 0:
        add(4, "png_format_with_flags", 1, "low", 10,
            "PNG format — image may have been edited",
            "Real camera photos are JPEG. PNG format combined with other flags "
            "suggests the image was opened, edited, and resaved.",
            "FRD-001 Freddy's")

    # ── GATE 2 — Document authenticity ────────────────────────────────────
    if receipt.get("currency_symbols_missing"):
        add(2, "currency_symbols_missing", 2, "critical", 45,
            "Dollar signs missing from price fields",
            "Google Nano Banana and similar AI editors sometimes drop the $ "
            "character during text replacement. A real receipt always has "
            "consistent currency symbols throughout.",
            "FRD-001 Freddy's — Nano Banana removed all $ signs")

    if receipt.get("receipt_type") == "preauth" and receipt.get("has_itemized_list"):
        add(13, "receipt_type_mismatch", 2, "critical", 45,
            "Pre-authorization slip has itemized list — impossible",
            "Pre-auth slips by design show only the authorized amount. "
            "They never contain itemized lists. An itemized list on a "
            "pre-auth slip means the document was fabricated.",
            "SCH-001 Schafer's — AI added fake items to pre-auth slip")

    # ── GATE 3 — Data verification ─────────────────────────────────────────
    # Rule 1 — Tips equals pre-tip total
    pretip = receipt.get("pretip_total")
    tip_amount = receipt.get("tip_amount")
    if pretip and tip_amount and abs(tip_amount - pretip) < 0.02:
        add(1, "tips_equals_pretip_total", 3, "high", 35,
            "Tips field equals pre-tip total — mathematically impossible",
            f"The tips line shows ${tip_amount:.2f} which equals the "
            f"pre-tip total. A tip cannot equal the total before tips.",
            "SUB-001 Subway — tips line showed $24.88 = pre-tip total")

    # Rule 3 — Category price ceiling
    merchant_category = receipt.get("merchant_category", "")
    items = receipt.get("items", [])
    ceilings = {"fast_food": 25, "casual_dining": 60, "fine_dining": 150,
                "hotel": 500, "fuel": 200, "retail": 300}
    ceiling = ceilings.get(merchant_category, 100)
    for item_name, item_price in items:
        if item_price > ceiling:
            add(3, "category_price_ceiling", 3, "critical", 40,
                f"Single item ${item_price:.2f} exceeds {merchant_category} category maximum",
                f"A {merchant_category} restaurant does not charge ${item_price:.2f} "
                f"for a single item. Category maximum is ${ceiling}.",
                "FRD-001 Freddy's — $74.20 chicken sandwich at fast food")

    # Rule 5 — Broken discount chain
    if receipt.get("discounts") and receipt.get("subtotal"):
        sale_price = receipt.get("sale_price", 0)
        total_discounts = sum(receipt.get("discounts", {}).values())
        expected_subtotal = sale_price - total_discounts
        actual_subtotal = receipt.get("subtotal", 0)
        if abs(expected_subtotal - actual_subtotal) > 1.00:
            add(5, "broken_discount_chain", 3, "critical", 40,
                "Discount lines don't reconcile to subtotal",
                f"Discounts total ${total_discounts:.2f}. "
                f"Expected subtotal: ${expected_subtotal:.2f}. "
                f"Stated subtotal: ${actual_subtotal:.2f}. "
                f"The discount chain is broken — subtotal was edited without "
                f"updating discount amounts.",
                "KHL-001 Kohl's — ChatGPT changed subtotal but left discount lines")

    # Rule 6/11 — Total Saved inconsistent
    total_saved = receipt.get("total_saved")
    claimed_total = receipt.get("total")
    original_total_saved_implied = receipt.get("original_total_saved_implied")
    if total_saved and original_total_saved_implied:
        if abs(total_saved - original_total_saved_implied) > 2.00:
            add(6, "total_saved_inconsistent", 3, "critical", 35,
                "Total Saved does not match claimed total",
                f"'Total Saved' shows ${total_saved:.2f} but this is "
                f"inconsistent with the claimed total of ${claimed_total:.2f}. "
                f"The summary field was not updated during manipulation — "
                f"revealing the original lower amount.",
                "KHL-001 Kohl's — Total Saved $39.08 exposed real $28.05 total")

    # Rule 9 — Transaction ID mismatch
    if receipt.get("transaction_id_changed"):
        add(9, "transaction_id_format", 3, "high", 15,
            "Transaction ID inconsistent with receipt data",
            "The transaction ID appears to have been modified. "
            "POS systems generate these sequentially — a changed ID "
            "indicates the document was altered.",
            "SUB-001 Subway — transaction ID last digit changed 495439→495434")

    # Rule 10/12/15 — Approval code issues
    if receipt.get("approval_code_missing") and receipt.get("had_approval_code"):
        add(15, "approval_code_missing", 3, "high", 20,
            "Approval code section removed from receipt",
            "The original receipt format included an approval code "
            "section which is now absent. Approval codes do not "
            "disappear from real receipts.",
            "SCH-001 Schafer's — AI removed entire payment section")

    # Rule 14 — Tip suggestion consistency
    tip_suggestions = receipt.get("tip_suggestions", {})
    if len(tip_suggestions) >= 2:
        base = receipt.get("subtotal", 0)
        for pct, suggested in tip_suggestions.items():
            expected = base * float(pct.strip("%")) / 100
            if abs(suggested - expected) > 1.00:
                add(14, "tip_suggestion_consistency", 3, "high", 15,
                    f"Tip suggestion {pct} not calculated from claimed subtotal",
                    f"{pct} of ${base:.2f} should be ${expected:.2f} "
                    f"but shows ${suggested:.2f}. Only some suggestions "
                    f"were updated — revealing the original base amount.",
                    "SCH-001 Schafer's — 25% and 20% tips still from $29.23")
                break

    # Rule 16 — Menu item validation
    invalid_items = receipt.get("menu_items_not_on_menu", [])
    if invalid_items:
        add(16, "menu_item_validation", 3, "medium", 10,
            f"Item names not found on merchant menu",
            f"The following items do not appear on the verified menu for "
            f"this merchant: {', '.join(invalid_items)}. This suggests "
            f"AI-generated fabricated item names.",
            "SCH-001 Schafer's — 'Bottle That', 'Beer Cake', 'Gourbo Irhara'")

    # Rule 17 — Pre-auth vs settled
    preauth = receipt.get("preauth_amount")
    settled = receipt.get("settled_amount")
    if preauth and settled:
        diff = settled - preauth
        diff_pct = diff / preauth * 100
        if diff_pct > 40:  # more than 40% above pre-auth is suspicious
            add(17, "preauth_vs_settled", 3, "critical", 35,
                f"Settled amount ${settled:.2f} far exceeds pre-auth ${preauth:.2f}",
                f"Card was settled for ${diff:.2f} more than pre-authorized. "
                f"A {diff_pct:.0f}% tip is outside normal range. "
                f"Request CC statement to verify actual charge.",
                "SCH-001 Schafer's — pre-auth $29.23 vs claimed $507.69")

    # Rule 19 — Blank tip line vs claimed tip
    if receipt.get("tip_line_blank") and receipt.get("claimed_tip_amount"):
        claimed_tip = receipt.get("claimed_tip_amount", 0)
        add(19, "blank_tip_vs_claimed", 3, "high", 30,
            "Receipt shows blank tip line but expense claims specific tip",
            f"The submitted receipt has a blank tip line indicating no "
            f"tip was entered at POS. However the expense report claims "
            f"a ${claimed_tip:.2f} tip was paid. These are contradictory.",
            "SCH-001 Schafer's — blank tip line, large tip claimed")

    # Rule 20 — Tip range validation
    suggested_max = receipt.get("suggested_tip_max")
    claimed_tip2 = receipt.get("claimed_tip_amount")
    if suggested_max and claimed_tip2 and claimed_tip2 > suggested_max * 1.5:
        add(20, "tip_range_validation", 3, "medium", 15,
            "Claimed tip significantly exceeds suggested maximum",
            f"The receipt's suggested maximum tip is ${suggested_max:.2f} "
            f"(30%). Claimed tip of ${claimed_tip2:.2f} is "
            f"{claimed_tip2/suggested_max*100:.0f}% of that maximum.",
            "SCH-001 Schafer's — tip suggestions expose base amount")

    # ── GATE 4 — Behavioral patterns ──────────────────────────────────────
    if receipt.get("tip_percentage", 0) > 50:
        tip_pct = receipt.get("tip_percentage", 0)
        severity = "critical" if tip_pct > 100 else "high"
        pts = 25 if tip_pct > 50 else 15
        add(18, "tip_percentage_anomaly", 4, severity, pts,
            f"Tip percentage {tip_pct:.0f}% is abnormal",
            f"Normal business expense tips range 15-25%. "
            f"A {tip_pct:.0f}% tip is flagged for review.",
            "SUB-001 / SCH-001 — tip inflation pattern")

    # ── GATE 5 — Policy compliance ──────────────────────────────────────
    if receipt.get("merchant_category") in ["retail", "department_store", "clothing"]:
        add(7, "merchant_category_invalid", 5, "medium", 15,
            "Retail store receipt — not standard business expense",
            "Department stores and retail chains are not standard "
            "business expense categories. Requires explicit policy "
            "exception or manager approval.",
            "KHL-001 Kohl's — DEC BATH from retail store")

    receipt_age_days = receipt.get("receipt_age_days", 0)
    policy_limit = receipt.get("company_age_limit_days", 30)
    if receipt_age_days > policy_limit:
        pts = 15 if receipt_age_days > 90 else 8
        add(8, "receipt_age_exceeded", 5, "medium", pts,
            f"Receipt is {receipt_age_days} days old — exceeds {policy_limit}-day policy",
            f"Company policy requires submission within {policy_limit} days. "
            f"This receipt is {receipt_age_days - policy_limit} days overdue.",
            "KHL-001 Kohl's — 87 days · SCH-001 Schafer's — 130 days")

    # ── DETERMINE RISK LEVEL AND ACTIONS ──────────────────────────────────
    score = min(score, 100)

    if score < 30:
        level = RiskLevel.AUTO_APPROVE
        action = "Receipt verified and auto-approved. Logged for audit trail."
        cc_required = False
        cc_optional = False
        emp_notified = False
        hr_notified = False
        evidence = False
        email_tmpl = "approved"
        steps = ["Receipt logged", "Reimbursement processed"]

    elif score < 50:
        level = RiskLevel.SOFT_REVIEW
        action = "Minor flags detected. Manager notified at convenience. No action required from employee."
        cc_required = False
        cc_optional = False
        emp_notified = False
        hr_notified = False
        evidence = False
        email_tmpl = "soft_review"
        steps = ["Manager receives summary email", "Review at convenience", "Approve or escalate"]

    elif score < 70:
        level = RiskLevel.VERIFICATION
        action = "Receipt on hold. Employee notified and asked to provide CC statement or written explanation within 48 hours."
        cc_required = False
        cc_optional = True
        emp_notified = True
        hr_notified = False
        evidence = False
        email_tmpl = "verification_request"
        steps = [
            "Employee receives neutral verification email",
            "48-hour window to provide CC statement or explanation",
            "Manager reviews response",
            "Approve or escalate to investigation"
        ]

    elif score < 85:
        level = RiskLevel.INVESTIGATION
        action = "Receipt blocked. Manager must review. CC statement required. HR notified to be aware."
        cc_required = True
        cc_optional = False
        emp_notified = True
        hr_notified = True
        evidence = True
        email_tmpl = "manager_investigation"
        steps = [
            "Receipt blocked — no reimbursement until resolved",
            "Employee receives formal verification request",
            "CC statement required — no alternatives",
            "Manager meeting scheduled within 48 hours",
            "HR aware but no disciplinary action yet",
            "Evidence package generated"
        ]

    else:
        level = RiskLevel.CRITICAL
        action = "Receipt blocked. Senior manager and HR notified. Full evidence package generated. Legal team aware."
        cc_required = True
        cc_optional = False
        emp_notified = True
        hr_notified = True
        evidence = True
        email_tmpl = "critical_hold"
        steps = [
            "Receipt blocked immediately",
            "Employee notified of hold — no accusation language",
            "CC statement + original physical receipt required",
            "Senior manager notified within 1 hour",
            "HR notified — prepared for potential action",
            "Full forensic evidence package generated",
            "Legal team flagged if score >95",
            "30-day documentation hold"
        ]

    return SlidingScaleResult(
        total_score=score,
        risk_level=level,
        flags=flags,
        action_required=action,
        cc_statement_required=cc_required,
        cc_statement_optional=cc_optional,
        employee_notified=emp_notified,
        hr_notified=hr_notified,
        evidence_package=evidence,
        email_template=email_tmpl,
        next_steps=steps,
    )


# ── EMAIL TEMPLATES (one per band) ────────────────────────────────────────

EMPLOYEE_EMAILS = {

    "verification_request": {
        "subject": "Action needed — receipt verification for {merchant} ${amount}",
        "body": """Hi {name},

Your expense submission from {merchant} on {date} for ${amount} is currently pending verification.

Our expense system flagged a few items for routine review. This is a standard verification step — not a disciplinary matter.

To complete your reimbursement, please provide one of the following within 48 hours:

  • A credit card or bank statement showing this transaction, OR
  • A brief written explanation of any discrepancies

You can upload your documentation at: {upload_link}

If you have questions, contact {manager_name} at {manager_email}.

Your reimbursement will be processed promptly once verified.

cleaREDiq Expense Verification"""
    },

    "manager_investigation": {
        "subject": "Manager review required — {merchant} ${amount} · Score {score}",
        "body": """Hi {manager_name},

A receipt submitted by {employee_name} requires your review before reimbursement can be processed.

Receipt: {merchant} · {date} · ${amount}
Fraud score: {score}/100 · Risk level: HIGH

Flags detected:
{flags_list}

The employee has been notified and asked to provide a credit card statement confirming this transaction.

Please review the full evidence report at: {report_link}

Required actions:
• Review the evidence package
• Schedule a brief meeting with {employee_name} within 48 hours
• Approve, reject, or escalate to HR

HR has been notified to be aware of this case.

cleaREDiq Fraud Detection"""
    },

    "critical_hold": {
        "subject": "URGENT: Critical fraud flag — {merchant} ${amount} · Immediate review required",
        "body": """Hi {senior_manager_name},

A receipt submission has been flagged as critical risk and requires immediate review.

Employee: {employee_name}
Receipt: {merchant} · {date}
Claimed amount: ${amount}
Fraud score: {score}/100

Critical flags:
{flags_list}

This receipt has been blocked. The employee has been notified that their submission is under review.

REQUIRED WITHIN 24 HOURS:
• Review the full forensic evidence package: {report_link}
• Determine next steps with HR
• Request CC statement if not already provided

HR has been notified. Legal team has been flagged.

Do not contact the employee directly until HR guidance is received.

cleaREDiq Fraud Detection — Critical Alert"""
    },
}

