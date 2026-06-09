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

        return self._parse_receipt_text(raw_text, confidence)

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
