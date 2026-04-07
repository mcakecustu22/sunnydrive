# services/solar_calculator.py

import os
import requests
from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

EV_CONSUMPTION_DB = {
    "NETA V": 0.120,
    "BYD Dolphin": 0.130,
    "Tesla Model 3": 0.132,
    "ORA Good Cat": 0.140,
    "Tesla Model Y": 0.145,
    "MG4": 0.145,
    "AION Y Plus": 0.145,
    "BYD Atto 3": 0.150,
    "Deepal L07": 0.150,
    "MG EP": 0.155,
    "BYD Seal": 0.160,
    "Volvo EX30": 0.160,
    "Deepal S07": 0.165,
    "Zeekr X": 0.165,
}

DEFAULT_LOAD_PROFILE = {"day": 0.40, "evening": 0.35, "night": 0.25} 

SYSTEM_EFFICIENCY = 0.80
CHARGING_EFFICIENCY = 0.90
SOLAR_API_BASE = "https://solar.googleapis.com/v1"

# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------

@dataclass
class EVInput:
    model: str
    monthly_km: float = 1200.0
    custom_kwh_per_km: float | None = None
    is_included_in_bill: bool = True
    id: int | None = None  # frontend ส่งมา ไม่ใช้คำนวณ

@dataclass
class SolarPlanInput:
    monthly_bill_thb: float
    evs: list[EVInput]
    latitude: float
    longitude: float
    roof_score: float = 0.82
    electricity_rate: float = 4.4
    ice_gas_cost_month: float = 0.0

# ---------------------------------------------------------------------------
# Google Solar API
# ---------------------------------------------------------------------------

def get_building_insights(lat: float, lng: float) -> dict:
    api_key = os.getenv("GOOGLE_SOLAR_API_KEY", "").strip()
    if not api_key:
        return {"ok": False, "reason": "missing_api_key"}

    try:
        resp = requests.get(
            f"{SOLAR_API_BASE}/buildingInsights:findClosest",
            params={
                "location.latitude": lat,
                "location.longitude": lng,
                "requiredQuality": "HIGH",
                "key": api_key,
            },
            timeout=20,
        )
        resp.raise_for_status()
        return {"ok": True, "data": resp.json()}
    except requests.RequestException as exc:
        return {"ok": False, "reason": str(exc)}

def parse_solar_potential(building_insights: dict) -> dict:
    sp = building_insights["solarPotential"]
    return {
        "max_panels":           sp["maxArrayPanelsCount"],
        "max_area_m2":          sp["maxArrayAreaMeters2"],
        "max_sunshine_hrs":     sp["maxSunshineHoursPerYear"],
        "panel_capacity_w":     sp["panelCapacityWatts"],
        "panel_lifetime_yrs":   sp["panelLifetimeYears"],
        "carbon_offset_kg_mwh": sp["carbonOffsetFactorKgPerMwh"],
        "yearly_energy_dc_kwh": sp["solarPanelConfigs"][-1]["yearlyEnergyDcKwh"],
    }

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _infer_phase(system_kw: float) -> str:
    return "1 เฟส" if system_kw <= 5 else "3 เฟส"

def _calculate_monthly_ev_kwh(evs: list[EVInput]) -> tuple[float, float]:
    included = 0.0
    additional = 0.0

    for ev in evs or []:
        try:
            kwh_per_km = float(ev.custom_kwh_per_km) if ev.custom_kwh_per_km else 0.0
        except (TypeError, ValueError):
            kwh_per_km = 0.0

        if kwh_per_km <= 0:
            kwh_per_km = EV_CONSUMPTION_DB.get(ev.model, 0.150)

        try:
            monthly_km = float(ev.monthly_km) if float(ev.monthly_km) > 0 else 1200.0
        except (TypeError, ValueError):
            monthly_km = 1200.0

        ev_kwh = (monthly_km * kwh_per_km) / CHARGING_EFFICIENCY

        if ev.is_included_in_bill:
            included += ev_kwh
        else:
            additional += ev_kwh

    return included, additional

def _simulate_self_consumption(
    monthly_load_kwh: float,
    monthly_solar_kwh: float,
) -> dict:
    # ภาระการใช้ไฟฟ้าในแต่ละช่วงเวลา
    day_load     = monthly_load_kwh * DEFAULT_LOAD_PROFILE["day"]
    evening_load = monthly_load_kwh * DEFAULT_LOAD_PROFILE["evening"]
    night_load   = monthly_load_kwh * DEFAULT_LOAD_PROFILE["night"]

    # ถือว่าโซลาร์เซลล์ผลิตไฟในช่วงกลางวันทั้งหมด 100%
    self_used_day = min(day_load, monthly_solar_kwh)
    export_day    = max(monthly_solar_kwh - day_load, 0.0)
    import_day    = max(day_load - monthly_solar_kwh, 0.0)

    # รวมผลลัพธ์ (ช่วงเย็นและกลางคืนต้องซื้อไฟ 100%)
    self_used = self_used_day
    export    = export_day
    import_   = import_day + evening_load + night_load

    ratio = self_used / monthly_solar_kwh if monthly_solar_kwh > 0 else 0.0
    
    return {
        "self_used_kwh_month":    self_used,
        "export_kwh_month":       export,
        "import_kwh_month":       import_,
        "self_consumption_ratio": max(0.0, min(1.0, ratio)),
    }

# ---------------------------------------------------------------------------
# Main calculator
# ---------------------------------------------------------------------------

def estimate_solar_plan(
    payload: SolarPlanInput,
    building_insights: dict | None = None,
) -> dict:

    # ── 0. Base setup ────────────────────────────────────────────────────────
    rate = max(payload.electricity_rate, 0.1) if payload.electricity_rate > 0 else 4.4
    base_bill_kwh = payload.monthly_bill_thb / rate

    included_ev_kwh, additional_ev_kwh = _calculate_monthly_ev_kwh(payload.evs or [])
    total_ev_kwh = included_ev_kwh + additional_ev_kwh

    home_kwh       = max(base_bill_kwh - included_ev_kwh, 0.0)
    total_load_kwh = home_kwh + total_ev_kwh
    ice_gas_cost   = payload.ice_gas_cost_month

    # ── 1. Solar sizing ──────────────────────────────────────────────────────
    if building_insights and building_insights.get("ok"):
        solar_info = parse_solar_potential(building_insights["data"])
        monthly_gen_per_kw = (solar_info["max_sunshine_hrs"] / 12) * SYSTEM_EFFICIENCY
    else:
        solar_info = None
        roof_score = max(payload.roof_score, 0.55)
        monthly_gen_per_kw = 120 * roof_score

    system_kw          = max(2.0, round(total_load_kwh / monthly_gen_per_kw, 1))
    monthly_gen_kwh    = system_kw * monthly_gen_per_kw
    panels             = max(1, int(round((system_kw * 1000) / 550)))
    phase              = _infer_phase(system_kw)

    if solar_info and panels > solar_info["max_panels"]:
        panels    = solar_info["max_panels"]
        system_kw = round((panels * 550) / 1000, 1)
        monthly_gen_kwh = system_kw * monthly_gen_per_kw

    # ── 2. Install cost (Tiered pricing based on new packages) ───────────────
    # ตรวจสอบว่าเป็น Single Phase หรือ Three Phase จากตัวแปร phase
    is_single_phase = "single" in str(phase).lower() or str(phase) == "1"

    # source https://saimaisolar.com/services/
    if is_single_phase:
        if system_kw <= 4.0:
            install_cost = 98_000   # Package 3 KW (บ้านขนาดเล็ก)
        elif system_kw <= 7.5:
            install_cost = 128_000  # Package 5 KW (ยอดนิยม สำหรับบ้านทั่วไป)
        else:
            install_cost = 205_000  # Package 10 KW (บ้านขนาดใหญ่)
    else:
        if system_kw <= 7.5:
            install_cost = 150_000  # Package 5 KW (ธุรกิจขนาดเล็ก)
        elif system_kw <= 12.5:
            install_cost = 215_000  # Package 10 KW (ธุรกิจขนาดกลาง)
        elif system_kw <= 17.5:
            install_cost = 300_000  # Package 15 KW (ยอดนิยม สำหรับธุรกิจ)
        elif system_kw <= 25.0:
            install_cost = 380_000  # Package 20 KW (ธุรกิจขนาดใหญ่)
        else:
            install_cost = 520_000  # Package 30 KW (โรงงาน / อาคารพาณิชย์)

    # ── 3. Self-consumption simulation ───────────────────────────────────────
    flow = _simulate_self_consumption(total_load_kwh, monthly_gen_kwh)
    self_used_kwh = flow["self_used_kwh_month"]

    # ── 4. Bill savings ──────────────────────────────────────────────────────
    solar_for_ev   = min(self_used_kwh, total_ev_kwh)
    solar_for_home = max(self_used_kwh - solar_for_ev, 0.0)
    ev_grid_kwh    = max(total_ev_kwh - solar_for_ev, 0.0)
    ev_cost        = ev_grid_kwh * rate

    bill_load_kwh            = home_kwh + included_ev_kwh
    solar_for_bill           = min(solar_for_home, bill_load_kwh)
    monthly_saving_on_bill   = min(payload.monthly_bill_thb, solar_for_bill * rate)
    new_monthly_bill         = max(payload.monthly_bill_thb - monthly_saving_on_bill, 0.0)

    # ── 5. Total savings ─────────────────────────────────────────────────────
    total_expense_before   = payload.monthly_bill_thb + ice_gas_cost
    total_expense_after    = new_monthly_bill + ev_cost
    total_savings_month    = total_expense_before - total_expense_after
    saving_additional_ev   = max(total_savings_month - monthly_saving_on_bill, 0.0)

    # ── 6. Simple Break-even Calculation ─────────────────────────────────────
    annual_savings = total_savings_month * 12
    break_even = (install_cost / annual_savings) if annual_savings > 0 else 0.0

    # ── 8. Return ────────────────────────────────────────────────────────────
    bill_reduction_pct = round((monthly_saving_on_bill / payload.monthly_bill_thb) * 100, 1) if payload.monthly_bill_thb > 0 else 0

    return {
        # -- Core technical --
        "system_kw":             system_kw,
        "monthly_generation_kwh": round(monthly_gen_kwh, 0),
        "install_cost":          install_cost,
        "panels":                panels,
        "phase":                 phase,

        # -- Financials --
        "new_monthly_bill":      int(new_monthly_bill),
        "ev_cost_month":         int(ev_cost),
        "total_expense_before":  int(total_expense_before),
        "total_expense_after":   int(total_expense_after),
        "total_savings_month":   int(total_savings_month),
        "break_even_years":      round(break_even, 1),
        "roi_range":             f"{max(0, round(break_even - 0.4, 1))} - {round(break_even + 0.6, 1)}",

        # -- Frontend aliases --
        "estimated_monthly_saving_thb":               int(total_savings_month),
        "estimated_monthly_saving_on_bill_thb":       int(monthly_saving_on_bill),
        "estimated_monthly_saving_additional_ev_thb": int(saving_additional_ev),
        "estimated_monthly_bill_after_solar_thb":     int(new_monthly_bill),
        "estimated_install_cost_thb":                 install_cost,
        "estimated_break_even_years":                 round(break_even, 1),
        "estimated_break_even_month":                 round(break_even * 12, 1),
        "estimated_annual_saving_thb":                int(monthly_saving_on_bill * 12),
        "estimated_annual_saving_total_thb":          int(total_savings_month * 12),
        "estimated_bill_reduction_percent":           bill_reduction_pct,
        "recommended_panels":                         panels,
        "recommended_phase":                          phase,
        "milestones": [
            {"month": 1, "title": "ติดตั้งเสร็จสมบูรณ์"},
            {"month": 2, "title": "เริ่มเห็นบิลลดลง"},
            {"month": 3, "title": "เริ่มชาร์จ EV ที่บ้าน"},
            {"month": max(4, int(break_even * 12)), "title": f"คืนทุนภายใน {round(break_even, 1)} ปี"},
        ],
    }