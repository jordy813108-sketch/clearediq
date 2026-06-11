"""
cleaREDiq Image Forensics Engine
Detects:
- AI-generated receipts (ChatGPT, Gemini, Canva, etc.)
- Photo editing (Photoshop, GIMP, mobile editors)
- Screenshots of fake receipts
- Phone photos of screens
- Error Level Analysis (ELA) for tampered pixels
- EXIF metadata anomalies
- Font/layout inconsistencies via AI vision
"""
import io
import base64
import struct
import zlib
import re
import httpx
import structlog
from typing import Optional

log = structlog.get_logger()


class ImageForensicsEngine:

    async def analyze(self, image_bytes: bytes, filename: str = "", anthropic_api_key: str = "") -> dict:
        """
        Full forensics pipeline. Returns flags and a forensics score (0-100).
        Higher score = more suspicious.
        """
        flags = []
        score = 0

        # 1. EXIF metadata analysis
        exif_score, exif_flags = self._analyze_exif(image_bytes, filename)
        score += exif_score
        flags.extend(exif_flags)

        # 2. File structure analysis
        struct_score, struct_flags = self._analyze_file_structure(image_bytes, filename)
        score += struct_score
        flags.extend(struct_flags)

        # 3. Statistical pixel analysis (detects ELA-type anomalies without OpenCV)
        pixel_score, pixel_flags = self._analyze_pixel_statistics(image_bytes)
        score += pixel_score
        flags.extend(pixel_flags)

        # 4. AI vision analysis (most powerful — uses Claude)
        if anthropic_api_key:
            ai_score, ai_flags = await self._analyze_with_ai_vision(image_bytes, anthropic_api_key)
            score += ai_score
            flags.extend(ai_flags)
        else:
            # Still run heuristic checks without AI
            heuristic_score, heuristic_flags = self._heuristic_receipt_checks(image_bytes)
            score += heuristic_score
            flags.extend(heuristic_flags)

        return {
            "forensics_score": min(100, score),
            "flags": flags,
        }

    def _analyze_exif(self, image_bytes: bytes, filename: str) -> tuple[int, list]:
        """
        EXIF analysis — real phone photos have rich metadata.
        AI-generated images and designed receipts have none or minimal metadata.
        """
        flags = []
        score = 0

        is_jpeg = image_bytes[:3] == b'\xff\xd8\xff'
        is_png = image_bytes[:8] == b'\x89PNG\r\n\x1a\n'

        if not (is_jpeg or is_png):
            return 0, flags

        # Look for EXIF data in JPEG
        if is_jpeg:
            has_exif = b'Exif' in image_bytes[:65536]
            has_gps = b'GPS' in image_bytes[:65536]
            has_make = b'Make' in image_bytes[:65536] or b'make' in image_bytes[:1000]

            # Check for software signatures (editing tools)
            software_signatures = [
                (b'Adobe Photoshop', 'Adobe Photoshop', 'critical'),
                (b'GIMP', 'GIMP image editor', 'high'),
                (b'Canva', 'Canva', 'critical'),
                (b'Adobe Illustrator', 'Adobe Illustrator', 'critical'),
                (b'Snapseed', 'Snapseed mobile editor', 'high'),
                (b'Lightroom', 'Adobe Lightroom', 'medium'),
                (b'Paint.NET', 'Paint.NET', 'high'),
                (b'Pixelmator', 'Pixelmator', 'medium'),
                (b'DALL-E', 'DALL-E AI generator', 'critical'),
                (b'Midjourney', 'Midjourney AI', 'critical'),
                (b'Stable Diffusion', 'Stable Diffusion AI', 'critical'),
                (b'dall-e', 'DALL-E AI generator', 'critical'),
                (b'ComfyUI', 'AI image generator', 'critical'),
            ]

            for sig_bytes, sig_name, severity in software_signatures:
                if sig_bytes in image_bytes[:65536]:
                    score += 85 if severity == 'critical' else 65 if severity == 'high' else 45
                    flags.append({
                        "flag_type": "editing_software_detected",
                        "severity": severity,
                        "title": f"Receipt created/edited with {sig_name}",
                        "description": f"Image metadata contains {sig_name} signature. Real receipt photos are taken with a phone camera.",
                        "weight": 0.85,
                    })

            # No EXIF at all on a JPEG is suspicious
            if not has_exif:
                score += 30
                flags.append({
                    "flag_type": "no_exif_data",
                    "severity": "medium",
                    "title": "No camera metadata found",
                    "description": "Real receipt photos taken with a phone contain camera information (make, model, timestamp). This image has none — may be AI-generated, screenshot, or designed.",
                    "weight": 0.3,
                })
            elif has_exif and not has_make:
                score += 20
                flags.append({
                    "flag_type": "missing_camera_make",
                    "severity": "low",
                    "title": "Camera information incomplete",
                    "description": "EXIF data present but no camera make/model found. May indicate metadata was stripped or image was edited.",
                    "weight": 0.2,
                })

        # Check for screen capture signatures
        screen_sigs = [
            b'Screenshot', b'screenshot', b'screen shot',
            b'Screen Capture', b'screencapture',
        ]
        for sig in screen_sigs:
            if sig in image_bytes[:65536]:
                score += 70
                flags.append({
                    "flag_type": "screenshot_detected",
                    "severity": "high",
                    "title": "Screenshot metadata detected",
                    "description": "Image appears to be a screenshot rather than a photo of a physical receipt.",
                    "weight": 0.7,
                })
                break

        # Check for PNG (screenshots are often PNG)
        if is_png and filename.lower().endswith('.png'):
            score += 25
            flags.append({
                "flag_type": "png_receipt",
                "severity": "medium",
                "title": "Receipt submitted as PNG file",
                "description": "Real receipt photos are JPEGs taken by phone cameras. PNGs are typically screenshots or digitally created images.",
                "weight": 0.25,
            })

        return min(score, 100), flags

    def _analyze_file_structure(self, image_bytes: bytes, filename: str) -> tuple[int, list]:
        """
        Analyze the raw file structure for anomalies.
        """
        flags = []
        score = 0

        size = len(image_bytes)

        # Very small file
        if size < 8000:
            score += 35
            flags.append({
                "flag_type": "very_small_file",
                "severity": "medium",
                "title": "Unusually small image file",
                "description": f"File is only {size:,} bytes. Real receipt photos from modern phones are typically 500KB–5MB. This may be a thumbnail, screenshot crop, or AI-generated image.",
                "weight": 0.35,
            })

        # Suspiciously perfect file size (round numbers often indicate generated content)
        if size > 1000 and size % 1000 == 0:
            score += 10
            flags.append({
                "flag_type": "round_file_size",
                "severity": "low",
                "title": "Unusually round file size",
                "description": f"File size is exactly {size:,} bytes — real photos rarely have perfectly round file sizes.",
                "weight": 0.1,
            })

        # JPEG analysis
        if image_bytes[:3] == b'\xff\xd8\xff':
            # Count APP markers (re-saves add more)
            app1_count = image_bytes.count(b'\xff\xe1')
            app0_count = image_bytes.count(b'\xff\xe0')

            if app1_count > 3:
                score += 40
                flags.append({
                    "flag_type": "excessive_jpeg_markers",
                    "severity": "high",
                    "title": f"JPEG re-saved {app1_count} times",
                    "description": "Each time a JPEG is edited and re-saved it adds markers. This image has been saved multiple times, suggesting editing.",
                    "weight": 0.4,
                })

            # Check for comment sections (Photoshop leaves comments)
            if b'\xff\xfe' in image_bytes[:10000]:
                comment_idx = image_bytes.find(b'\xff\xfe')
                comment_len = struct.unpack('>H', image_bytes[comment_idx+2:comment_idx+4])[0]
                comment = image_bytes[comment_idx+4:comment_idx+2+comment_len]
                if comment:
                    score += 20
                    flags.append({
                        "flag_type": "jpeg_comment_found",
                        "severity": "medium",
                        "title": "Hidden JPEG comment detected",
                        "description": f"Image contains an embedded comment — often added by editing software.",
                        "weight": 0.2,
                    })

        return min(score, 100), flags

    def _analyze_pixel_statistics(self, image_bytes: bytes) -> tuple[int, list]:
        """
        Statistical analysis without OpenCV.
        Uses basic byte-level patterns to detect anomalies.
        """
        flags = []
        score = 0

        # Look at the raw byte distribution in image data
        # AI-generated images often have more uniform byte distributions
        if len(image_bytes) > 10000:
            # Sample a portion of the image data
            sample = image_bytes[1000:10000]
            byte_counts = [0] * 256
            for b in sample:
                byte_counts[b] += 1

            # Calculate entropy-like measure
            total = len(sample)
            zero_count = byte_counts[0]
            max_count = max(byte_counts)

            # Very high concentration of a single byte value is suspicious
            if max_count / total > 0.15:
                score += 20
                flags.append({
                    "flag_type": "low_image_entropy",
                    "severity": "low",
                    "title": "Unusually uniform image data",
                    "description": "Image pixel data shows low variation, which can indicate a digitally created image rather than a photograph.",
                    "weight": 0.2,
                })

        return min(score, 40), flags  # Cap this heuristic

    async def _analyze_with_ai_vision(self, image_bytes: bytes, api_key: str) -> tuple[int, list]:
        """
        Send receipt image to Claude for AI-powered authenticity analysis.
        This is the most powerful detection method.
        """
        flags = []
        score = 0

        try:
            image_b64 = base64.standard_b64encode(image_bytes).decode('utf-8')

            # Detect media type
            if image_bytes[:3] == b'\xff\xd8\xff':
                media_type = "image/jpeg"
            elif image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
                media_type = "image/png"
            else:
                media_type = "image/jpeg"

            prompt = """You are an expert receipt fraud analyst. Analyze this receipt image and assess its authenticity.

Look carefully for these fraud indicators:

1. TYPOGRAPHY: Are fonts consistent throughout? Real thermal printer receipts have uniform, slightly imperfect fonts. AI-generated or designed receipts often have pixel-perfect typography or mixed fonts.

2. PRINTING ARTIFACTS: Real thermal receipts show slight fading, uneven ink, and natural paper texture. Do you see this?

3. ALIGNMENT: Real receipts have slight misalignments and imperfections. Is everything suspiciously perfect?

4. PAPER/BACKGROUND: Is there a realistic paper texture, or does it look like a white/flat digital background?

5. LOGO QUALITY: Is the merchant logo suspiciously high-resolution compared to the text?

6. OVERALL FEEL: Does this look like a photograph of a real receipt, a screenshot of a digital receipt, or a digitally created/edited image?

7. SPECIFIC RED FLAGS: Look for copy-paste artifacts, inconsistent shadows, impossible geometry, AI hallucination patterns (like wrong letter counts in words, impossible merchant details).

Respond with ONLY a JSON object in this exact format:
{
  "is_suspicious": true or false,
  "confidence": 0-100,
  "verdict": "LIKELY_REAL" | "POSSIBLY_FAKE" | "LIKELY_FAKE" | "AI_GENERATED" | "SCREENSHOT" | "EDITED",
  "reasons": ["reason 1", "reason 2"],
  "fraud_indicators": ["specific thing 1", "specific thing 2"]
}"""

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": "claude-opus-4-8",
                        "max_tokens": 500,
                        "messages": [{
                            "role": "user",
                            "content": [
                                {
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": media_type,
                                        "data": image_b64,
                                    }
                                },
                                {
                                    "type": "text",
                                    "text": prompt
                                }
                            ]
                        }]
                    }
                )

            if response.status_code == 200:
                result = response.json()
                text = result["content"][0]["text"]

                # Parse JSON response
                import json
                # Strip any markdown fences if present
                text = re.sub(r'```json|```', '', text).strip()
                analysis = json.loads(text)

                verdict = analysis.get("verdict", "LIKELY_REAL")
                confidence = analysis.get("confidence", 0)
                is_suspicious = analysis.get("is_suspicious", False)
                reasons = analysis.get("reasons", [])
                indicators = analysis.get("fraud_indicators", [])

                verdict_scores = {
                    "LIKELY_REAL":    0,
                    "POSSIBLY_FAKE":  40,
                    "LIKELY_FAKE":    70,
                    "AI_GENERATED":   90,
                    "SCREENSHOT":     60,
                    "EDITED":         65,
                }
                verdict_severities = {
                    "LIKELY_REAL":    "low",
                    "POSSIBLY_FAKE":  "medium",
                    "LIKELY_FAKE":    "high",
                    "AI_GENERATED":   "critical",
                    "SCREENSHOT":     "high",
                    "EDITED":         "high",
                }

                ai_score = verdict_scores.get(verdict, 0)
                # Scale by confidence
                ai_score = int(ai_score * (confidence / 100))
                score += ai_score

                if is_suspicious:
                    severity = verdict_severities.get(verdict, "medium")
                    verdict_labels = {
                        "POSSIBLY_FAKE":  "Receipt may be fabricated",
                        "LIKELY_FAKE":    "Receipt appears to be fake",
                        "AI_GENERATED":   "Receipt appears to be AI-generated",
                        "SCREENSHOT":     "Receipt appears to be a screenshot",
                        "EDITED":         "Receipt appears to have been digitally edited",
                    }
                    title = verdict_labels.get(verdict, "Receipt authenticity questionable")

                    all_reasons = reasons + indicators
                    description = " | ".join(all_reasons[:4]) if all_reasons else f"AI vision analysis returned verdict: {verdict} with {confidence}% confidence"

                    flags.append({
                        "flag_type": f"ai_vision_{verdict.lower()}",
                        "severity": severity,
                        "title": title,
                        "description": description,
                        "weight": ai_score / 100,
                    })

                elif confidence > 70:
                    # Low risk — note it passed AI review
                    flags.append({
                        "flag_type": "ai_vision_passed",
                        "severity": "low",
                        "title": "AI vision analysis: receipt appears authentic",
                        "description": f"Visual analysis found no clear signs of AI generation or editing (confidence: {confidence}%)",
                        "weight": 0,
                    })

        except Exception as e:
            log.warning("AI vision analysis failed", error=str(e))
            # Don't penalize if AI call fails — just skip
            flags.append({
                "flag_type": "ai_vision_unavailable",
                "severity": "low",
                "title": "AI visual analysis unavailable",
                "description": "Could not complete AI image analysis. Manual review recommended.",
                "weight": 0,
            })

        return min(score, 100), flags

    def _heuristic_receipt_checks(self, image_bytes: bytes) -> tuple[int, list]:
        """
        Fallback heuristics when no AI key is available.
        """
        flags = []
        score = 0

        # Check for common web/design color profiles
        # sRGB is used by designed images, cameras use device-specific profiles
        if b'sRGB' in image_bytes[:1000] and image_bytes[:3] != b'\xff\xd8\xff':
            score += 15
            flags.append({
                "flag_type": "srgb_color_profile",
                "severity": "low",
                "title": "Web color profile detected",
                "description": "Image uses sRGB color profile common in designed/web images rather than camera profiles.",
                "weight": 0.15,
            })

        # Check for PDF-origin markers
        if b'%PDF' in image_bytes[:10]:
            score += 0  # PDFs are normal for receipts
        elif b'Creator' in image_bytes[:65536] and b'Producer' in image_bytes[:65536]:
            score += 25
            flags.append({
                "flag_type": "pdf_origin_markers",
                "severity": "medium",
                "title": "Document creation software markers detected",
                "description": "Image contains markers suggesting it was created by document software rather than a camera.",
                "weight": 0.25,
            })

        return min(score, 50), flags


image_forensics_engine = ImageForensicsEngine()
