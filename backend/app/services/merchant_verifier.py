"""
cleaREDiq Merchant Address Verifier
Uses Google Places API to verify:
- Does this business actually exist?
- Is it at the address on the receipt?
- Is the business type consistent with the expense?
- Is this a residential address?
- Does the location match where the employee was?
"""
import httpx
import structlog
from typing import Optional

log = structlog.get_logger()

# Business types that are suspicious for expense receipts
SUSPICIOUS_TYPES = [
    "cemetery", "funeral_home", "casino", "night_club", "bar",
    "liquor_store", "adult", "tattoo", "nail_salon", "hair_care",
]

# Business types that are common for legitimate expenses
LEGITIMATE_TYPES = [
    "restaurant", "cafe", "hotel", "lodging", "airport", "gas_station",
    "parking", "car_rental", "store", "supermarket", "electronics_store",
    "office_supply", "hardware_store", "pharmacy", "book_store",
    "shopping_mall", "transit_station", "taxi", "travel_agency",
]


class MerchantVerifier:

    async def verify(
        self,
        merchant_name: str,
        merchant_address: str,
        google_api_key: str,
        expense_category: str = "",
        employee_location: str = "",
    ) -> dict:
        """
        Full merchant verification pipeline.
        Returns flags and a verification score (0-100, higher = more suspicious).
        """
        flags = []
        score = 0

        if not google_api_key:
            return {
                "verification_score": 0,
                "flags": [{
                    "flag_type": "no_google_key",
                    "severity": "low",
                    "title": "Address verification unavailable",
                    "description": "Google Places API key not configured. Add GOOGLE_PLACES_API_KEY to enable address verification.",
                    "weight": 0,
                }],
                "place_details": None,
            }

        if not merchant_name and not merchant_address:
            return {
                "verification_score": 30,
                "flags": [{
                    "flag_type": "no_merchant_info",
                    "severity": "medium",
                    "title": "No merchant information to verify",
                    "description": "Receipt contains no merchant name or address — cannot verify legitimacy.",
                    "weight": 0.3,
                }],
                "place_details": None,
            }

        # Step 1: Search for the business
        place_result = await self._search_place(merchant_name, merchant_address, google_api_key)

        if not place_result:
            score += 65
            flags.append({
                "flag_type": "business_not_found",
                "severity": "high",
                "title": "Business not found in Google Places",
                "description": f"'{merchant_name}' at '{merchant_address}' could not be verified as a real business. May be fabricated.",
                "weight": 0.65,
            })
            return {"verification_score": score, "flags": flags, "place_details": None}

        # Step 2: Get full place details
        place_details = await self._get_place_details(place_result["place_id"], google_api_key)

        # Step 3: Run verification checks
        addr_score, addr_flags = self._verify_address_match(
            merchant_address, place_result, place_details
        )
        score += addr_score
        flags.extend(addr_flags)

        type_score, type_flags = self._verify_business_type(
            place_details, expense_category
        )
        score += type_score
        flags.extend(type_flags)

        residential_score, residential_flags = self._check_residential(place_details)
        score += residential_score
        flags.extend(residential_flags)

        status_score, status_flags = self._check_business_status(place_details)
        score += status_score
        flags.extend(status_flags)

        rating_score, rating_flags = self._check_business_legitimacy(place_details)
        score += rating_score
        flags.extend(rating_flags)

        if employee_location:
            loc_score, loc_flags = self._check_location_consistency(
                place_details, employee_location
            )
            score += loc_score
            flags.extend(loc_flags)

        # If we found the business and no flags, add a pass note
        if not flags:
            flags.append({
                "flag_type": "address_verified",
                "severity": "low",
                "title": "Merchant address verified",
                "description": f"'{merchant_name}' confirmed as a real business at this location via Google Places.",
                "weight": 0,
            })

        return {
            "verification_score": min(100, score),
            "flags": flags,
            "place_details": {
                "name": place_details.get("name"),
                "formatted_address": place_details.get("formatted_address"),
                "place_id": place_result["place_id"],
                "rating": place_details.get("rating"),
                "user_ratings_total": place_details.get("user_ratings_total"),
                "business_status": place_details.get("business_status"),
                "types": place_details.get("types", []),
                "geometry": place_details.get("geometry", {}).get("location"),
                "phone": place_details.get("formatted_phone_number"),
                "website": place_details.get("website"),
            } if place_details else None,
        }

    async def _search_place(self, name: str, address: str, api_key: str) -> Optional[dict]:
        """Search Google Places for a business."""
        query = f"{name} {address}".strip()
        if not query:
            return None

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
                    params={
                        "input": query,
                        "inputtype": "textquery",
                        "fields": "place_id,name,formatted_address,geometry,types,business_status",
                        "key": api_key,
                    }
                )
            data = resp.json()
            candidates = data.get("candidates", [])
            return candidates[0] if candidates else None
        except Exception as e:
            log.warning("Google Places search failed", error=str(e))
            return None

    async def _get_place_details(self, place_id: str, api_key: str) -> dict:
        """Get full details for a place."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://maps.googleapis.com/maps/api/place/details/json",
                    params={
                        "place_id": place_id,
                        "fields": "name,formatted_address,geometry,types,business_status,rating,user_ratings_total,formatted_phone_number,website,address_components",
                        "key": api_key,
                    }
                )
            data = resp.json()
            return data.get("result", {})
        except Exception as e:
            log.warning("Google Places details failed", error=str(e))
            return {}

    def _verify_address_match(self, submitted_address: str, place_result: dict, place_details: dict) -> tuple[int, list]:
        """Check if submitted address matches Google's verified address."""
        flags = []
        score = 0

        if not submitted_address:
            return 0, flags

        google_address = (place_details.get("formatted_address") or
                         place_result.get("formatted_address") or "")

        if not google_address:
            return 0, flags

        # Extract key parts — city, state, zip
        submitted_lower = submitted_address.lower()
        google_lower = google_address.lower()

        # Check for major mismatches
        components = place_details.get("address_components", [])
        google_city = ""
        google_state = ""
        google_zip = ""

        for comp in components:
            types = comp.get("types", [])
            if "locality" in types:
                google_city = comp["long_name"].lower()
            elif "administrative_area_level_1" in types:
                google_state = comp["short_name"].lower()
            elif "postal_code" in types:
                google_zip = comp["long_name"]

        # City mismatch
        if google_city and google_city not in submitted_lower:
            score += 40
            flags.append({
                "flag_type": "city_mismatch",
                "severity": "high",
                "title": "Receipt city doesn't match verified business location",
                "description": f"Receipt shows '{submitted_address}' but Google Places confirms this business is in {google_city.title()}.",
                "weight": 0.4,
            })

        # State mismatch
        elif google_state and google_state not in submitted_lower:
            score += 35
            flags.append({
                "flag_type": "state_mismatch",
                "severity": "high",
                "title": "Receipt state doesn't match verified business location",
                "description": f"Address state on receipt doesn't match Google's verified location ({google_state.upper()}).",
                "weight": 0.35,
            })

        return score, flags

    def _verify_business_type(self, place_details: dict, expense_category: str) -> tuple[int, list]:
        """Check if business type is consistent with the expense."""
        flags = []
        score = 0

        types = place_details.get("types", [])
        if not types:
            return 0, flags

        # Check for suspicious business types for expense claims
        for suspicious in SUSPICIOUS_TYPES:
            if suspicious in types:
                score += 50
                flags.append({
                    "flag_type": "suspicious_business_type",
                    "severity": "high",
                    "title": f"Unusual business type for an expense receipt",
                    "description": f"Google Places identifies this as a '{suspicious.replace('_', ' ')}' — unusual for a business expense.",
                    "weight": 0.5,
                })
                break

        return score, flags

    def _check_residential(self, place_details: dict) -> tuple[int, list]:
        """Check if the address is residential."""
        flags = []
        score = 0

        types = place_details.get("types", [])
        address = place_details.get("formatted_address", "").lower()

        residential_indicators = [
            "premise", "subpremise", "street_address", "neighborhood"
        ]

        is_residential = any(t in types for t in residential_indicators)
        has_apt = any(word in address for word in ["apt", "apartment", "unit", "suite #", "# "])

        if is_residential and not any(t in types for t in ["store", "restaurant", "establishment"]):
            score += 55
            flags.append({
                "flag_type": "residential_address",
                "severity": "high",
                "title": "Receipt address appears to be residential",
                "description": "Google Places identifies this address as a residence, not a commercial business. Highly suspicious for an expense receipt.",
                "weight": 0.55,
            })

        return score, flags

    def _check_business_status(self, place_details: dict) -> tuple[int, list]:
        """Check if the business is still open."""
        flags = []
        score = 0

        status = place_details.get("business_status", "")

        if status == "CLOSED_PERMANENTLY":
            score += 60
            flags.append({
                "flag_type": "business_permanently_closed",
                "severity": "high",
                "title": "Business is permanently closed",
                "description": "Google Places shows this business as permanently closed. A receipt from a closed business is highly suspicious.",
                "weight": 0.6,
            })
        elif status == "CLOSED_TEMPORARILY":
            score += 25
            flags.append({
                "flag_type": "business_temporarily_closed",
                "severity": "medium",
                "title": "Business is temporarily closed",
                "description": "This business is currently closed according to Google Places. Verify the receipt date.",
                "weight": 0.25,
            })

        return score, flags

    def _check_business_legitimacy(self, place_details: dict) -> tuple[int, list]:
        """Use ratings as a legitimacy signal — fake businesses have no reviews."""
        flags = []
        score = 0

        rating = place_details.get("rating")
        review_count = place_details.get("user_ratings_total", 0)

        # Real established businesses have reviews
        # A brand new or fake listing has zero
        if review_count == 0 and rating is None:
            score += 20
            flags.append({
                "flag_type": "no_reviews",
                "severity": "low",
                "title": "Business has no reviews or rating",
                "description": "This business has no Google reviews — may be a new, inactive, or falsely listed business.",
                "weight": 0.2,
            })

        return score, flags

    def _check_location_consistency(self, place_details: dict, employee_location: str) -> tuple[int, list]:
        """Check if business location is consistent with where employee was."""
        flags = []
        score = 0

        google_address = place_details.get("formatted_address", "").lower()
        employee_loc = employee_location.lower()

        if not google_address or not employee_loc:
            return 0, flags

        # Simple city/state check
        employee_words = set(employee_loc.replace(",", "").split())
        address_words = set(google_address.replace(",", "").split())

        overlap = employee_words & address_words
        if len(overlap) == 0 and len(employee_words) > 1:
            score += 45
            flags.append({
                "flag_type": "location_inconsistency",
                "severity": "high",
                "title": "Receipt location doesn't match employee's reported location",
                "description": f"Employee reported being in '{employee_location}' but this receipt is from a business in a different location.",
                "weight": 0.45,
            })

        return score, flags


merchant_verifier = MerchantVerifier()
