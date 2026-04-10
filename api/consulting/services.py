import os
import io
import base64
import requests
import numpy as np
import rasterio
import matplotlib.pyplot as plt
from PIL import Image
from dataclasses import dataclass

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

EV_CONSUMPTION_DB = {
    "NETA V": 0.120, "BYD Dolphin": 0.130, "Tesla Model 3": 0.132,
    "ORA Good Cat": 0.140, "Tesla Model Y": 0.145, "MG4": 0.145,
    "AION Y Plus": 0.145, "BYD Atto 3": 0.150, "Deepal L07": 0.150,
    "MG EP": 0.155, "BYD Seal": 0.160, "Volvo EX30": 0.160,
    "Deepal S07": 0.165, "Zeekr X": 0.165,
}

HOME_LOAD_PROFILE = {"day": 0.40, "evening": 0.35, "night": 0.25}
EV_CHARGING_PROFILE = {"day": 0.90, "night": 0.10}

SYSTEM_EFFICIENCY = 0.80
CHARGING_EFFICIENCY = 0.90
BASE_FEE = 38.22

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
# Google Solar API (Data Fetching)
# ---------------------------------------------------------------------------
api_key = os.getenv("GOOGLE_SOLAR_API_KEY", "").strip()
def get_building_insights(lat: float, lng: float) -> dict:
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

# 🟢 ฟังก์ชันดึง Data Layers ที่เพิ่มเข้ามา
def get_solar_data_layers(lat, lng, radius_meters=50.0):
    for quality in ["HIGH", "MEDIUM", "LOW"]:
        try:
            resp = requests.get(
                f"{SOLAR_API_BASE}/dataLayers:get",
                params={
                    "location.latitude": lat,
                    "location.longitude": lng,
                    "radiusMeters": radius_meters,
                    "view": "IMAGERY_AND_ANNUAL_FLUX_LAYERS",
                    "requiredQuality": quality,
                    "key": api_key,
                },
                timeout=20,
            )
            if resp.status_code == 404:
                continue  # ลองใหม่ quality ต่ำลง
            resp.raise_for_status()
            return {"ok": True, "data": resp.json()}
        except requests.RequestException as exc:
            return {"ok": False, "reason": str(exc)}
    return {"ok": False, "reason": "no_coverage"}

# ---------------------------------------------------------------------------
# Heatmap Processor (TIF to Base64)
# ---------------------------------------------------------------------------

# 🟢 ฟังก์ชันแปลงภาพที่รับ URL จาก Data Layers มาประมวลผล
def convert_tif_to_base64_heatmap(tif_url: str, api_key: str) -> str:
    try:
        response = requests.get(tif_url, params={"key": api_key}, timeout=15)
        response.raise_for_status()
        with rasterio.open(io.BytesIO(response.content)) as src:
            data = src.read(1).astype(float)
            nodata = src.nodata

            if nodata is not None:
                data[data == nodata] = np.nan

            norm = plt.Normalize(vmin=np.nanmin(data), vmax=np.nanmax(data))
            cmap = plt.get_cmap('inferno')
            rgba_image = cmap(norm(data))
            
            # ทำให้ส่วนที่เป็นพื้นหลัง (ไม่มีข้อมูล) โปร่งใส
            rgba_image[np.isnan(data), 3] = 0.0

            img = Image.fromarray((rgba_image * 255).astype(np.uint8), 'RGBA')
            buffer = io.BytesIO()
            img.save(buffer, format="PNG")

            img_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
            return f"data:image/png;base64,{img_str}"
        
    except Exception as e:
        print(f"Error converting heatmap: {e}")
        return None

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_solar_potential(building_insights: dict) -> dict:
    sp = building_insights["solarPotential"]
    configs = sp.get("solarPanelConfigs", [])
    best_config = configs[-1] if configs else {}

    return {
        "max_panels": sp["maxArrayPanelsCount"],
        "max_area_m2": sp["maxArrayAreaMeters2"],
        "max_sunshine_hrs": sp["maxSunshineHoursPerYear"],
        "panel_capacity_w": sp["panelCapacityWatts"],
        "panel_lifetime_yrs": sp["panelLifetimeYears"],
        "carbon_offset_kg_mwh": sp["carbonOffsetFactorKgPerMwh"],
        "yearly_energy_dc_kwh": best_config.get("yearlyEnergyDcKwh", 0),
        "sunshine_quantiles": sp.get("sunshineQuantiles", []),
    }

def _infer_phase(system_kw: float) -> str:
    return "1 เฟส" if system_kw <= 5 else "3 เฟส"

def generate_advanced_roadmap(monthly_solar_kwh, home_kwh_month, ev_kwh_month, electricity_rate, install_cost, kwh_per_km=0.15, years=25):
    # เพิ่ม dict นี้ไว้บนสุดของฟังก์ชัน
    MONTHLY_TASKS = {
        1:  ["📋 ตรวจรับงานติดตั้ง ตรวจสอบสายไฟและ Inverter", "📱 ติดตั้งแอปมอนิเตอร์จากช่างติดตั้ง", "📸 ถ่ายรูปแผงโซลาร์ไว้เป็นหลักฐาน"],
        2:  ["👀 เช็คแอปมอนิเตอร์ว่าผลิตไฟตรงกับที่คาดไว้ไหม", "🧾 เปรียบเทียบบิลค่าไฟเดือนแรกกับเดือนก่อนติดตั้ง"],
        3:  ["🔌 ปรับนิสัยชาร์จ EV ตอนกลางวัน 10.00-14.00 น.", "🏠 เลื่อนการใช้เครื่องใช้ไฟฟ้าหนัก (เครื่องซัก/อบ) มาใช้ตอนกลางวัน"],
        6:  ["🔧 ล้างแผงโซลาร์ครั้งแรก (ฝุ่นเกาะลดประสิทธิภาพได้ 5-10%)", "📊 ดูรายงานสรุปครึ่งปีในแอป"],
        12: ["🧹 ล้างแผงโซลาร์ประจำปี", "📑 รีวิวบิลค่าไฟทั้งปี เปรียบเทียบกับก่อนติดตั้ง", "🔍 ตรวจสอบ Inverter และสายไฟกับช่างปีละครั้ง"],
        18: ["🔧 Preventive maintenance ตรวจ Inverter", "💡 พิจารณาเพิ่มแบตเตอรี่สำรองไฟถ้าต้องการ"],
        24: ["📋 ตรวจสอบการรับประกันแผงโซลาร์ยังมีผลอยู่", "📈 ประเมินผลการประหยัดจริง vs ที่คาดการณ์ไว้", "🌱 คำนวณคาร์บอนที่ลดได้ตลอด 2 ปี"],
    }
    
    DEFAULT_TASKS = {
        "day":     ["☀️ ชาร์จ EV และใช้เครื่องใช้ไฟฟ้าหนักช่วง 10.00-14.00 น."],
        "quarter": ["🔍 เช็คแอปมอนิเตอร์ว่าผลิตไฟปกติดี", "🧹 เช็คความสะอาดแผงโซลาร์"],
        "semi":    ["🔧 ล้างแผงโซลาร์", "📊 เปรียบเทียบบิลกับช่วงเดียวกันปีที่แล้ว"],
    }
    inflation = 0.03
    degradation = 0.005
    roadmap = []
    cumulative_saving = 0
    break_even_month = None

    for month in range(1, years * 12 + 1):
        year = (month - 1) // 12
        solar_kwh = monthly_solar_kwh * ((1 - degradation) ** year)
        rate = electricity_rate * ((1 + inflation) ** year)

        day_load = (home_kwh_month * HOME_LOAD_PROFILE["day"]) + (ev_kwh_month * EV_CHARGING_PROFILE["day"])
        night_load = (home_kwh_month * (HOME_LOAD_PROFILE["evening"] + HOME_LOAD_PROFILE["night"])) + (ev_kwh_month * EV_CHARGING_PROFILE["night"])
        total_load = home_kwh_month + ev_kwh_month

        self_used = min(solar_kwh, day_load)
        export = max(solar_kwh - day_load, 0)
        grid_import = max(day_load - solar_kwh, 0) + night_load

        ev_solar = min(ev_kwh_month * EV_CHARGING_PROFILE["day"], self_used)
        free_km = ev_solar / kwh_per_km if kwh_per_km > 0 else 0

        bill_before = (total_load * rate) + BASE_FEE
        bill_after = (grid_import * rate) + BASE_FEE
        saving = bill_before - bill_after

        cumulative_saving += saving
        carbon_saved = self_used * 0.5
        event = None

        # เพิ่ม tasks ตามเดือน
        if month in MONTHLY_TASKS:
            tasks = MONTHLY_TASKS[month]
        elif month % 6 == 0:
            tasks = DEFAULT_TASKS["semi"]
        elif month % 3 == 0:
            tasks = DEFAULT_TASKS["quarter"]
        else:
            tasks = DEFAULT_TASKS["day"]
        
        if cumulative_saving >= install_cost and not break_even_month:
            break_even_month = month
            event = f"คืนทุนแล้วใน {round(month/12,1)} ปี 🎉"

        roadmap.append({
            "month": month,
            "energy": {"solar_generated_kwh": round(solar_kwh, 1), "self_used_kwh": round(self_used, 1), "export_kwh": round(export, 1), "grid_import_kwh": round(grid_import, 1)},
            "financial": {"bill_before": int(bill_before), "bill_after": int(bill_after), "saving": int(saving), "cumulative_saving": int(cumulative_saving)},
            "ev": {"solar_ev_kwh": round(ev_solar, 1), "free_km": int(free_km)},
            "carbon": {"saved_kg": int(carbon_saved), "cumulative_saved_kg": int(carbon_saved * month)},
            "event": event,
             "tasks": tasks,  
        })

    return {"roadmap": roadmap, "break_even_month": break_even_month, "break_even_year": round(break_even_month / 12, 1) if break_even_month else None}
    
def _calculate_monthly_ev_kwh(evs: list[EVInput]) -> tuple[float, float]:
    included, additional = 0.0, 0.0
    for ev in evs or []:
        kwh_per_km = ev.custom_kwh_per_km or EV_CONSUMPTION_DB.get(ev.model, 0.150)
        monthly_km = ev.monthly_km if ev.monthly_km > 0 else 1200.0
        ev_kwh = (monthly_km * kwh_per_km) / CHARGING_EFFICIENCY
        if ev.is_included_in_bill: included += ev_kwh
        else: additional += ev_kwh
    return included, additional

def _sunshine_confidence(quantiles):
    if not quantiles: return "LOW"
    spread = max(quantiles) - min(quantiles)
    if spread < 200: return "HIGH"
    elif spread < 400: return "MEDIUM"
    return "LOW"

def _compute_energy_scenarios(base_yearly_kwh, quantiles):
    if quantiles and len(quantiles) >= 5:
        p10, p50, p90 = quantiles[0], quantiles[2], quantiles[4]
        if p50 > 0: return (base_yearly_kwh * (p10 / p50), base_yearly_kwh, base_yearly_kwh * (p90 / p50))
    return (base_yearly_kwh * 0.90, base_yearly_kwh, base_yearly_kwh * 1.08)

def _calc_break_even(cost, yearly_kwh, rate):
    saving = yearly_kwh * rate
    return (cost / saving) if saving > 0 else 0.0

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def estimate_solar_plan(payload: SolarPlanInput, building_insights=None) -> dict:

    rate = payload.electricity_rate or 4.4
    base_bill_kwh = max((payload.monthly_bill_thb - BASE_FEE) / rate, 0.0)

    included_ev, additional_ev = _calculate_monthly_ev_kwh(payload.evs)
    total_ev_kwh = included_ev + additional_ev
    home_kwh = max(base_bill_kwh - included_ev, 0.0)

    # -----------------------------------------------------------------------
    # 🌟 เรียกใช้ Data Layers & Heatmap Processing ตรงนี้เลย 🌟
    # -----------------------------------------------------------------------

    heatmap_base64 = None
    if payload.latitude and payload.longitude:
        layer_res = get_solar_data_layers(payload.latitude, payload.longitude)
        if layer_res.get("ok"):
            flux_url = layer_res["data"].get("annualFluxUrl")
            if flux_url:
                heatmap_base64 = convert_tif_to_base64_heatmap(flux_url, api_key)
        else:
            print("Heatmap unavailable:", layer_res.get("reason"))

    if building_insights and building_insights.get("ok"):
        solar_info = parse_solar_potential(building_insights["data"])
    else:
        solar_info = None

    # ... (ส่วน Sizing คำนวณแผงไฟ ทำเหมือนเดิม)
    monthly_gen_per_kw = 120 * payload.roof_score
    total_load = home_kwh + total_ev_kwh
    system_kw = max(2.0, round(total_load / monthly_gen_per_kw, 1))
    panels = int((system_kw * 1000) / 550)
    phase = _infer_phase(system_kw)

    if solar_info and solar_info["yearly_energy_dc_kwh"] > 0:
        yearly_kwh = solar_info["yearly_energy_dc_kwh"]
        monthly_gen_kwh = yearly_kwh / 12
    else:
        monthly_gen_kwh = system_kw * monthly_gen_per_kw
        yearly_kwh = monthly_gen_kwh * 12

    max_panels_allowed = solar_info["max_panels"] if solar_info else None
    if max_panels_allowed and panels > max_panels_allowed:
        panels = max_panels_allowed

    install_cost = 128_000 if system_kw <= 7.5 else 215_000

    carbon_saved = 0
    if solar_info:
        factor = solar_info["carbon_offset_kg_mwh"]
        carbon_saved = (yearly_kwh / 1000) * factor
    else:
        carbon_saved = yearly_kwh * 0.5
    carbon_ton = carbon_saved / 1000

    cons_y, exp_y, opt_y = _compute_energy_scenarios(
        yearly_kwh, solar_info.get("sunshine_quantiles", []) if solar_info else None
    )

    roi_cons = _calc_break_even(install_cost, cons_y, rate)
    roi_exp  = _calc_break_even(install_cost, exp_y, rate)
    roi_opt  = _calc_break_even(install_cost, opt_y, rate)

    day_load = (home_kwh * HOME_LOAD_PROFILE["day"]) + (total_ev_kwh * EV_CHARGING_PROFILE["day"])
    night_load = (home_kwh * (HOME_LOAD_PROFILE["evening"] + HOME_LOAD_PROFILE["night"])) + (total_ev_kwh * EV_CHARGING_PROFILE["night"])
    
    solar_used = min(monthly_gen_kwh, day_load)
    grid_import = max(day_load - solar_used, 0) + night_load
    
    total_expense_before = (total_load * rate) + BASE_FEE
    new_monthly_bill = (grid_import * rate) + BASE_FEE
    total_savings_month = total_expense_before - new_monthly_bill
    
    ev_cost_before = total_ev_kwh * rate
    ev_solar_kwh = min(total_ev_kwh * EV_CHARGING_PROFILE["day"], solar_used)
    ev_grid_kwh = total_ev_kwh - ev_solar_kwh
    ev_cost_after = ev_grid_kwh * rate
    
    monthly_saving_on_ev_charge = ev_cost_before - ev_cost_after
    monthly_saving_on_home_bill = total_savings_month - monthly_saving_on_ev_charge
    
    bill_reduction_pct = (total_savings_month / total_expense_before) * 100 if total_expense_before > 0 else 0
    break_even = install_cost / (total_savings_month * 12) if total_savings_month > 0 else 0

    confidence = _sunshine_confidence(solar_info.get("sunshine_quantiles", []) if solar_info else [])
    roadmap_data = generate_advanced_roadmap(monthly_gen_kwh, home_kwh, total_ev_kwh, rate, install_cost)
    layer_res = get_solar_data_layers(payload.latitude, payload.longitude)

    return {
        "system_kw": system_kw,
        "monthly_generation_kwh": round(monthly_gen_kwh, 0),
        "install_cost": install_cost,
        "panels": panels,
        "phase": phase,

        # ------------------------------------------------------------------
        # 🌟 รูปภาพ Heatmap ที่จะแนบกลับไปให้ Frontend 
        # ------------------------------------------------------------------
        "heatmap_image": heatmap_base64,

        "new_monthly_bill": int(new_monthly_bill),
        "ev_cost_month_before": int(ev_cost_before),
        "ev_cost_month_after": int(ev_cost_after),
        "total_expense_before": int(total_expense_before),
        "total_expense_after": int(new_monthly_bill),
        "total_savings_month": int(total_savings_month),
        "break_even_years": round(break_even, 1),
        "roi_range": f"{max(0, round(break_even - 0.4, 1))} - {round(break_even + 0.6, 1)}",

        "roi_scenarios_years": {"conservative": round(roi_cons, 1), "expected": round(roi_exp, 1), "optimistic": round(roi_opt, 1)},
        "roi_range_scenarios": f"{round(roi_opt,1)} - {round(roi_cons,1)}",
        "yearly_energy_scenarios_kwh": {"conservative": int(cons_y), "expected": int(exp_y), "optimistic": int(opt_y)},

        "max_panels_allowed": max_panels_allowed,
        "panel_utilization_pct": round((panels / max_panels_allowed) * 100, 1) if max_panels_allowed else None,
        "solar_confidence": confidence,

        "carbon_saved_kg_year": int(carbon_saved),
        "carbon_saved_ton_year": round(carbon_ton, 2),

        "estimated_monthly_saving_thb": int(total_savings_month),
        "estimated_monthly_saving_on_home_bill_thb": int(monthly_saving_on_home_bill),
        "estimated_monthly_saving_on_ev_charge_thb": int(monthly_saving_on_ev_charge),
        "estimated_monthly_bill_after_solar_thb": int(new_monthly_bill),
        "estimated_install_cost_thb": install_cost,
        "estimated_break_even_years": round(break_even, 1),
        "estimated_break_even_month": round(break_even * 12, 1),
        "estimated_annual_saving_total_thb": int(total_savings_month * 12),
        "estimated_bill_reduction_percent": bill_reduction_pct,
        "roadmap": roadmap_data["roadmap"][:24],
        "break_even_month": roadmap_data["break_even_month"],
    }