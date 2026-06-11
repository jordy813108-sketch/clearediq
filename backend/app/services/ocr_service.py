"""
OCR Service — supports Google Vision API and AWS Textract.
Set GOOGLE_VISION_API_KEY or configure AWS credentials in .env
"""
import re
import httpx
import base64
import json
from typing import Optional
from app.core.config import settings
import structlog

log = structlog.get_logger()


class OCRService:

    async def extract(self, image_bytes: bytes, mime_type: str) -> dict:
        """Extract structured receipt data from image bytes."""
        if settings.GOOGLE_VISION_API_KEY:
            return await self._google_vision(image_bytes, mime_type)
        else:
            # Fall back to mock data in dev if no API key configured
            log.warning("No OCR API key configured — returning mock data")
            return self._mock_result()

    async def _google_vision(self, image_bytes: bytes, mime_type: str) -> dict:
        b64 = base64.b64encode(image_bytes).decode()
        payload = {
            "requests": [{
                "image": {"content": b64},
                "features": [
                    {"type": "TEXT_DETECTION"},
                    {"type": "DOCUMENT_TEXT_DETECTION"},
                ]
            }]
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"https://vision.googleapis.com/v1/images:annotate"
                f"?key={settings.GOOGLE_VISION_API_KEY}",
                json=payload
            )
            resp.raise_for_status()
            data = resp.json()

        raw_text = ""
        confidence = 0.0
        try:
            annotation = data["responses"][0].get("fullTextAnnotation", {})
            raw_text = annotation.get("text", "")
            pages = annotation.get("pages", [])
            if pages:
                confidence = pages[0].get("confidence", 0.9)
        except (KeyError, IndexError):
            pass

        # Regex baseline first — always gives a complete result and is the
        # fallback if AI extraction is unavailable or fails.
        result = self._parse_receipt_text(raw_text, confidence)

        # Augment with Claude-based extraction. Override regex values only where
        # the AI returned a non-null value; never weaken what regex already found.
        ai_fields = await self._ai_extract(raw_text)
        if ai_fields:
            for key, value in ai_fields.items():
                if value is not None and value != []:
                    result[key] = value
            # Re-derive tax_rate from the merged subtotal/tax.
            sub = result.get("subtotal")
            tax = result.get("tax_amount")
            if sub and tax and sub > 0:
                result["tax_rate"] = round(tax / sub * 100, 2)
            result["provider"] = "google_vision+claude"

        # Deterministically reconcile the tip against the math so an AI tip
        # guess (e.g. from a "suggested gratuity" table) can't create a false
        # math mismatch. Runs on both the AI and regex-only paths.
        self._reconcile_tip(result)

        return result

    def _reconcile_tip(self, result: dict) -> None:
        """Derive tip from subtotal/tax/total (which OCR reads reliably) rather
        than trusting an extracted tip guess. Mutates result in place.

        - all three present and total > subtotal+tax -> tip = the residual
        - total == subtotal+tax (within $0.02)        -> tip = None (no tip)
        - total < subtotal+tax (impossible as a tip)  -> tip = None; the math
          validator then flags the genuine inconsistency
        - any of subtotal/tax/total missing           -> leave tip untouched
        """
        subtotal = result.get("subtotal")
        tax = result.get("tax_amount")
        total = result.get("total_amount")

        # Use 'is None' (not truthiness) so a legitimate 0.00 still counts.
        if subtotal is None or tax is None or total is None:
            return

        expected_tip = round(total - subtotal - tax, 2)
        if expected_tip > 0.02:
            result["tip_amount"] = expected_tip
        else:
            # ~0 (no tip) or negative (impossible as a tip) -> clear it.
            result["tip_amount"] = None

    def _parse_receipt_text(self, text: str, confidence: float) -> dict:
        """Parse raw OCR text into structured receipt fields."""
        result = {
            "raw_text": text,
            "confidence_score": confidence,
            "provider": "google_vision",
        }

        lines = [l.strip() for l in text.split("\n") if l.strip()]

        # Merchant name — usually first non-empty line
        result["merchant_name"] = lines[0] if lines else None

        # Amounts — look for total, subtotal, tax patterns
        total_pattern = re.compile(r'(?:total|amount due)[^\d]*(\d+\.\d{2})', re.IGNORECASE)
        subtotal_pattern = re.compile(r'subtotal[^\d]*(\d+\.\d{2})', re.IGNORECASE)
        tax_pattern = re.compile(r'(?:tax|gst|vat)[^\d]*(\d+\.\d{2})', re.IGNORECASE)
        tip_pattern = re.compile(r'(?:tip|gratuity)[^\d]*(\d+\.\d{2})', re.IGNORECASE)
        date_pattern = re.compile(r'(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})')
        time_pattern = re.compile(r'(\d{1,2}:\d{2}\s*(?:AM|PM)?)', re.IGNORECASE)
        card_pattern = re.compile(r'(?:visa|mc|mastercard|amex|discover)[^\d]*(\d{4})', re.IGNORECASE)
        txn_pattern = re.compile(r'(?:trans|txn|transaction|ref|order)[^\d\w]*([A-Z0-9\-]{6,})', re.IGNORECASE)

        full_text = "\n".join(lines)

        m = total_pattern.search(full_text)
        result["total_amount"] = float(m.group(1)) if m else None

        m = subtotal_pattern.search(full_text)
        result["subtotal"] = float(m.group(1)) if m else None

        m = tax_pattern.search(full_text)
        result["tax_amount"] = float(m.group(1)) if m else None

        m = tip_pattern.search(full_text)
        result["tip_amount"] = float(m.group(1)) if m else None

        m = date_pattern.search(full_text)
        result["transaction_date"] = m.group(1) if m else None

        m = time_pattern.search(full_text)
        result["transaction_time"] = m.group(1) if m else None

        m = card_pattern.search(full_text)
        result["card_last_four"] = m.group(1) if m else None
        result["payment_method"] = "Card" if m else None

        m = txn_pattern.search(full_text)
        result["transaction_id"] = m.group(1) if m else None

        # Derive tax rate
        if result.get("subtotal") and result.get("tax_amount") and result["subtotal"] > 0:
            result["tax_rate"] = round(result["tax_amount"] / result["subtotal"] * 100, 2)

        # Line items — simple heuristic: price pattern on each line
        line_pattern = re.compile(r'^(.+?)\s+\$?(\d+\.\d{2})$')
        line_items = []
        for line in lines:
            m = line_pattern.match(line)
            if m and m.group(1).lower() not in ("total", "subtotal", "tax", "tip"):
                line_items.append({
                    "description": m.group(1),
                    "total": float(m.group(2))
                })
        result["line_items"] = line_items[:20]  # cap at 20

        return result

    async def _ai_extract(self, raw_text: str) -> Optional[dict]:
        """
        Use Claude to extract structured receipt fields from the OCR text.
        Returns a dict of fields, or None on any failure (caller falls back to
        the regex result). Never raises — the upload pipeline must not break.
        """
        if not settings.ANTHROPIC_API_KEY:
            return None
        if not raw_text or not raw_text.strip():
            return None

        prompt = (
            "You are a receipt data extractor. Below is the raw OCR text of a "
            "single receipt. Extract the fields into JSON.\n\n"
            "Respond with ONLY a JSON object — no prose, no explanation, no "
            "markdown, no code fences. Use null for any field that is not "
            "present. Numbers must be JSON numbers (not strings, no currency "
            "symbols or thousands separators). Format transaction_date as "
            "YYYY-MM-DD. For tip_amount, only extract a tip that was ACTUALLY "
            "charged or paid — a 'Tip:', 'Gratuity:', or 'Service Charge:' line "
            "whose value is included in the final total. DO NOT extract a tip "
            "from a 'suggested tip' or 'suggested gratuity' table that lists "
            "percentage options (e.g. 15%, 18%, 20%, 25%) and their dollar "
            "amounts — those are suggestions, not charged tips. Prefer the tip "
            "(if any) that makes subtotal + tax + tip equal the total; if a "
            "candidate tip would make them NOT reconcile, it is almost "
            "certainly a suggestion — return tip_amount: null. If it is unclear "
            "whether a tip was actually paid, return tip_amount: null. Each "
            "line item is "
            '{"description": str, "quantity": number|null, '
            '"unit_price": number|null, "total": number|null}.\n\n'
            "Return exactly this shape:\n"
            "{\n"
            '  "merchant_name": str|null,\n'
            '  "merchant_address": str|null,\n'
            '  "transaction_date": str|null,\n'
            '  "transaction_time": str|null,\n'
            '  "transaction_id": str|null,\n'
            '  "subtotal": number|null,\n'
            '  "tax_amount": number|null,\n'
            '  "tip_amount": number|null,\n'
            '  "total_amount": number|null,\n'
            '  "payment_method": str|null,\n'
            '  "card_last_four": str|null,\n'
            '  "line_items": [ ... ]\n'
            "}\n\n"
            "RECEIPT TEXT:\n"
            f"{raw_text}"
        )

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": settings.ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": "claude-sonnet-4-6",
                        "max_tokens": 1024,
                        "messages": [{
                            "role": "user",
                            "content": [{"type": "text", "text": prompt}],
                        }],
                    },
                )

            if response.status_code != 200:
                log.warning("AI OCR extraction non-200", status=response.status_code)
                return None

            text = response.json()["content"][0]["text"]
            text = re.sub(r'```json|```', '', text).strip()
            parsed = json.loads(text)

            if not isinstance(parsed, dict):
                return None

            num_fields = ("subtotal", "tax_amount", "tip_amount", "total_amount")
            str_fields = (
                "merchant_name", "merchant_address", "transaction_date",
                "transaction_time", "transaction_id", "payment_method",
                "card_last_four",
            )

            out: dict = {}
            for f in str_fields:
                v = parsed.get(f)
                out[f] = v if isinstance(v, str) and v.strip() else None
            for f in num_fields:
                out[f] = self._coerce_number(parsed.get(f))

            items = []
            if isinstance(parsed.get("line_items"), list):
                for li in parsed["line_items"][:20]:
                    if not isinstance(li, dict):
                        continue
                    desc = li.get("description")
                    if not (isinstance(desc, str) and desc.strip()):
                        continue
                    items.append({
                        "description": desc.strip(),
                        "quantity": self._coerce_number(li.get("quantity")),
                        "unit_price": self._coerce_number(li.get("unit_price")),
                        "total": self._coerce_number(li.get("total")),
                    })
            out["line_items"] = items

            return out

        except Exception as e:
            log.warning("AI OCR extraction failed", error=str(e))
            return None

    @staticmethod
    def _coerce_number(value) -> Optional[float]:
        """Best-effort numeric coercion; returns None for anything unparseable."""
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            cleaned = value.replace("$", "").replace(",", "").strip()
            try:
                return float(cleaned)
            except ValueError:
                return None
        return None

    def _mock_result(self) -> dict:
        return {
            "raw_text": "MOCK RECEIPT — configure OCR API key",
            "confidence_score": 0.95,
            "provider": "mock",
            "merchant_name": "Demo Merchant",
            "transaction_date": "2026-05-20",
            "subtotal": 100.00,
            "tax_amount": 8.25,
            "tax_rate": 8.25,
            "total_amount": 108.25,
            "payment_method": "Visa",
            "card_last_four": "1234",
            "line_items": [{"description": "Item 1", "total": 100.00}],
        }


ocr_service = OCRService()
