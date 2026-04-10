import React, { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";

import API_BASE from "./config";
// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => `฿${Number(n || 0).toLocaleString()}`;
const fmtKwh = (n) => `${Number(n || 0).toLocaleString()} kWh`;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function generateChartData({ monthlySaving, installCost, years = 20 }) {
  const m = Number(monthlySaving) || 0;
  const c = Number(installCost) || 0;
  return Array.from({ length: years + 1 }, (_, y) => ({
    year: y,
    profit: m * 12 * y - c,
  }));
}

// ── Error Boundary (ป้องกันหน้าขาว) ──────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 30, background: "#fef2f2", color: "#dc2626", borderRadius: 16, margin: 20, border: "2px solid #fecaca" }}>
          <h2>⚠️ ระบบ UI ขัดข้อง (ป้องกันหน้าขาว)</h2>
          <p>เกิดข้อผิดพลาดในการแสดงผลข้อมูล อาจเป็นเพราะได้รับข้อมูลที่ไม่ถูกต้องจาก Backend</p>
          <pre style={{ background: "#fee2e2", padding: 10, borderRadius: 8, fontSize: 12, overflowX: "auto" }}>
            {String(this.state.error)}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 10, padding: "8px 16px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
            โหลดหน้าเว็บใหม่
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent = false, icon }) {
  return (
    <div style={{
      background: accent ? "linear-gradient(135deg, #f0fdf4, #dcfce7)" : "#fff",
      border: `1px solid ${accent ? "#86efac" : "#e5e7eb"}`,
      borderRadius: 14, padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {icon && <span style={{ marginRight: 5 }}>{icon}</span>}{label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ? "#15803d" : "#111827", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#9ca3af" }}>{sub}</div>}
    </div>
  );
}

function ScenarioBar({ label, years, maxYears = 12, color }) {
  const y = Number(years) || 0;
  const pct = Math.min((y / maxYears) * 100, 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color }}>{y} ปี</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: "#f3f4f6", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.8s cubic-bezier(.4,0,.2,1)" }} />
      </div>
    </div>
  );
}

function RoadmapTimeline({ roadmap }) {
  // Map ป้องกันตัวแปรถูกแก้ไขทับ
  const enhancedRoadmap = (roadmap || []).map(m => ({ ...m }));
  enhancedRoadmap.forEach(m => {
    if (m.month === 6 && !m.event) m.event = "คุ้นเคยกับการดึงไฟโซลาร์มาใช้ตอนกลางวัน ☀️";
    if (m.month === 18 && !m.event) m.event = "ช่วยลดคาร์บอนให้โลกได้อย่างต่อเนื่อง 🌿";
    if (m.month === 24 && !m.event) m.event = "ใช้งานระบบคุ้มค่า ครบ 2 ปีเต็ม 🎉";
  });
  
  const events = enhancedRoadmap.filter(m => m.event || (m.tasks && m.tasks.length > 0));
  if (!events.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {events.map((m, i) => (
        <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "linear-gradient(to bottom, #fbbf24, #f59e0b)" }} />
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            {/* Badge เดือน */}
            <div style={{ background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a", borderRadius: 12, padding: "10px 14px", textAlign: "center", minWidth: 70, flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>เดือนที่</div>
              <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{m.month || 0}</div>
            </div>

            <div style={{ flex: 1 }}>
              {/* Event title */}
              <div style={{ fontSize: 15, color: "#111827", fontWeight: 800, marginBottom: 6 }}>{m.event}</div>
              
              {/* Stats */}
              <div style={{ fontSize: 13, color: "#6b7280", display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12 }}>
                <span><span style={{ color: "#16a34a", fontWeight: 700 }}>ประหยัดสะสม:</span> {fmt(m.financial?.cumulative_saving)}</span>
                <span><span style={{ color: "#f59e0b", fontWeight: 700 }}>โซลาร์ผลิตได้:</span> {Number(m.energy?.solar_generated_kwh || 0)} kWh</span>
              </div>

              {/* ✅ Tasks */}
              {m.tasks?.length > 0 && (
                <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 14px", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    ✅ สิ่งที่ควรทำเดือนนี้
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {m.tasks.map((task, ti) => (
                      <div key={ti} style={{ fontSize: 13, color: "#374151", display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ color: "#22c55e", fontWeight: 700, flexShrink: 0 }}>→</span>
                        <span>{task}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CarbonMeter({ kgYear }) {
  if (!kgYear) return null;
  const trees = Math.round(kgYear / 21);
  const cars = (kgYear / 4600).toFixed(1);
  return (
    <div style={{ background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)", borderRadius: 14, padding: "24px 20px", border: "1px solid #bbf7d0", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 13, color: "#166534", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 20, textAlign: "center" }}>
        🌿 ผลต่อสิ่งแวดล้อม / ปี
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 36, fontWeight: 900, color: "#15803d", lineHeight: 1 }}>{(kgYear / 1000).toFixed(1)}</div>
          <div style={{ fontSize: 13, color: "#16a34a", fontWeight: 700, marginTop: 8 }}>ตัน CO₂</div>
        </div>
        <div>
          <div style={{ fontSize: 36, fontWeight: 900, color: "#15803d", lineHeight: 1 }}>{Number(trees || 0).toLocaleString()}</div>
          <div style={{ fontSize: 13, color: "#16a34a", fontWeight: 700, marginTop: 8 }}>ต้นไม้เทียบเท่า</div>
        </div>
        <div>
          <div style={{ fontSize: 36, fontWeight: 900, color: "#15803d", lineHeight: 1 }}>{cars}</div>
          <div style={{ fontSize: 13, color: "#16a34a", fontWeight: 700, marginTop: 8 }}>คันรถลดได้</div>
        </div>
      </div>
    </div>
  );
}

function EnergyFlowCard({ result }) {
  if (!result) return null;
  const scenarios = result.yearly_energy_scenarios_kwh || {};
  const data = [
    { name: "ต่ำ", kwh: Number(scenarios.conservative || 0), color: "#f59e0b" },
    { name: "คาดการณ์", kwh: Number(scenarios.expected || 0), color: "#22c55e" },
    { name: "สูง", kwh: Number(scenarios.optimistic || 0), color: "#3b82f6" },
  ];
  
  const maxKwh = Number(scenarios.optimistic || 1);
  
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", border: "1px solid #e5e7eb" }}>
      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16 }}>
        ⚡ พลังงานที่ผลิตได้ต่อปี (3 กรณี)
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {data.map(d => (
          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#374151", width: 80, fontWeight: 600 }}>{d.name}</span>
            <div style={{ flex: 1, height: 8, borderRadius: 99, background: "#f3f4f6", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min((d.kwh / maxKwh) * 100, 100)}%`,
                background: d.color, borderRadius: 99
              }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: d.color, minWidth: 70, textAlign: "right" }}>
              {d.kwh.toLocaleString()} kWh
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyDetailTable({ roadmap }) {
  const [show, setShow] = useState(false);
  const data = (roadmap || []).slice(0, 24);
  if (!data.length) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => setShow(s => !s)}
        style={{
          background: "none", border: "1.5px solid #e5e7eb", borderRadius: 8,
          padding: "8px 14px", fontSize: 13, fontWeight: 700, color: "#374151",
          cursor: "pointer", width: "100%", transition: "background 0.2s"
        }}
        onMouseOver={e => e.target.style.background = "#f8fafc"}
        onMouseOut={e => e.target.style.background = "none"}
      >
        {show ? "▲ ซ่อนตารางรายละเอียดรายเดือน" : "▼ ดูตารางรายละเอียดรายเดือน (24 เดือน)"}
      </button>
      {show && (
        <div style={{ overflowX: "auto", marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["เดือน", "โซลาร์ผลิต", "ใช้เอง", "นำเข้ากริด", "ค่าไฟก่อน", "ค่าไฟหลัง", "ประหยัด", "สะสม"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", borderBottom: "2px solid #e5e7eb", textAlign: "right", color: "#4b5563", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.month} style={{ borderBottom: "1px solid #f3f4f6", background: m.event ? "#fefce8" : "transparent" }}>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: m.event ? 700 : 500 }}>{m.month || 0}{m.event ? " ⭐" : ""}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: "#d97706" }}>{Number(m.energy?.solar_generated_kwh || 0)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: "#16a34a" }}>{Number(m.energy?.self_used_kwh || 0)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: "#ef4444" }}>{Number(m.energy?.grid_import_kwh || 0)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>฿{Number(m.financial?.bill_before || 0).toLocaleString()}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>฿{Number(m.financial?.bill_after || 0).toLocaleString()}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: "#16a34a", fontWeight: 700 }}>฿{Number(m.financial?.saving || 0).toLocaleString()}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800 }}>฿{Number(m.financial?.cumulative_saving || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [evModels, setEvModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [apiError, setApiError] = useState("");
  const [activeTab, setActiveTab] = useState("roi");

  const [form, setForm] = useState({
    monthly_bill_thb: 3000,
    latitude: 13.7563,
    longitude: 100.5018,
    roof_score: 0.82,
    radius_meters: 12,
    electricity_rate: 4.4,
    usage_pattern: "mixed",
    evs: [{ id: Date.now(), model: "", custom_kwh_per_km: "", monthly_km: 1200, is_included_in_bill: false }],
  });

  useEffect(() => {
    fetch(`${API_BASE}/ev-models/`)
      .then(r => r.json())
      .then(data => {
        const models = data.models || [];
        setEvModels(models);
        setForm(prev => ({ ...prev, evs: [{ ...prev.evs[0], model: models[0] || "" }] }));
      })
      .catch(() => {
        const defaults = ["BYD Dolphin", "Tesla Model 3", "NETA V", "MG4", "BYD Seal"];
        setEvModels(defaults);
        setForm(prev => ({ ...prev, evs: [{ ...prev.evs[0], model: defaults[0] }] }));
      });
  }, []);

  const onAnalyze = async () => {
    setLoading(true); setResult(null); setApiError("");
    try {
      const res = await fetch(`${API_BASE}/analyze/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      
      // 🟢 เพิ่มตัวเช็ค Error ป้องกันกรณี Backend พัง (เช่น rasterio error)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server Error: ${res.status}`);
      }
      
      const data = await res.json();
      setResult(data);
      setActiveTab("roi");
    } catch (err) {
      setApiError(err.message || "เชื่อมต่อ API ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleEvChange = (id, field, value) =>
    setForm(prev => ({ ...prev, evs: prev.evs.map(ev => ev.id === id ? { ...ev, [field]: value } : ev) }));

  // ── Derived values ──────────────────────────────────────────────────────────
  const R = result || {};
  const monthlyBill = Number(form.monthly_bill_thb || 0);
  const monthlySavingTotal = Number(R.estimated_monthly_saving_thb || 0);
  const monthlyAfterInstall = Number(R.estimated_monthly_bill_after_solar_thb ?? clamp(monthlyBill - monthlySavingTotal, 0, 999999));
  const installCost = Number(R.estimated_install_cost_thb || 0);
  const annualSaving = Number(R.estimated_annual_saving_total_thb || 0);
  const breakEven = R.estimated_break_even_years ?? "-";
  const billReductionPct = Number(R.estimated_bill_reduction_percent || 0);
  const panels = Number(R.recommended_panels || R.panels || 0);
  const phase = R.recommended_phase || R.phase || "-";
  const monthlyGen = Number(R.monthly_generation_kwh || 0);
  const systemKw = Number(R.system_kw || 0);
  const evCostBefore = Number(R.ev_cost_month_before || 0);
  const evCostAfter = Number(R.ev_cost_month_after || 0);
  const carbonKg = Number(R.carbon_saved_kg_year || 0);
  const maxPanels = R.max_panels_allowed;
  const panelUtil = R.panel_utilization_pct;
  const roiScenarios = R.roi_scenarios_years || {};
  const roadmap = R.roadmap || [];

  const chartData = useMemo(() =>
    generateChartData({ monthlySaving: monthlySavingTotal, installCost, years: 20 }),
    [monthlySavingTotal, installCost]
  );

  const monthlyChartData = useMemo(() =>
    roadmap.slice(0, 24).map(m => ({
      month: m.month || 0,
      saving: Number(m.financial?.saving || 0),
      cumulative: Number(m.financial?.cumulative_saving || 0),
      solar: Number(m.energy?.solar_generated_kwh || 0),
      import: Number(m.energy?.grid_import_kwh || 0),
      freeKm: Number(m.ev?.free_km || 0),
    })),
    [roadmap]
  );

  const tabs = [
    { id: "roi", label: "💰 ROI" },
    { id: "energy", label: "⚡ พลังงาน + EV + Carbon" },
    { id: "roadmap", label: "📅 Roadmap" },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', 'Sarabun', sans-serif", background: "#f8fafc", minHeight: "100vh" }}>
      {/* ── Topbar ── */}
      <header style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0f2a1a 100%)",
        padding: "16px 28px", display: "flex", alignItems: "center", gap: 14,
        boxShadow: "0 4px 24px rgba(0,0,0,0.25)"
      }}>
        <div style={{ fontSize: 32 }}>☀️</div>
        <div>
          <div style={{ color: "#fbbf24", fontWeight: 900, fontSize: 22, letterSpacing: "-0.02em" }}>SunnyDrive</div>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>วางแผนประหยัดพลังงาน ครอบคลุมรถ EV ทุกคันในบ้านคุณ</div>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, padding: 20, maxWidth: 1400, margin: "0 auto" }}>

        {/* ── Left Panel ── */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 8px rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 16, paddingBottom: 10, borderBottom: "2px solid #f1f5f9" }}>
              🏠 ข้อมูลบ้าน
            </div>

            <Label>ค่าไฟเฉลี่ย/เดือน</Label>
            <NumInput value={form.monthly_bill_thb} onChange={v => setForm({ ...form, monthly_bill_thb: v })} placeholder="เช่น 3000" prefix="฿" />

            <Label>ค่าไฟต่อหน่วย (บาท/kWh)</Label>
            <NumInput value={form.electricity_rate} onChange={v => setForm({ ...form, electricity_rate: v })} step={0.1} />

            <Label style={{ marginTop: 14 }}>พิกัดหลังคา (Lat / Lng)</Label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <NumInput value={form.latitude} onChange={v => setForm({ ...form, latitude: v })} step={0.00001} placeholder="Lat" />
              <NumInput value={form.longitude} onChange={v => setForm({ ...form, longitude: v })} step={0.00001} placeholder="Lng" />
            </div>

            {/* 🌟 ส่วนแสดงภาพ Heatmap ที่เพิ่มเข้ามา */}
            {R.heatmap_image && (
              <div style={{ marginTop: 16, background: "#111827", borderRadius: 12, overflow: "hidden", position: "relative", border: "2px solid #f8fafc", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
                <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.7)", color: "#fbbf24", fontSize: 11, padding: "4px 8px", borderRadius: 6, fontWeight: 800, backdropFilter: "blur(4px)" }}>
                  🔥 หลังคารับแดด
                </div>
                <img src={R.heatmap_image} alt="Roof Heatmap" style={{ width: "100%", display: "block", aspectRatio: "1/1", objectFit: "cover" }} />
              </div>
            )}
          </div>

          {/* EVs */}
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 8px rgba(0,0,0,0.07)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", letterSpacing: "0.04em", textTransform: "uppercase" }}>🚗 รถ EV</div>
              <button onClick={() => setForm(prev => ({ ...prev, evs: [...prev.evs, { id: Date.now(), model: evModels[0] || "", custom_kwh_per_km: "", monthly_km: 1200, is_included_in_bill: false }] }))}
                style={{ background: "#f0fdf4", border: "1px solid #86efac", color: "#16a34a", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                + เพิ่ม
              </button>
            </div>
            {form.evs.map((ev, i) => (
              <div key={ev.id} style={{ background: "#f8fafc", borderRadius: 10, padding: 12, border: "1px solid #e5e7eb", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>คันที่ {i + 1}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 11, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="checkbox" checked={ev.is_included_in_bill || false}
                        onChange={e => handleEvChange(ev.id, "is_included_in_bill", e.target.checked)} />
                      รวมในบิลแล้ว
                    </label>
                    {form.evs.length > 1 && (
                      <button onClick={() => setForm(prev => ({ ...prev, evs: prev.evs.filter(e => e.id !== ev.id) }))}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>
                    )}
                  </div>
                </div>
                <select value={ev.model} onChange={e => handleEvChange(ev.id, "model", e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12, marginBottom: 6 }}>
                  {evModels.map(m => <option key={m} value={m}>{m}</option>)}
                  <option value="Other">อื่นๆ</option>
                </select>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <NumInput value={ev.custom_kwh_per_km || ""} onChange={v => handleEvChange(ev.id, "custom_kwh_per_km", v || "")} step={0.01} placeholder="kWh/km" />
                  <NumInput value={ev.monthly_km || ""} onChange={v => handleEvChange(ev.id, "monthly_km", v)} placeholder="km/เดือน" />
                </div>
              </div>
            ))}
          </div>

          <button onClick={onAnalyze} disabled={loading}
            style={{
              background: loading ? "#94a3b8" : "linear-gradient(135deg, #fbbf24, #f59e0b)",
              color: "#0f172a", fontWeight: 900, fontSize: 15, padding: "14px 20px",
              borderRadius: 12, border: "none", cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 4px 14px rgba(251,191,36,0.4)", letterSpacing: "0.02em",
              transition: "all 0.2s"
            }}>
            {loading ? "⏳ AI กำลังวิเคราะห์..." : "☀️ วิเคราะห์ความคุ้มค่า"}
          </button>
          
          {/* แสดง Error สีแดงชัดเจนใต้ปุ่ม */}
          {apiError && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
              ⚠️ {apiError}
            </div>
          )}
        </aside>

        {/* ── Right Panel ── */}
        <main>
          <ErrorBoundary>
            {!result && !loading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 500, background: "#fff", borderRadius: 16, boxShadow: "0 1px 8px rgba(0,0,0,0.07)", color: "#94a3b8" }}>
                <div style={{ fontSize: 72, marginBottom: 16 }}>☀️</div>
                <h2 style={{ margin: 0, color: "#374151" }}>ยินดีต้อนรับสู่ SunnyDrive</h2>
                <p style={{ color: "#9ca3af" }}>กรอกข้อมูลและกดปุ่มวิเคราะห์ เพื่อดูผลลัพธ์ทั้งหมด</p>
              </div>
            ) : loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, background: "#fff", borderRadius: 16, gap: 12, color: "#6b7280" }}>
                <div style={{ fontSize: 28, animation: "spin 1s linear infinite" }}>☀️</div>
                <span style={{ fontSize: 16, fontWeight: 600 }}>AI กำลังวิเคราะห์ข้อมูลจาก Google Solar API...</span>
              </div>
            ) : (
              <>
                {/* ── Hero Summary ── */}
                <div style={{
                  background: "linear-gradient(135deg, #0f172a, #1e3a5f)",
                  borderRadius: 16, padding: "20px 24px", marginBottom: 16,
                  display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16
                }}>
                  <HeroStat label="ค่าไฟหลังติดตั้ง" value={fmt(monthlyAfterInstall)} sub={`จากเดิม ${fmt(monthlyBill)}/เดือน`} highlight />
                  <HeroStat label="ลดค่าไฟ" value={`${Math.round(billReductionPct || 0)}%`} sub={`${fmt(monthlySavingTotal)}/เดือน`} />
                  <HeroStat label="คืนทุนใน" value={`${breakEven} ปี`} sub={`เงินลงทุน ${fmt(installCost)}`} />
                  <HeroStat label="ประหยัด/ปี" value={fmt(annualSaving)} sub={`${systemKw} kW · ${panels} แผง · ${phase}`} />
                </div>

                {/* ── Tabs ── */}
                <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#fff", padding: 6, borderRadius: 12, boxShadow: "0 1px 8px rgba(0,0,0,0.07)" }}>
                  {tabs.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                      style={{
                        flex: 1, padding: "10px 4px", borderRadius: 8, border: "none",
                        background: activeTab === t.id ? "#0f172a" : "transparent",
                        color: activeTab === t.id ? "#fbbf24" : "#6b7280",
                        fontWeight: 800, fontSize: 13, cursor: "pointer", transition: "all 0.2s"
                      }}>{t.label}</button>
                  ))}
                </div>

                {/* ── Tab: ROI ── */}
                {activeTab === "roi" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {/* ROI Scenarios */}
                    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 8px rgba(0,0,0,0.07)" }}>
                      <SectionTitle>📊 ระยะเวลาคืนทุน (3 กรณี)</SectionTitle>
                      {roiScenarios.optimistic && <>
                        <ScenarioBar label="🌟 กรณีดีที่สุด" years={roiScenarios.optimistic} color="#22c55e" />
                        <ScenarioBar label="📊 กรณีคาดการณ์" years={roiScenarios.expected} color="#3b82f6" />
                        <ScenarioBar label="⚠️ กรณีระมัดระวัง" years={roiScenarios.conservative} color="#f59e0b" />
                        
                        <div style={{ marginTop: 20, padding: "14px 16px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e5e7eb" }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#1f2937", marginBottom: 8 }}>💡 ตัวเลข 3 กรณีนี้ คำนวณมาจากอะไร?</div>
                          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: "#4b5563", display: "flex", flexDirection: "column", gap: 6 }}>
                            <li><strong style={{color:"#16a34a"}}>กรณีดีที่สุด:</strong> อ้างอิงจากปีที่แดดจัดที่สุดตามสถิติของ Google สภาพอากาศเคลียร์ เมฆน้อย (การผลิตไฟทำได้เต็มประสิทธิภาพ)</li>
                            <li><strong style={{color:"#2563eb"}}>กรณีคาดการณ์:</strong> ค่าเฉลี่ยกลางตามสถิติสภาพอากาศรายปีในพื้นที่ของคุณ เป็นตัวเลขที่น่าจะเกิดขึ้นจริงมากที่สุด</li>
                            <li><strong style={{color:"#d97706"}}>กรณีระมัดระวัง:</strong> คำนวณเผื่อไว้สำหรับปีที่ฝนตกชุก มีมรสุมเข้า เมฆหนา หรืออาจมีฝุ่นเกาะแผง (ความเสี่ยงสูงสุด)</li>
                          </ul>
                        </div>
                      </>}
                      {!roiScenarios.optimistic && (
                        <div style={{ fontSize: 32, fontWeight: 900, color: "#16a34a", marginTop: 8 }}>{breakEven} ปี</div>
                      )}
                    </div>

                    {/* Profit Chart */}
                    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 8px rgba(0,0,0,0.07)" }}>
                      <SectionTitle>📈 กำไรสะสม 20 ปี</SectionTitle>
                      <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                          <YAxis tickFormatter={v => `฿${Math.round(v / 1000)}k`} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={v => fmt(v)} labelFormatter={l => `ปีที่ ${l}`} />
                          <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                          <Area type="monotone" dataKey="profit" stroke="#16a34a" fill="url(#profitGrad)" strokeWidth={2.5} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Financial Breakdown */}
                    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 8px rgba(0,0,0,0.07)", gridColumn: "span 2" }}>
                      <SectionTitle>💳 สรุปค่าใช้จ่าย</SectionTitle>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                        <StatCard label="งบติดตั้ง" value={fmt(installCost)} icon="🔧" />
                        <StatCard label="ค่าไฟบ้านเดิม" value={fmt(monthlyBill)} sub="ต่อเดือน" />
                        <StatCard label="ค่าไฟบ้านใหม่" value={fmt(monthlyAfterInstall)} sub="ต่อเดือน" accent />
                        <StatCard label="ประหยัดต่อปี" value={fmt(annualSaving)} accent icon="💰" />
                      </div>
                      {evCostBefore > 0 && (
                        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <StatCard label="ค่าชาร์จ EV ก่อน" value={fmt(evCostBefore)} sub="ต่อเดือน" icon="🔌" />
                          <StatCard label="ค่าชาร์จ EV หลัง" value={fmt(evCostAfter)} sub="ต่อเดือน" accent icon="⚡" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Tab: Energy (รวม EV และ Carbon เข้ามา) ── */}
                {activeTab === "energy" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {/* ข้อมูลพลังงานทั่วไป */}
                    <EnergyFlowCard result={R} />
                    
                    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 8px rgba(0,0,0,0.07)" }}>
                      <SectionTitle>🔆 ระบบโซลาร์</SectionTitle>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <StatCard label="กำลังติดตั้ง" value={`${systemKw} kW`} icon="⚡" />
                        <StatCard label="ผลิตได้/เดือน" value={fmtKwh(monthlyGen)} accent />
                        <StatCard label="จำนวนแผง" value={`${panels} แผง`} icon="🟦" />
                        <StatCard label="ระบบไฟฟ้า" value={phase} icon="🔌" />
                      </div>
                      {maxPanels && (
                        <div style={{ marginTop: 12, padding: 12, background: "#f8fafc", borderRadius: 10 }}>
                          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 6 }}>
                            ใช้พื้นที่หลังคา {panelUtil}% (จากสูงสุด {maxPanels} แผง)
                          </div>
                          <div style={{ height: 8, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${panelUtil}%`, background: "#fbbf24", borderRadius: 99 }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 🟢 ส่วน EV */}
                    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 8px rgba(0,0,0,0.07)" }}>
                      <SectionTitle>🚗 ค่าชาร์จ EV ก่อน-หลัง ติดตั้ง</SectionTitle>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <StatCard label="ก่อนติดตั้ง" value={fmt(evCostBefore)} sub="ต่อเดือน" />
                        <StatCard label="หลังติดตั้ง" value={fmt(evCostAfter)} sub="ต่อเดือน" accent />
                        <StatCard label="ประหยัด EV" value={fmt(evCostBefore - evCostAfter)} sub="ต่อเดือน" accent icon="💚" />
                        <StatCard label="ประหยัด EV/ปี" value={fmt((evCostBefore - evCostAfter) * 12)} icon="🎯" />
                      </div>
                    </div>

                    {/* 🟢 ส่วน Carbon ปรับฟอนต์ใหญ่แล้ว */}
                    <CarbonMeter kgYear={carbonKg} />
                    
                  </div>
                )}

                {/* ── Tab: Roadmap ── */}
                {activeTab === "roadmap" && (
                  <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 8px rgba(0,0,0,0.07)" }}>
                    <SectionTitle>📅 เส้นทางการประหยัด</SectionTitle>
                    
                    <RoadmapTimeline roadmap={roadmap} />
                    
                    {monthlyChartData.length > 0 && (
                      <>
                        <div style={{ marginTop: 28, marginBottom: 8 }}>
                          <SectionTitle>💰 ประหยัดสะสม 24 เดือน</SectionTitle>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                          <AreaChart data={monthlyChartData}>
                            <defs>
                              <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                            <YAxis tickFormatter={v => `฿${Math.round(v / 1000)}k`} tick={{ fontSize: 10 }} />
                            <Tooltip formatter={v => fmt(v)} labelFormatter={l => `เดือนที่ ${l}`} />
                            <Area type="monotone" dataKey="cumulative" name="ประหยัดสะสม" stroke="#16a34a" fill="url(#cumGrad)" strokeWidth={3} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>

                        <div style={{ marginTop: 12, padding: "14px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#166534", marginBottom: 6 }}>💡 ยอดประหยัดสะสมเกิดจากอะไร?</div>
                          <div style={{ fontSize: 12, color: "#15803d", lineHeight: 1.6 }}>
                            คำนวณจากส่วนต่างของ <strong>(ค่าไฟบ้าน + ค่าชาร์จ EV แบบเดิมที่คุณต้องจ่ายทุกเดือน)</strong> นำมาหักลบกับ <strong>(ค่าไฟที่ต้องจ่ายให้การไฟฟ้าจริงๆ หลังติดตั้งโซลาร์เซลล์แล้ว)</strong> ในแต่ละเดือน จากนั้นนำเงินส่วนที่รอดกระเป๋ามาบวกทบกันไปเรื่อยๆ จนเห็นเป็นยอดเงินก้อนนี้ครับ
                          </div>
                        </div>
                      </>
                    )}
                    <MonthlyDetailTable roadmap={roadmap} />
                  </div>
                )}
              </>
            )}
          </ErrorBoundary>
        </main>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800;900&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        select, input[type=number] { outline: none; font-family: inherit; }
        select:focus, input:focus { border-color: #fbbf24 !important; box-shadow: 0 0 0 3px rgba(251,191,36,0.15); }
      `}</style>
    </div>
  );
}

// ── Micro components ────────────────────────────────────────────────────────

function Label({ children, style }) {
  return <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginTop: 12, marginBottom: 5, ...style }}>{children}</div>;
}

function NumInput({ value, onChange, step = 1, placeholder, prefix }) {
  return (
    <div style={{ position: "relative" }}>
      {prefix && <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9ca3af" }}>{prefix}</span>}
      <input
        type="number" step={step} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        style={{
          width: "100%", padding: prefix ? "8px 10px 8px 22px" : "8px 10px",
          borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13,
          background: "#f9fafb", transition: "all 0.15s"
        }}
      />
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 16, letterSpacing: "-0.01em" }}>{children}</div>;
}

function HeroStat({ label, value, sub, highlight }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: highlight ? "#fbbf24" : "#94a3b8", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: highlight ? 28 : 24, fontWeight: 900, color: highlight ? "#fbbf24" : "#f1f5f9", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}