import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
  ReferenceArea,
  ResponsiveContainer
} from "recharts";

import API_BASE from "./config";

function formatThb(n) {
  const value = Number(n || 0);
  return `฿${value.toLocaleString()}`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function generateProfitChartDataYears({ monthlySavingTotal, installCost, years = 20 }) {
  const data = [];
  for (let y = 0; y <= years; y++) {
    const profit = monthlySavingTotal * 12 * y - installCost;
    data.push({ year: y, profit });
  }
  return data;
}

export default function App() {
  const [evModels, setEvModels] = useState([]);
  const [loadingScan, setLoadingScan] = useState(false);
  const [result, setResult] = useState(null);
  const [apiError, setApiError] = useState("");

  const [form, setForm] = useState({
    monthly_bill_thb: 3000,
    latitude: 37.4220,
    longitude: -122.08418,
    roof_score: 0.82,
    radius_meters: 12,
    electricity_rate: 4.4,
    usage_pattern: "mixed",
    evs: [{ id: Date.now(), model: "", custom_kwh_per_km: "", monthly_km: 1200, is_included_in_bill: false }],
  });

  useEffect(() => {
    fetch(`${API_BASE}/ev-models/`)
      .then((r) => r.json())
      .then((data) => {
        const models = data.models || [];
        setEvModels(models);
        setForm((prev) => ({
          ...prev,
          evs: [{ ...prev.evs[0], model: models[0] || "" }]
        }));
      })
      .catch(() => {
        const defaults = ["BYD Dolphin", "Tesla Model 3"];
        setEvModels(defaults);
        setForm((prev) => ({
          ...prev,
          evs: [{ ...prev.evs[0], model: defaults[0] }]
        }));
      });
  }, []);

  const handleAddEv = () => {
    setForm((prev) => ({
      ...prev,
      evs: [...prev.evs, { id: Date.now(), model: evModels[0] || "", custom_kwh_per_km: "", monthly_km: 1200, is_included_in_bill: false }]
    }));
  };

  const handleRemoveEv = (idToRemove) => {
    setForm((prev) => ({
      ...prev,
      evs: prev.evs.filter((ev) => ev.id !== idToRemove)
    }));
  };

  const handleEvChange = (id, field, value) => {
    setForm((prev) => ({
      ...prev,
      evs: prev.evs.map((ev) => (ev.id === id ? { ...ev, [field]: value } : ev))
    }));
  };

  const onAnalyze = async () => {
    setLoadingScan(true);
    setResult(null);
    setApiError("");
    try {
      const res = await fetch(`${API_BASE}/analyze/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setResult(data);
    } catch (error) {
      setApiError("เชื่อมต่อ API ไม่สำเร็จ หรือข้อมูลผิดรูปแบบ");
    } finally {
      setLoadingScan(false);
    }
  };

  const monthlyBill = Number(form.monthly_bill_thb || 0);
  const monthlySavingTotal = Number(result?.estimated_monthly_saving_thb || 0);
  const monthlySavingOnBill = Number(result?.estimated_monthly_saving_on_bill_thb || 0);
  const monthlySavingAdditionalEv = Number(result?.estimated_monthly_saving_additional_ev_thb || 0);
  const monthlyAfterInstall = Number(result?.estimated_monthly_bill_after_solar_thb ?? clamp(monthlyBill - monthlySavingOnBill, 0, 999999));
  const installCost = Number(result?.estimated_install_cost_thb || 0);
  const breakEvenYears = result?.estimated_break_even_years ?? "-";
  const annualSaving = Number(result?.estimated_annual_saving_thb || 0);
  const billReductionPct = Number(result?.estimated_bill_reduction_percent || 0);
  const recommendedPanels = Number(result?.recommended_panels || 0);
  const recommendedPhase = result?.recommended_phase || "-";
  const monthlyGeneration = Number(result?.monthly_generation_kwh || 0);
  const usagePatternLabel = result?.usage_pattern_label || "-";
  const breakEvenYearNumber = Number(result?.estimated_break_even_years || 0);

  const chartData = useMemo(() => {
    return generateProfitChartDataYears({ monthlySavingTotal, installCost, years: 20 });
  }, [monthlySavingTotal, installCost]);

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brandIcon">☀️</span>
          <div>
            <div className="brandTitle">SunnyDrive</div>
            <div className="brandSub">วางแผนประหยัดพลังงาน ครอบคลุมรถ EV ทุกคันในบ้านคุณ</div>
          </div>
        </div>
      </header>

      <main className="dashboard">
        {/* --- ส่วนกรอกข้อมูลด้านซ้าย --- */}
        <aside className="leftPanel panelCard">
          <div className="panelHeader">Step 1: Your Home & EV</div>
          
          <div className="section">
            <div className="labelRow">
              <div className="labelTitle">ค่าไฟเฉลี่ย/เดือน</div>
              <div className="labelValue">{formatThb(form.monthly_bill_thb)}</div>
            </div>
            {/* แก้ไขเป็นช่อง Input แบบพิมพ์ตัวเลข */}
            <input 
              className="select" 
              type="number" 
              placeholder="กรอกค่าไฟ เช่น 3000" 
              value={form.monthly_bill_thb} 
              onChange={(e) => setForm({ ...form, monthly_bill_thb: Number(e.target.value) })} 
            />
          </div>

          <div className="section">
            <div className="labelRow">
              <div className="labelTitle">ค่าไฟต่อหน่วย (บาท/kWh)</div>
              <div className="labelValue">{form.electricity_rate}</div>
            </div>
            <input
              type="number"
              className="select"
              step="0.1"
              value={form.electricity_rate}
              onChange={(e) => setForm({ ...form, electricity_rate: Number(e.target.value) })}
            />
          </div>

          <hr style={{ margin: "20px 0", borderColor: "#e5e7eb" }} />

          <div className="section">
            <div className="labelRow" style={{ marginBottom: "15px" }}>
              <div className="labelTitle" style={{ fontSize: "16px", fontWeight: "bold" }}>รถ EV ที่ใช้งาน</div>
              <button className="secondaryBtn" style={{ padding: "5px 10px", fontSize: "12px" }} onClick={handleAddEv}>
                + เพิ่มรถ EV
              </button>
            </div>
            
            {form.evs.map((ev, index) => (
              <div key={ev.id} style={{ padding: "12px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb", marginBottom: "10px" }}>
                <label style={{ display: "block", marginBottom: "8px" }}>
                  <input
                    type="checkbox"
                    checked={ev.is_included_in_bill || false}
                    onChange={(e) => handleEvChange(ev.id, "is_included_in_bill", e.target.checked)}
                  />
                  {" "}รวมอยู่ในค่าไฟปัจจุบัน
                </label>
                <div className="labelRow" style={{ marginBottom: "8px" }}>
                  <div className="labelTitle" style={{ fontSize: "13px", color: "#6b7280" }}>คันที่ {index + 1}</div>
                  {form.evs.length > 1 && (
                    <button className="textBtn textRed" style={{ fontSize: "12px", color: "#ef4444", border: "none", background: "none", cursor: "pointer" }} onClick={() => handleRemoveEv(ev.id)}>
                      🗑️ ลบ
                    </button>
                  )}
                </div>
                
                <select className="select" value={ev.model} onChange={(e) => handleEvChange(ev.id, 'model', e.target.value)} style={{ marginBottom: "10px" }}>
                  {evModels.map((m) => <option key={m} value={m}>{m}</option>)}
                  <option value="Other">อื่นๆ (ระบุค่าเอง)</option>
                </select>

                <input
                  type="number"
                  step="0.01"
                  placeholder="อัตรากินไฟ (kWh/km)"
                  className="select"
                  value={ev.custom_kwh_per_km || ""}
                  onChange={(e) => handleEvChange(ev.id, 'custom_kwh_per_km', e.target.value ? Number(e.target.value) : "")}
                />
                <input
                  type="number"
                  placeholder="ระยะทาง/เดือน (km)"
                  className="select"
                  style={{ marginTop: "8px" }}
                  value={ev.monthly_km || ""}
                  onChange={(e) => handleEvChange(ev.id, "monthly_km", Number(e.target.value))}
                />
              </div>
            ))}
          </div>

          {/* --- เอากลับมาให้แล้วครับ: ส่วนพิกัดหลังคาบ้าน --- */}
          <div className="section">
            <div className="labelRow">
              <div className="labelTitle">พิกัดหลังคาบ้าน (Lat / Lng)</div>
            </div>
            <div className="grid2">
              <input 
                className="miniInput" 
                type="number" 
                step="0.00001" 
                value={form.latitude} 
                onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })} 
                placeholder="Lat" 
              />
              <input 
                className="miniInput" 
                type="number" 
                step="0.00001" 
                value={form.longitude} 
                onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })} 
                placeholder="Lng" 
              />
            </div>
          </div>

          <button className="primaryBtn" onClick={onAnalyze} disabled={loadingScan} style={{ marginTop: "10px", width: "100%" }}>
            {loadingScan ? "AI กำลังวิเคราะห์..." : "Input Address / Analyze"}
          </button>
          
          {apiError ? <div className="errorBox">{apiError}</div> : null}
        </aside>

        {/* --- ส่วนแสดงผลลัพธ์ (ซ่อนไว้ถ้ายังไม่กดวิเคราะห์) --- */}
        {!result && !loadingScan ? (
          <section className="panelCard" style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "500px", color: "#94a3b8" }}>
            <div style={{ fontSize: "64px", marginBottom: "20px" }}>📊</div>
            <h2>ยินดีต้อนรับสู่ SunnyDrive</h2>
            <p>กรอกข้อมูลและกดปุ่ม "Analyze Now" เพื่อคำนวณความคุ้มค่า</p>
          </section>
        ) : (
          <>
            <section className="centerPanel panelCard">
              <div className="panelHeader">Step 2: Interactive Roadmap</div>
              {loadingScan ? <div style={{ padding: "20px" }}>กำลังคำนวณข้อมูล...</div> : (
                <>
                  <div className="roadmapLine">
                    {(result?.milestones || [
                      { month: 1, title: "ติดตั้งเสร็จสมบูรณ์" },
                      { month: 2, title: "เริ่มเห็นบิลลดลง" },
                      { month: 3, title: "ประหยัดไฟจาก EV" },
                    ]).map((m) => (
                      <div key={m.title} className="roadmapItem">
                        <div className="roadmapDot" />
                        <div>
                          <div className="roadmapMonth">Month {m.month}</div>
                          <div className="roadmapTitle">{m.title}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="miniMetric">
                    <div className="miniMetricLabel">ภาระค่าไฟหลังติดตั้ง</div>
                    <div className="miniMetricValue">{formatThb(monthlyAfterInstall)}</div>
                  </div>
                  <div className="loanCard">
                    <div className="loanTitle">Energy Model Summary</div>
                    <div className="summaryList">
                      <div>ผลิตไฟได้ ~{monthlyGeneration.toLocaleString()} kWh/เดือน</div>
                      <div>{recommendedPanels} แผง ({recommendedPhase})</div>
                      <div>{usagePatternLabel}</div>
                    </div>
                  </div>
                </>
              )}
            </section>

            <section className="rightPanel panelCard">
              <div className="panelHeader">ROI SHEET</div>
              {loadingScan ? <div style={{ padding: "20px" }}>กำลังเตรียมสรุปผล...</div> : (
                <>
                  <div className="hero yellowHero">
                    <div className="heroTop">
                      <div className="heroTitle">ภาระค่าไฟหลังติดตั้ง</div>
                      <div className="heroValue">{formatThb(monthlyAfterInstall)}</div>
                    </div>
                    <div className="heroMeta">
                      <span>ก่อนติดตั้ง: {formatThb(monthlyBill)}</span>
                      <span>ประหยัดได้: {formatThb(monthlySavingOnBill)}/เดือน</span>
                    </div>
                  </div>

                  <div className="cards4 compactCards">
                    <div className="statCard">
                      <div className="statLabel">งบติดตั้งประมาณ</div>
                      <div className="statValue">{formatThb(installCost)}</div>
                    </div>
                    <div className="statCard">
                      <div className="statLabel">คืนทุนใน</div>
                      <div className="statValue">{breakEvenYears} ปี</div>
                    </div>
                    <div className="statCard">
                      <div className="statLabel">ประหยัดต่อปี</div>
                      <div className="statValue">{formatThb(annualSaving)}</div>
                    </div>
                    <div className="statCard">
                      <div className="statLabel">ลดค่าไฟ</div>
                      <div className="statValue">{billReductionPct}%</div>
                    </div>
                  </div>

                  <div className="chartCard">
                    <div className="chartTitle">กำไรสะสม 20 ปี</div>
                    <div style={{ width: "100%", height: 220, marginTop: 8 }}>
                      <ResponsiveContainer>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="year" />
                          <YAxis tickFormatter={(v) => `฿${Math.round(v / 1000)}k`} />
                          <Tooltip formatter={(v) => formatThb(v)} />
                          <Line type="monotone" dataKey="profit" stroke="#16a34a" strokeWidth={3} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}