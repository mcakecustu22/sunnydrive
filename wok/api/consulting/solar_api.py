import requests
from django.conf import settings

SOLAR_API_BASE = "https://solar.googleapis.com/v1"

def get_building_insights(lat: float, lng: float) -> dict:
    """
    เรียก Google Solar API → buildingInsights endpoint
    Ref: developers.google.com/maps/documentation/solar/building-insights
    """
    params = {
        "location.latitude": lat,
        "location.longitude": lng,
        "requiredQuality": "HIGH",  # HIGH | MEDIUM | BASE
        "key": settings.GOOGLE_SOLAR_API_KEY,
    }
    resp = requests.get(f"{SOLAR_API_BASE}/buildingInsights:findClosest", params=params)
    resp.raise_for_status()
    return resp.json()