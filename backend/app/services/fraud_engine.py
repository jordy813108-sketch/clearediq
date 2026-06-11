"""
cleaREDiq Fraud Detection Engine v2
Combines:
- Rule-based validation (math, tax, timestamps, duplicates, merchant)
- Deep image forensics (EXIF, file structure, pixel analysis)
- AI vision analysis (Claude-powered receipt authenticity check)
- Behavioral pattern detection (round numbers, threshold clustering)
"""
from typing import Optional
import re
import structlog

log = structlog.get_logger()

STATE_TAX_RATES = {
    "AL": (4.0, 13.5), "AK": (0.0, 7.5), "AZ": (5.6, 11.2), "AR": (6.5, 12.0),
    "CA": (7.25, 10.75), "CO": (2.9, 10.9), "CT": (6.35, 6.35), "DE": (0.0, 0.0),
    "FL": (6.0, 8.5), "GA": (4.0, 8.9), "HI": (4.0, 4.5), "ID": (6.0, 9.0),
    "IL": (6.25, 11.5), "IN": (7.0, 7.0), "IA": (6.0, 7.0), "KS": (6.5, 11.5),
    "KY": (6.0, 6.0), "LA": (4.45, 12.95), "ME": (5.5, 5.5), "MD": (6.0, 6.0),
    "MA": (6.25, 6.25), "MI": (6.0, 6.0), "MN": (6.875, 9.875), "MS": (7.0, 8.0),
    "MO": (4.225, 11.988), "MT": (0.0, 0.0), "NE": (5.5, 8.5), "NV": (6.85, 8.375),
    "NH": (0.0, 0.0), "NJ": (6.625, 12.625), "NM": (5.0, 9.25), "NY": (4.0, 8.875),
    "NC": (4.75, 7.5), "ND": (5.0, 8.5), "OH": (5.75, 8.0), "OK": (4.5, 11.5),
    "OR": (0.0, 0.0), "PA": (6.0, 8.0), "RI": (7.0, 7.0), "SC": (6.0, 9.0),
    "SD": (4.5, 7.5), "TN": (7.0, 10.25), "TX": (6.25, 8.25), "UT": (6.1, 9.05),
    "VT": (6.0, 7.0), "VA": (5.3, 7.0), "WA": (6.5, 10.6), "WV": (6.0, 7.0),
    "WI": (5.0, 7.9), "WY": (4.0, 6.0),
}

CITY_TAX_OVERRIDES = {
    "Chicago, IL": (10.25, 10.25), "New York, NY": (8.875, 8.875),
    "Los Angeles, CA": (10.25, 10.25), "Seattle, WA": (10.35, 10.35),
    "Houston, TX": (8.25, 8.25),
}

# Common expense approval thresholds — fraud often clusters just below these
APPROVAL_THRESHOLDS = [25, 50, 75, 100, 150, 200, 250, 500, 1000, 2500, 5000]


class FraudDetectionEngine:

    async def analyze(
        self,
        ocr_data: dict,
        file_hash: str,
        image_bytes: bytes = None,
        filename: str = "",
        anthropic_api_key: str = "",
    ) -> dict:
        flags = []
        scores = {}

        # 1. Math validation
        math_score, math_flags = self._validate_math(ocr_data)
        scores["math_validation_score"] = math_score
        flags.extend(math_flags)

        # 2. Tax validation
        tax_score, tax_flags = self._validate_tax(ocr_data)
        scores["tax_validation_score"] = tax_score
        flags.extend(tax_flags)

        # 3. Timestamp validation
        ts_score, ts_flags = self._validate_timestamps(ocr_data)
        scores["timestamp_score"] = ts_score
        flags.extend(ts_flags)

        # 4. Duplicate check
        dup_score, dup_flags = self._check_duplicates(ocr_data, file_hash)
        scores["duplicate_score"] = dup_score
        flags.extend(dup_flags)

        # 5. Merchant validation
        merch_score, merch_flags = self._validate_merchant(ocr_data)
        scores["merchant_score"] = merch_score
        flags.extend(merch_flags)

        # 6. Behavioral patterns (new)
        behavior_score, behavior_flags = self._detect_behavioral_patterns(ocr_data)
        scores["behavioral_score"] = behavior_score
        flags.extend(behavior_flags)

        # 7. Image forensics (upgraded — full pipeline)
        if image_bytes:
            from app.services.image_forensics import image_forensics_engine
            forensics_result = await image_forensics_engine.analyze(
                image_bytes, filename, anthropic_api_key
            )
            img_score = forensics_result["forensics_score"]
            scores["image_forensics_score"] = img_score
            flags.extend(forensics_result["flags"])
        else:
            scores["image_forensics_score"] = 0

        # 8. OCR metadata score
        meta_score, meta_flags = self._analyze_metadata(ocr_data)
        scores["metadata_score"] = meta_score
        flags.extend(meta_flags)

        # Weighted overall score
        weights = {
            "math_validation_score":  0.18,
            "tax_validation_score":   0.12,
            "timestamp_score":        0.08,
            "duplicate_score":        0.12,
            "merchant_score":         0.08,
            "behavioral_score":       0.10,
            "image_forensics_score":  0.22,
            "metadata_score":         0.10,
        }
        overall = sum(scores.get(k, 0) * v for k, v in weights.items())
        overall = min(100, max(0, int(overall)))

        # Severity floor: a single HIGH/critical flag must not be diluted below
        # its true risk by the weighted average.
        overall, risk_level = self._apply_severity_floor(overall, flags)

        # Sort flags by severity
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        flags.sort(key=lambda f: severity_order.get(f.get("severity", "low"), 4))

        return {
            "overall_score": overall,
            "risk_level": risk_level,
            "flags": flags,
            "score_breakdown": scores,
            **scores,
        }

    def _validate_math(self, ocr: dict) -> tuple[int, list]:
        flags = []
        score = 0

        subtotal = ocr.get("subtotal")
        tax = ocr.get("tax_amount")
        tip = ocr.get("tip_amount", 0) or 0
        total = ocr.get("total_amount")
        line_items = ocr.get("line_items", [])

        if subtotal and total and tax is not None:
            expected_total = round(subtotal + tax + tip, 2)
            if abs(expected_total - total) > 0.02:
                residual = round(total - subtotal - tax, 2)
                tip_provided = bool(ocr.get("tip_amount"))
                # A small positive gap when no tip was captured is far more
                # likely an unrecorded gratuity than fraud. Treat residuals up
                # to 30% of subtotal as a probable tip (informational, no score).
                if not tip_provided and 0 < residual <= round(subtotal * 0.30, 2):
                    flags.append({
                        "flag_type": "probable_unrecorded_tip",
                        "severity": "low",
                        "title": "Total exceeds subtotal + tax — likely an unrecorded tip",
                        "description": f"Total ${total} is ${residual} above subtotal ${subtotal} + tax ${tax}; within a plausible tip range and likely a gratuity not captured by OCR.",
                        "weight": 0,
                    })
                else:
                    score += 60
                    flags.append({
                        "flag_type": "math_mismatch",
                        "severity": "high",
                        "title": "Subtotal + tax ≠ total",
                        "description": f"${subtotal} + ${tax} + ${tip} tip = ${expected_total}, but receipt shows ${total}. Numbers don't add up.",
                        "weight": 0.6,
                    })

        if line_items and subtotal:
            line_total = round(sum(li.get("total", 0) for li in line_items if li.get("total")), 2)
            if line_total > 0 and abs(line_total - subtotal) > 0.05:
                score += 40
                flags.append({
                    "flag_type": "line_item_mismatch",
                    "severity": "medium",
                    "title": "Line items don't sum to subtotal",
                    "description": f"Line items total ${line_total} but subtotal shows ${subtotal}.",
                    "weight": 0.4,
                })

        if total and total > 10000:
            score += 20
            flags.append({
                "flag_type": "unusually_high_amount",
                "severity": "medium",
                "title": "Unusually high receipt total",
                "description": f"Total of ${total:,.2f} is above typical expense thresholds — verify with employee.",
                "weight": 0.2,
            })

        return min(score, 100), flags

    def _validate_tax(self, ocr: dict) -> tuple[int, list]:
        flags = []
        score = 0

        tax_rate = ocr.get("tax_rate")
        merchant_address = ocr.get("merchant_address", "") or ""
        total = ocr.get("total_amount", 0) or 0

        if tax_rate is None:
            return 0, flags

        if tax_rate > 20:
            score += 70
            flags.append({
                "flag_type": "impossible_tax_rate",
                "severity": "high",
                "title": "Impossible tax rate",
                "description": f"Tax rate of {tax_rate}% exceeds the highest known US combined rate. Likely fabricated.",
                "weight": 0.7,
            })
            return score, flags

        if tax_rate < 0:
            score += 80
            flags.append({
                "flag_type": "negative_tax",
                "severity": "critical",
                "title": "Negative tax rate",
                "description": "Tax rate cannot be negative. This receipt has been manipulated.",
                "weight": 0.8,
            })
            return score, flags

        detected_state = self._extract_state(merchant_address)
        detected_city = self._extract_city(merchant_address)

        expected_range = None
        if detected_city and detected_city in CITY_TAX_OVERRIDES:
            expected_range = CITY_TAX_OVERRIDES[detected_city]
        elif detected_state and detected_state in STATE_TAX_RATES:
            expected_range = STATE_TAX_RATES[detected_state]

        if expected_range:
            min_rate, max_rate = expected_range
            if tax_rate < min_rate - 0.5 or tax_rate > max_rate + 0.5:
                score += 45
                flags.append({
                    "flag_type": "tax_rate_mismatch",
                    "severity": "medium",
                    "title": "Tax rate inconsistent with merchant location",
                    "description": (
                        f"Rate of {tax_rate}% doesn't match expected "
                        f"{min_rate}%–{max_rate}% for {detected_city or detected_state}."
                    ),
                    "weight": 0.45,
                })

        if tax_rate == 0 and total > 20:
            score += 15
            flags.append({
                "flag_type": "zero_tax",
                "severity": "low",
                "title": "Zero tax on substantial purchase",
                "description": "No tax applied — may be valid for certain categories (groceries, services) but worth confirming.",
                "weight": 0.15,
            })

        return min(score, 100), flags

    def _validate_timestamps(self, ocr: dict) -> tuple[int, list]:
        from datetime import datetime, date
        flags = []
        score = 0

        date_str = ocr.get("transaction_date")
        if not date_str:
            return 10, [{
                "flag_type": "missing_date", "severity": "low",
                "title": "No date found on receipt",
                "description": "Date could not be extracted — may indicate a low-quality scan or fabricated receipt.",
                "weight": 0.1,
            }]

        parsed = None
        for fmt in ("%m/%d/%Y", "%m-%d-%Y", "%Y-%m-%d", "%m/%d/%y", "%d/%m/%Y"):
            try:
                parsed = datetime.strptime(date_str.strip(), fmt).date()
                break
            except ValueError:
                pass

        if not parsed:
            return 20, [{
                "flag_type": "unparseable_date", "severity": "low",
                "title": "Date format unrecognized",
                "description": f"Could not parse '{date_str}' as a valid date.",
                "weight": 0.2,
            }]

        today = date.today()

        if parsed > today:
            score += 80
            flags.append({
                "flag_type": "future_date", "severity": "high",
                "title": "Receipt date is in the future",
                "description": f"Receipt is dated {parsed}, which is after today ({today}). Impossible for a real transaction.",
                "weight": 0.8,
            })
        elif (today - parsed).days > 365:
            score += 30
            flags.append({
                "flag_type": "very_old_date", "severity": "medium",
                "title": "Receipt is over 1 year old",
                "description": f"Dated {parsed} — {(today - parsed).days} days ago. Verify this isn't a recycled receipt.",
                "weight": 0.3,
            })

        return min(score, 100), flags

    def _check_duplicates(self, ocr: dict, file_hash: str) -> tuple[int, list]:
        flags = []
        score = 0

        txn_id = ocr.get("transaction_id")
        if not txn_id:
            score += 10
            flags.append({
                "flag_type": "missing_transaction_id", "severity": "low",
                "title": "No transaction ID found",
                "description": "Most legitimate merchant receipts include a transaction or order ID. Missing IDs are common on fabricated receipts.",
                "weight": 0.1,
            })

        return score, flags

    def _validate_merchant(self, ocr: dict) -> tuple[int, list]:
        flags = []
        score = 0

        merchant = ocr.get("merchant_name", "")
        if not merchant:
            score += 25
            flags.append({
                "flag_type": "missing_merchant", "severity": "medium",
                "title": "Merchant name not detected",
                "description": "No recognizable merchant name found. All legitimate receipts display the business name.",
                "weight": 0.25,
            })
        else:
            # Check for suspiciously generic merchant names
            generic_names = ["store", "shop", "market", "business", "company", "merchant", "vendor", "restaurant"]
            if merchant.lower().strip() in generic_names:
                score += 30
                flags.append({
                    "flag_type": "generic_merchant_name", "severity": "medium",
                    "title": f"Suspiciously generic merchant name: '{merchant}'",
                    "description": "Merchant name is unusually generic. Real businesses have specific names.",
                    "weight": 0.3,
                })

        address = ocr.get("merchant_address", "") or ""
        if not address:
            score += 10
            flags.append({
                "flag_type": "missing_address", "severity": "low",
                "title": "No merchant address",
                "description": "Merchant address not found. Most receipts include the business address.",
                "weight": 0.1,
            })

        return score, flags

    def _detect_behavioral_patterns(self, ocr: dict) -> tuple[int, list]:
        """
        Detect behavioral fraud patterns:
        - Amounts just under approval thresholds
        - Suspiciously round totals
        - Round tip amounts
        """
        flags = []
        score = 0

        total = ocr.get("total_amount")
        tip = ocr.get("tip_amount")

        if total:
            # Check if amount is suspiciously just under an approval threshold
            for threshold in APPROVAL_THRESHOLDS:
                if threshold * 0.92 <= total <= threshold * 0.99:
                    score += 35
                    flags.append({
                        "flag_type": "threshold_clustering",
                        "severity": "medium",
                        "title": f"Amount suspiciously close to ${threshold} threshold",
                        "description": (
                            f"Total of ${total:.2f} is just under the common ${threshold} "
                            f"approval threshold — a known fraud pattern."
                        ),
                        "weight": 0.35,
                    })
                    break

            # Suspiciously round total (real receipts rarely end in .00)
            if total > 20 and total == int(total):
                score += 20
                flags.append({
                    "flag_type": "perfectly_round_total",
                    "severity": "low",
                    "title": "Suspiciously round total amount",
                    "description": f"Total of ${total:.0f}.00 is a perfectly round number. Real receipts rarely have exact dollar totals due to tax and itemization.",
                    "weight": 0.2,
                })

        # Round tip amounts are suspicious (people tip in percentages, not round dollars)
        if tip and tip > 5 and tip == int(tip):
            score += 15
            flags.append({
                "flag_type": "round_tip_amount",
                "severity": "low",
                "title": "Perfectly round tip amount",
                "description": f"Tip of ${tip:.0f}.00 is a round number — may indicate a manually entered/fabricated amount.",
                "weight": 0.15,
            })

        return min(score, 100), flags

    def _analyze_metadata(self, ocr: dict) -> tuple[int, list]:
        flags = []
        score = 0

        confidence = ocr.get("confidence_score", 1.0)
        if confidence < 0.6:
            score += 30
            flags.append({
                "flag_type": "low_ocr_confidence", "severity": "medium",
                "title": "Low text extraction confidence",
                "description": f"OCR confidence is {confidence:.0%} — image may be blurry, low resolution, or digitally created.",
                "weight": 0.3,
            })

        return score, flags

    def _score_to_risk(self, score: int) -> str:
        if score >= 75: return "CRITICAL"
        elif score >= 55: return "HIGH"
        elif score >= 30: return "MEDIUM"
        return "LOW"

    # Risk ordering + the numeric band each level starts at.
    _RISK_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
    _RISK_MIN_SCORE = {"LOW": 0, "MEDIUM": 30, "HIGH": 55, "CRITICAL": 75}

    def _apply_severity_floor(self, overall_score: int, flags: list) -> tuple[int, str]:
        """
        Ensure the risk level (and score) reflect the most severe flag present —
        a weighted average can dilute a single HIGH/critical finding below its
        true risk. Returns the (possibly raised) (overall_score, risk_level).

        Floor rules (only high/critical drive the floor; mediums/lows do not):
          - >=1 critical  -> HIGH, and CRITICAL if 2+ criticals or any high too
          - >=2 high      -> HIGH
          - exactly 1 high-> MEDIUM
        The numeric risk level is never lowered, only raised to the floor.
        """
        numeric_risk = self._score_to_risk(overall_score)

        high = sum(1 for f in flags if f.get("severity") == "high")
        critical = sum(1 for f in flags if f.get("severity") == "critical")

        floor = "LOW"
        if critical >= 1:
            floor = "CRITICAL" if (critical >= 2 or high >= 1) else "HIGH"
        elif high >= 2:
            floor = "HIGH"
        elif high == 1:
            floor = "MEDIUM"

        # Take the more severe of the numeric risk and the severity floor.
        risk_level = numeric_risk
        if self._RISK_ORDER[floor] > self._RISK_ORDER[numeric_risk]:
            risk_level = floor

        # Keep the displayed number consistent with the (possibly raised) band.
        overall_score = max(overall_score, self._RISK_MIN_SCORE[risk_level])
        return min(100, overall_score), risk_level

    def _extract_state(self, address: str) -> Optional[str]:
        m = re.search(r'\b([A-Z]{2})\b\s*\d{5}', address)
        return m.group(1) if m else None

    def _extract_city(self, address: str) -> Optional[str]:
        for city in CITY_TAX_OVERRIDES:
            if city.lower() in address.lower():
                return city
        return None


fraud_engine = FraudDetectionEngine()


class FraudDetectionEngineV2(FraudDetectionEngine):
    """Extended engine with merchant address verification."""

    async def analyze(
        self,
        ocr_data: dict,
        file_hash: str,
        image_bytes: bytes = None,
        filename: str = "",
        anthropic_api_key: str = "",
        google_places_api_key: str = "",
        employee_location: str = "",
    ) -> dict:
        # Run base analysis
        result = await super().analyze(
            ocr_data, file_hash, image_bytes, filename, anthropic_api_key
        )

        # Add merchant address verification
        if google_places_api_key or True:  # Always run (returns graceful no-key message if missing)
            from app.services.merchant_verifier import merchant_verifier

            merchant_name = ocr_data.get("merchant_name", "")
            merchant_address = ocr_data.get("merchant_address", "")

            verification = await merchant_verifier.verify(
                merchant_name=merchant_name,
                merchant_address=merchant_address,
                google_api_key=google_places_api_key,
                employee_location=employee_location,
            )

            # Add verification flags to results
            verif_score = verification["verification_score"]
            verif_flags = verification["flags"]
            place_details = verification.get("place_details")

            # Blend into overall score (15% weight for address verification)
            current = result["overall_score"]
            blended = int((current * 0.85) + (verif_score * 0.15))

            # Merge the merchant verification flags into the full set first...
            severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
            all_flags = result["flags"] + verif_flags
            all_flags.sort(key=lambda f: severity_order.get(f.get("severity", "low"), 4))
            result["flags"] = all_flags

            # ...then apply the severity floor over the COMPLETE flag set, so
            # merchant findings (e.g. business_not_found) can raise the risk.
            blended, risk_level = self._apply_severity_floor(min(100, blended), all_flags)
            result["overall_score"] = blended
            result["risk_level"] = risk_level

            result["address_verification_score"] = verif_score
            result["place_details"] = place_details

        return result


fraud_engine_v2 = FraudDetectionEngineV2()
