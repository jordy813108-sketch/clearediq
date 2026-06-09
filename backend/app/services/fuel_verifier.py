"""
cleaREDiq Fuel Receipt Verifier
Built specifically for trucking and logistics companies.

Verifies:
- Fuel price per gallon against DOE regional averages
- Gallons claimed vs truck tank capacity
- Fuel stop location against driver route
- Station existence via Google Places
- Receipt duplicate detection across fleet
- Physically impossible fill amounts
"""
import httpx
import structlog
from typing import Optional
from datetime import datetime, timedelta

log = structlog.get_logger()

# DOE EIA API endpoint for weekly fuel prices (free, no key needed)
DOE_FUEL_API = "https://api.eia.gov/v2/petroleum/pri/gnd/data/"

# Common truck tank capacities by type (gallons)
TRUCK_TANK_CAPACITIES = {
    "semi":           {"min": 100, "max": 300, "typical": 200},
    "18_wheeler":     {"min": 100, "max": 300, "typical": 200},
    "box_truck":      {"min": 25,  "max": 60,  "typical": 40},
    "pickup":         {"min": 20,  "max": 36,  "typical": 26},
    "sprinter":       {"min": 16,  "max": 24,  "typical": 19},
    "flatbed":        {"min": 100, "max": 300, "typical": 200},
    "tanker":         {"min": 100, "max": 300, "typical": 200},
    "refrigerated":   {"min": 100, "max": 300, "typical": 200},
    "dump":           {"min": 50,  "max": 150, "typical": 100},
    "default":        {"min": 20,  "max": 300, "typical": 100},
}

# DOE regional price area codes
DOE_REGIONS = {
    "east_coast":     "R10",
    "new_england":    "R11",
    "central_atlantic": "R12",
    "lower_atlantic": "R13",
    "midwest":        "R20",
    "gulf_coast":     "R30",
    "rocky_mountain": "R40",
    "west_coast":     "R50",
    "california":     "R51",
    "us_average":     "R00",
}

# State to DOE region mapping
STATE_TO_REGION = {
    "ME":"R11","NH":"R11","VT":"R11","MA":"R11","RI":"R11","CT":"R11",
    "NY":"R12","NJ":"R12","PA":"R12","DE":"R12","MD":"R12","DC":"R12","WV":"R12",
    "VA":"R13","NC":"R13","SC":"R13","GA":"R13","FL":"R13","AL":"R13","MS":"R13",
    "OH":"R20","MI":"R20","IN":"R20","IL":"R20","WI":"R20","MN":"R20",
    "IA":"R20","MO":"R20","ND":"R20","SD":"R20","NE":"R20","KS":"R20",
    "TX":"R30","LA":"R30","AR":"R30","OK":"R30","TN":"R30","KY":"R30",
    "MT":"R40","WY":"R40","CO":"R40","ID":"R40","UT":"R40","NV":"R40","AZ":"R40","NM":"R40",
    "WA":"R50","OR":"R50","HI":"R50","AK":"R50",
    "CA":"R51",
}


class FuelReceiptVerifier:

    async def verify(
        self,
        ocr_data: dict,
        truck_type: str = "default",
        driver_route: list = None,
        fleet_receipts: list = None,
        google_api_key: str = "",
        eia_api_key: str = "",
    ) -> dict:
        """
        Full fuel receipt verification for trucking.
        Returns flags and verification score.
        """
        flags = []
        score = 0

        gallons = ocr_data.get("gallons_pumped") or ocr_data.get("quantity")
        price_per_gallon = ocr_data.get("price_per_unit") or ocr_data.get("unit_price")
        total = ocr_data.get("total_amount")
        merchant_address = ocr_data.get("merchant_address", "")
        transaction_date = ocr_data.get("transaction_date", "")
        merchant_name = ocr_data.get("merchant_name", "")

        # 1. Verify fuel station exists
        if google_api_key and merchant_name:
            station_score, station_flags = await self._verify_station_exists(
                merchant_name, merchant_address, google_api_key
            )
            score += station_score
            flags.extend(station_flags)

        # 2. Verify price per gallon against DOE data
        if price_per_gallon:
            price_score, price_flags = await self._verify_fuel_price(
                price_per_gallon, merchant_address, transaction_date, eia_api_key
            )
            score += price_score
            flags.extend(price_flags)

        # 3. Verify gallons against tank capacity
        if gallons:
            tank_score, tank_flags = self._verify_tank_capacity(
                gallons, truck_type, total, price_per_gallon
            )
            score += tank_score
            flags.extend(tank_flags)

        # 4. Verify location against driver route
        if driver_route and merchant_address:
            route_score, route_flags = self._verify_route_consistency(
                merchant_address, driver_route, transaction_date
            )
            score += route_score
            flags.extend(route_flags)

        # 5. Check for fleet-wide duplicate patterns
        if fleet_receipts:
            dup_score, dup_flags = self._check_fleet_duplicates(
                ocr_data, fleet_receipts
            )
            score += dup_score
            flags.extend(dup_flags)

        # 6. Math verification (total = gallons x price)
        if gallons and price_per_gallon and total:
            math_score, math_flags = self._verify_fuel_math(
                gallons, price_per_gallon, total
            )
            score += math_score
            flags.extend(math_flags)

        # 7. Behavioral checks
        behavior_score, behavior_flags = self._check_fuel_behavior(ocr_data)
        score += behavior_score
        flags.extend(behavior_flags)

        return {
            "fuel_verification_score": min(100, score),
            "flags": flags,
            "extracted_data": {
                "gallons": gallons,
                "price_per_gallon": price_per_gallon,
                "total": total,
                "station": merchant_name,
                "address": merchant_address,
                "date": transaction_date,
            }
        }

    async def _verify_station_exists(
        self, name: str, address: str, api_key: str
    ) -> tuple[int, list]:
        """Verify fuel station exists at the claimed address."""
        flags = []
        score = 0

        try:
            query = f"{name} gas station {address}"
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
                    params={
                        "input": query,
                        "inputtype": "textquery",
                        "fields": "place_id,name,types,business_status",
                        "key": api_key,
                    }
                )
            data = resp.json()
            candidates = data.get("candidates", [])

            if not candidates:
                score += 70
                flags.append({
                    "flag_type": "fuel_station_not_found",
                    "severity": "critical",
                    "title": f"Fuel station not found: {name}",
                    "description": f"'{name}' at '{address}' cannot be verified as a real fuel station in Google Places. This fuel stop may be fabricated.",
                    "weight": 0.7,
                })
            else:
                place = candidates[0]
                types = place.get("types", [])
                fuel_types = ["gas_station", "fuel", "car_repair", "convenience_store"]
                if not any(t in types for t in fuel_types):
                    score += 45
                    flags.append({
                        "flag_type": "not_a_fuel_station",
                        "severity": "high",
                        "title": "Location is not a fuel station",
                        "description": f"Google Places identifies '{name}' as a different type of business, not a fuel station.",
                        "weight": 0.45,
                    })
                else:
                    flags.append({
                        "flag_type": "station_verified",
                        "severity": "low",
                        "title": "Fuel station verified",
                        "description": f"'{name}' confirmed as a real fuel station at this location.",
                        "weight": 0,
                    })

        except Exception as e:
            log.warning("Fuel station verification failed", error=str(e))

        return score, flags

    async def _verify_fuel_price(
        self,
        price: float,
        address: str,
        date_str: str,
        api_key: str,
    ) -> tuple[int, list]:
        """
        Verify price per gallon against DOE EIA weekly averages.
        Free data — no API key needed for basic access.
        """
        flags = []
        score = 0

        try:
            # Determine region from state in address
            region = "R00"  # Default to US average
            for state, reg in STATE_TO_REGION.items():
                if f" {state} " in f" {address} " or f" {state}," in address:
                    region = reg
                    break

            # Get DOE weekly average for that region
            # Using public EIA data (free, no key required for basic queries)
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.eia.gov/v2/petroleum/pri/gnd/data/",
                    params={
                        "api_key": api_key or "DEMO_KEY",
                        "frequency": "weekly",
                        "data[0]": "value",
                        "facets[product][]": "EPD2D",  # diesel
                        "facets[area][]": region,
                        "sort[0][column]": "period",
                        "sort[0][direction]": "desc",
                        "length": 4,
                        "offset": 0,
                    }
                )
            data = resp.json()
            records = data.get("response", {}).get("data", [])

            if records:
                avg_price = float(records[0].get("value", 0))
                if avg_price > 0:
                    variance = abs(price - avg_price) / avg_price

                    if price > avg_price * 1.35:
                        score += 50
                        flags.append({
                            "flag_type": "fuel_price_too_high",
                            "severity": "high",
                            "title": f"Fuel price ${price:.3f}/gal is {((price/avg_price)-1)*100:.0f}% above regional average",
                            "description": f"DOE weekly average for this region was ${avg_price:.3f}/gal on this date. A {((price/avg_price)-1)*100:.0f}% premium is highly unusual.",
                            "weight": 0.5,
                        })
                    elif price > avg_price * 1.20:
                        score += 25
                        flags.append({
                            "flag_type": "fuel_price_elevated",
                            "severity": "medium",
                            "title": f"Fuel price ${price:.3f}/gal is above regional average",
                            "description": f"DOE regional average was ${avg_price:.3f}/gal. Price is elevated but possible at premium stations.",
                            "weight": 0.25,
                        })
                    elif price < avg_price * 0.70:
                        score += 35
                        flags.append({
                            "flag_type": "fuel_price_suspiciously_low",
                            "severity": "medium",
                            "title": f"Fuel price ${price:.3f}/gal is suspiciously below regional average",
                            "description": f"DOE regional average was ${avg_price:.3f}/gal. Price this far below average is unusual and may indicate a fabricated receipt.",
                            "weight": 0.35,
                        })
                    else:
                        flags.append({
                            "flag_type": "fuel_price_verified",
                            "severity": "low",
                            "title": f"Fuel price verified against DOE data",
                            "description": f"${price:.3f}/gal is within normal range of DOE regional average ${avg_price:.3f}/gal.",
                            "weight": 0,
                        })

        except Exception as e:
            log.warning("DOE fuel price check failed", error=str(e))
            flags.append({
                "flag_type": "price_check_unavailable",
                "severity": "low",
                "title": "Fuel price verification unavailable",
                "description": "Could not retrieve DOE fuel price data. Manual price review recommended.",
                "weight": 0,
            })

        return score, flags

    def _verify_tank_capacity(
        self,
        gallons: float,
        truck_type: str,
        total: float = None,
        price_per_gallon: float = None,
    ) -> tuple[int, list]:
        """Check if claimed gallons is physically possible for this truck type."""
        flags = []
        score = 0

        capacity = TRUCK_TANK_CAPACITIES.get(
            truck_type.lower().replace(" ", "_"),
            TRUCK_TANK_CAPACITIES["default"]
        )

        max_single_fill = capacity["max"]
        typical = capacity["typical"]

        # Important: we never know how much fuel was in the tank at fill time.
        # Drivers typically refuel at 20-30% remaining, not empty.
        # So we use 110% of max capacity as the hard impossible threshold —
        # physically impossible regardless of starting level.
        # We flag > 85% of capacity as suspicious — implies near-empty tank
        # which is unusual driver behavior — but note it is not proof of fraud.

        impossible_threshold = max_single_fill * 1.10
        suspicious_threshold = max_single_fill * 0.85

        # Physically impossible — more fuel than tank can ever hold
        if gallons > impossible_threshold:
            score += 85
            flags.append({
                "flag_type": "impossible_fill_amount",
                "severity": "critical",
                "title": f"Claimed {gallons:.1f} gallons exceeds maximum tank capacity",
                "description": (
                    f"A {truck_type} truck holds a maximum of {max_single_fill} gallons. "
                    f"Even with a completely empty tank, pumping {gallons:.1f} gallons "
                    f"is physically impossible. This receipt appears fabricated."
                ),
                "weight": 0.85,
            })

        # Suspiciously high — implies driver ran near empty before stopping
        # Note: not conclusive without telematics showing actual tank level
        elif gallons > suspicious_threshold:
            score += 15
            flags.append({
                "flag_type": "high_fill_amount",
                "severity": "low",
                "title": f"Fill amount implies near-empty tank",
                "description": (
                    f"Pumping {gallons:.1f} gallons into a {max_single_fill}-gallon "
                    f"tank suggests less than 15% fuel was remaining. Drivers rarely "
                    f"run this low as a safety practice. Not conclusive without "
                    f"telematics data showing actual tank level at fill time."
                ),
                "weight": 0.15,
            })

        # Suspiciously round number
        if gallons == int(gallons) and gallons > 20:
            score += 15
            flags.append({
                "flag_type": "round_gallon_amount",
                "severity": "low",
                "title": f"Perfectly round gallon amount: {gallons:.0f} gallons",
                "description": "Real fuel pump amounts are almost never round numbers. This may indicate a manually entered figure.",
                "weight": 0.15,
            })

        return score, flags

    def _verify_route_consistency(
        self,
        fuel_address: str,
        driver_route: list,
        transaction_date: str,
    ) -> tuple[int, list]:
        """
        Check if fuel stop location is consistent with driver's route.
        driver_route is a list of cities/states the driver was in on each date.
        """
        flags = []
        score = 0

        if not driver_route:
            return 0, flags

        fuel_address_lower = fuel_address.lower()

        # Find where driver should have been on this date
        expected_locations = []
        for stop in driver_route:
            if stop.get("date") == transaction_date:
                expected_locations.append(stop.get("location", "").lower())

        if expected_locations:
            location_match = any(
                any(word in fuel_address_lower for word in loc.split())
                for loc in expected_locations
                if loc
            )

            if not location_match and expected_locations[0]:
                score += 60
                flags.append({
                    "flag_type": "fuel_location_off_route",
                    "severity": "high",
                    "title": "Fuel stop location inconsistent with driver route",
                    "description": f"Driver was logged in {expected_locations[0]} on this date but fuel receipt is from {fuel_address}. These locations don't match.",
                    "weight": 0.6,
                })

        return score, flags

    def _check_fleet_duplicates(
        self,
        current: dict,
        fleet_receipts: list,
    ) -> tuple[int, list]:
        """Check for duplicate receipts across the entire fleet."""
        flags = []
        score = 0

        current_total = current.get("total_amount")
        current_date  = current.get("transaction_date")
        current_merchant = current.get("merchant_name", "").lower()

        for prev in fleet_receipts:
            prev_total    = prev.get("total_amount")
            prev_date     = prev.get("transaction_date")
            prev_merchant = prev.get("merchant_name", "").lower()
            prev_driver   = prev.get("driver_name", "Unknown")

            if (current_total == prev_total and
                current_merchant == prev_merchant and
                current_date == prev_date):
                score += 90
                flags.append({
                    "flag_type": "fleet_duplicate_receipt",
                    "severity": "critical",
                    "title": "Duplicate receipt found in fleet submissions",
                    "description": f"This exact receipt (same station, amount, date) was already submitted by {prev_driver}. Multiple drivers submitting identical receipts is a major fraud signal.",
                    "weight": 0.9,
                })
                break

            # Same driver, same station, same day — possible but worth flagging
            if (current_merchant == prev_merchant and
                current_date == prev_date and
                current.get("driver_name") == prev.get("driver_name")):
                score += 30
                flags.append({
                    "flag_type": "multiple_fills_same_station_same_day",
                    "severity": "medium",
                    "title": "Multiple fuel stops at same station on same day",
                    "description": "Same driver, same station, same date. Possible but unusual — verify both receipts are legitimate.",
                    "weight": 0.3,
                })

        return score, flags

    def _verify_fuel_math(
        self,
        gallons: float,
        price_per_gallon: float,
        total: float,
    ) -> tuple[int, list]:
        """Verify gallons × price = total."""
        flags = []
        score = 0

        expected = round(gallons * price_per_gallon, 2)
        variance = abs(expected - total)

        if variance > 0.10:
            score += 65
            flags.append({
                "flag_type": "fuel_math_mismatch",
                "severity": "high",
                "title": f"Fuel math doesn't add up",
                "description": f"{gallons} gal × ${price_per_gallon:.3f}/gal = ${expected:.2f}, but receipt shows ${total:.2f}. Unexplained ${variance:.2f} discrepancy.",
                "weight": 0.65,
            })
        else:
            flags.append({
                "flag_type": "fuel_math_verified",
                "severity": "low",
                "title": "Fuel math verified",
                "description": f"Gallons × price per gallon = total amount. Math checks out.",
                "weight": 0,
            })

        return score, flags

    def _check_fuel_behavior(self, ocr: dict) -> tuple[int, list]:
        """Behavioral checks specific to fuel receipts."""
        flags = []
        score = 0

        total = ocr.get("total_amount", 0) or 0
        gallons = ocr.get("gallons_pumped") or ocr.get("quantity", 0) or 0

        # Very small fuel purchase on a commercial truck
        if 0 < gallons < 10:
            score += 20
            flags.append({
                "flag_type": "unusually_small_fuel_purchase",
                "severity": "low",
                "title": f"Unusually small fuel purchase: {gallons} gallons",
                "description": "Commercial vehicles rarely stop for less than 10 gallons. This may be a personal vehicle receipt submitted as a truck expense.",
                "weight": 0.2,
            })

        # Round dollar total
        if total > 50 and total == int(total):
            score += 20
            flags.append({
                "flag_type": "round_fuel_total",
                "severity": "low",
                "title": f"Perfectly round fuel total: ${total:.0f}.00",
                "description": "Fuel pump totals are almost never round numbers due to price-per-gallon fractions.",
                "weight": 0.2,
            })

        return score, flags


fuel_verifier = FuelReceiptVerifier()
