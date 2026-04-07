from rest_framework.response import Response
from rest_framework.views import APIView


from .services import EV_CONSUMPTION_DB, EVInput, SolarPlanInput, estimate_solar_plan, get_building_insights

def _to_float(value, default: float) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_float_or_none(value):
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_bool(value, default: bool = True) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        v = value.strip().lower()
        if v in {"true", "1", "yes", "y", "on"}:
            return True
        if v in {"false", "0", "no", "n", "off"}:
            return False
    return default


class EVModelsView(APIView):
    def get(self, request):
        return Response({"models": sorted(EV_CONSUMPTION_DB.keys())})


class AnalyzePlanView(APIView):
    def post(self, request):
        data = request.data
        evs_data = data.get("evs", [])

        evs = [
            EVInput(
                model=str(ev.get("model") or ""),
                monthly_km=_to_float(ev.get("monthly_km"), 1200.0),
                custom_kwh_per_km=_to_float_or_none(ev.get("custom_kwh_per_km")),
                is_included_in_bill=_to_bool(ev.get("is_included_in_bill"), True),
            )
            for ev in evs_data
        ]

        payload = SolarPlanInput(
            monthly_bill_thb=_to_float(data.get("monthly_bill_thb"), 0.0),
            evs=evs,
            latitude=_to_float(data.get("latitude"), 13.7563),
            longitude=_to_float(data.get("longitude"), 100.5018),
            roof_score=_to_float(data.get("roof_score"), 0.82),
            electricity_rate=_to_float(data.get("electricity_rate"), 4.4),
        )
        solar_layers = get_building_insights(
            lat=payload.latitude,   # Change 'latitude' to 'lat'
            lng=payload.longitude   # Change 'longitude' to 'lng'
        )

        result = estimate_solar_plan(payload, building_insights=solar_layers)
        return Response(result)
        