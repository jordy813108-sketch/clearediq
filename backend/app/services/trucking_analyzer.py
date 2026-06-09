"""
cleaREDiq Trucking Intelligence Layer
Wraps the fuel verifier and adds fleet-level analytics:
- Per-driver fraud scores over time
- Fleet-wide anomaly detection
- Route vs receipt cross-reference
- Per-mile fuel consumption validation
"""
import structlog
from app.services.fuel_verifier import fuel_verifier

log = structlog.get_logger()

# Average miles per gallon by truck type (for consumption validation)
TRUCK_MPG = {
    "semi":         {"min": 4.5, "max": 8.0, "typical": 6.5},
    "18_wheeler":   {"min": 4.5, "max": 8.0, "typical": 6.5},
    "box_truck":    {"min": 8.0, "max": 15.0, "typical": 12.0},
    "pickup":       {"min": 14.0,"max": 22.0, "typical": 18.0},
    "sprinter":     {"min": 18.0,"max": 25.0, "typical": 20.0},
    "refrigerated": {"min": 4.0, "max": 7.0,  "typical": 5.5},
    "default":      {"min": 4.5, "max": 22.0, "typical": 8.0},
}


class TruckingAnalyzer:

    async def analyze_fuel_receipt(
        self,
        ocr_data: dict,
        truck_type: str = "semi",
        miles_since_last_fill: float = None,
        driver_route: list = None,
        fleet_receipts: list = None,
        google_api_key: str = "",
        eia_api_key: str = "",
    ) -> dict:
        """Full trucking receipt analysis."""

        # Run core fuel verification
        result = await fuel_verifier.verify(
            ocr_data=ocr_data,
            truck_type=truck_type,
            driver_route=driver_route,
            fleet_receipts=fleet_receipts,
            google_api_key=google_api_key,
            eia_api_key=eia_api_key,
        )

        flags = result["flags"]
        score = result["fuel_verification_score"]

        # Add MPG consumption check if we know miles driven
        if miles_since_last_fill and ocr_data.get("gallons_pumped"):
            gallons = ocr_data["gallons_pumped"]
            mpg_score, mpg_flags = self._verify_consumption(
                gallons, miles_since_last_fill, truck_type
            )
            score = min(100, score + mpg_score)
            flags.extend(mpg_flags)

        # Risk level
        risk = "CRITICAL" if score >= 75 else "HIGH" if score >= 55 else "MEDIUM" if score >= 30 else "LOW"

        return {
            "overall_score": score,
            "risk_level": risk,
            "flags": flags,
            "extracted_data": result["extracted_data"],
            "truck_type": truck_type,
            "miles_since_last_fill": miles_since_last_fill,
        }

    def _verify_consumption(
        self,
        gallons: float,
        miles: float,
        truck_type: str,
    ) -> tuple[int, list]:
        """Verify fuel consumption against expected MPG for truck type."""
        flags = []
        score  = 0

        if gallons <= 0 or miles <= 0:
            return 0, flags

        actual_mpg = miles / gallons
        expected   = TRUCK_MPG.get(
            truck_type.lower().replace(" ", "_"),
            TRUCK_MPG["default"]
        )

        if actual_mpg < expected["min"] * 0.6:
            score += 55
            flags.append({
                "flag_type": "impossible_fuel_consumption",
                "severity": "critical",
                "title": f"Fuel consumption physically impossible",
                "description": (
                    f"Claiming {gallons:.1f} gallons for {miles:.0f} miles = "
                    f"{actual_mpg:.1f} MPG. A {truck_type} gets {expected['min']}–"
                    f"{expected['max']} MPG. This consumption is physically impossible."
                ),
                "weight": 0.55,
            })
        elif actual_mpg < expected["min"]:
            score += 30
            flags.append({
                "flag_type": "high_fuel_consumption",
                "severity": "medium",
                "title": f"Fuel consumption below expected range",
                "description": (
                    f"{actual_mpg:.1f} MPG is below the expected {expected['min']}–"
                    f"{expected['max']} MPG range for a {truck_type}. "
                    f"Verify mileage and gallons are correct."
                ),
                "weight": 0.3,
            })
        elif actual_mpg > expected["max"] * 1.5:
            score += 25
            flags.append({
                "flag_type": "suspiciously_high_mpg",
                "severity": "medium",
                "title": f"Claimed fuel efficiency unusually high",
                "description": (
                    f"{actual_mpg:.1f} MPG is far above the {expected['max']} MPG "
                    f"maximum for a {truck_type}. Miles driven may be overstated."
                ),
                "weight": 0.25,
            })
        else:
            flags.append({
                "flag_type": "consumption_verified",
                "severity": "low",
                "title": "Fuel consumption within expected range",
                "description": f"{actual_mpg:.1f} MPG is consistent with a {truck_type} truck.",
                "weight": 0,
            })

        return score, flags


trucking_analyzer = TruckingAnalyzer()
