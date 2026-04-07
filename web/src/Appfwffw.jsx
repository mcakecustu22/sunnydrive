import React, { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot, ReferenceArea, ResponsiveContainer
} from "recharts";

const API_BASE = "http://127.0.0.1:8000/api";

function formatThb(n) {
  const value = Number(n || 0);
  return `฿${value.toLocaleString()}`;
}

export default function App() {
  const [evModels, setEvModels] = useState([]);
  const [loadingScan, setLoadingScan] = useState(false);
  const [result, setResult] = useState(null);
  const [apiError, setApiError] = useState("");

  const [form, setForm] = useState({
    monthly_bill_thb: 3700,
    ice_gas_cost_month: 3000,
    loan_months: 84,
    latitude: 37.4220,
    longitude: -122.08418,
    roof_score: 0.82,
    radius_meters: 12,
    electricity_rate: 4.4,
    usage_pattern: "mixed",
    evs: [
      { id: Date.now(), model: "", custom_kwh_per_km: "", monthly_km: 1500, is_included_in_bill: false }
    ],
  });

  useEffect(() => {
    fetch(`${API_BASE}/ev-models/`)
      .then((r) => r.json())
      .then((data) => {
        const models = data.models || [];
        setEvModels(models);
        setForm((prev) => ({ ...prev, evs: [{ ...prev.evs[0], model: models[0] || "" }] }));
      })
      .catch(() => {
        const defaults = ["BYD Dolphin", "Tesla Model 3"];
        setEvModels(defaults);
        setForm((prev) => ({ ...prev, evs: [{ ...prev.evs[0], model: defaults[0] }] }));
      });
  }, []);

  const handleAddEv = () => {
    setForm((prev) => ({
      ...prev,
      evs: [...prev.evs, { id: Date.now(), model: evModels[0] || "", custom_kwh_per_km: "", monthly_km: 1500, is_included_in_bill: false }]
    }));
  };

  const handleRemoveEv = (idToRemove) => {
    setForm((prev) => ({ ...prev, evs: prev.evs.filter((ev) => ev.id !== idToRemove) }));
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
      setApiError("เชื่อมต่อ API ไม่สำเร็จ");
    } finally {
      setLoadingScan(false);
    }
  };

// --- อัปเดตชื่อตัวแปรให้ตรงกับ Backend 100% ---
  const beforeTotal = Number(result?.total_expense_before || 0);
  const afterTotal = Number(result?.total_expense_after || 0);
  const realSavingsMonth = Number(result?.total_savings_month || 0); // แก้ชื่อตรงนี้
  const monthlyLoan = Number(result?.loan_payment || 0); // แก้ชื่อตรงนี้
  const immediateProfit = Number(result?.immediate_profit_month || 0);
  const breakEvenYears = Number(result?.break_even_years || 0); // แก้ชื่อตรงนี้
  const roiRange = result?.roi_range || "-"; 
  
  const recommendedPanels = Number(result?.panels || 0); // แก้ชื่อตรงนี้
  const recommendedPhase = result?.phase || "-"; // แก้ชื่อตรงนี้
  const monthlyGeneration = Number(result?.monthly_generation_kwh || 0);
  const usagePatternLabel = result?.summary?.usage_type || "-"; // แก้ชื่อตรงนี้
  
  const cashflowData = result?.cashflow || []; // แก้ชื่อตรงนี้
  const monthlyBillBefore = Number(form.monthly_bill_thb || 0);
  const iceGasCostMonth = Number(form.ice_gas_cost_month || 0); // ดึงจากฟอร์มโดยตรง
  const newMonthlyBill = Number(result?.new_monthly_bill || 0);
  const evCostMonth = Number(result?.ev_cost_month || 0);

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brandIcon">▦</span>
          <div>
            <div className="brandTitle">SunnyDrive</div>
            <div className="brandSub">วางแผนประหยัดพลังงาน ครอบคลุมรถ EV ทุกคันในบ้านคุณ</div>
          </div>
        </div>
      </header>

      <main className="dashboard">
        <aside className="leftPanel panelCard">
          <div className="panelHeader">Step 1: Your Home & EV</div>
          
          <div className="section">
            <div className="labelRow">
              <div className="labelTitle">ค่าไฟเฉลี่ย/เดือน (บาท)</div>
            </div>
            <input 
              className="select" 
              type="number" 
              step="100" 
              value={form.monthly_bill_thb} 
              onChange={(e) => setForm({ ...form, monthly_bill_thb: Number(e.target.value) })} 
              placeholder="เช่น 3700"
            />
          </div>

          <div className="section">
            <div className="labelRow">
              <div className="labelTitle">ค่าน้ำมันเฉลี่ย/เดือน (บาท)</div>
            </div>
            <input 
              className="select" 
              type="number" 
              step="100" 
              value={form.ice_gas_cost_month} 
              onChange={(e) => setForm({ ...form, ice_gas_cost_month: Number(e.target.value) })} 
              placeholder="เช่น 3000"
            />
          </div>

          <div className="section">
            <div className="labelRow">
              <div className="labelTitle">ค่าไฟต่อหน่วย (บาท/kWh)</div>
            </div>
            <input
              type="number"
              className="select"
              step="0.1"
              value={form.electricity_rate}
              onChange={(e) => setForm({ ...form, electricity_rate: Number(e.target.value) })}
            />
          </div>

          <div className="section">
            <div className="labelRow">
              <div className="labelTitle">ระยะเวลาผ่อนชำระค่าแผงโซล่าเซลล์ (งวด)</div>
            </div>
            <select
              className="select"
              value={form.loan_months}
              onChange={(e) => setForm({ ...form, loan_months: Number(e.target.value) })}
            >
              <option value={48}>48 งวด (4 ปี)</option>
              <option value={60}>60 งวด (5 ปี)</option>
              <option value={72}>72 งวด (6 ปี)</option>
              <option value={84}>84 งวด (7 ปี)</option>
            </select>
          </div>

          <hr style={{ margin: "20px 0", borderColor: "#e5e7eb" }} />

          <div className="section">
            <div className="labelRow" style={{ marginBottom: "15px" }}>
              <div className="labelTitle" style={{ fontSize: "16px", fontWeight: "bold" }}>รถ EV ที่ใช้งาน หรือวางแผนในอนาคต</div>
              <button className="secondaryBtn" style={{ padding: "5px 10px", fontSize: "12px" }} onClick={handleAddEv}>+ เพิ่มรถ EV</button>
            </div>
            {form.evs.map((ev, index) => (
              <div key={ev.id} style={{ padding: "12px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb", marginBottom: "10px" }}>
                <label style={{ display: "block", marginBottom: "8px" }}>
                  <input type="checkbox" checked={ev.is_included_in_bill || false} onChange={(e) => handleEvChange(ev.id, "is_included_in_bill", e.target.checked)} />
                  รวมอยู่ในค่าไฟปัจจุบัน
                </label>
                <div className="labelRow" style={{ marginBottom: "8px" }}>
                  <div className="labelTitle" style={{ fontSize: "13px", color: "#6b7280" }}>คันที่ {index + 1}</div>
                  {form.evs.length > 1 && (
                    <button className="textBtn textRed" style={{ fontSize: "12px", color: "#ef4444", cursor: "pointer", border: "none", background: "none" }} onClick={() => handleRemoveEv(ev.id)}>
                      ลบ
                    </button>
                  )}
                </div>
                <select className="select" value={ev.model} onChange={(e) => handleEvChange(ev.id, 'model', e.target.value)} style={{ marginBottom: "10px" }}>
                  {evModels.map((m) => <option key={m} value={m}>{m}</option>)}
                  <option value="Other">อื่นๆ (ระบุค่าเอง)</option>
                </select>
                <div className="labelRow">
                  <div className="labelTitle" style={{ fontSize: "12px" }}>อัตรากินไฟ (kWh/km)</div>
                  <div className="labelValue" style={{ fontSize: "12px" }}>
                    {ev.custom_kwh_per_km ? "ใช้ค่า Custom" : (ev.model === "Other" ? "ต้องระบุ*" : "ใช้ค่าตามรุ่น")}
                  </div>
                </div>
                <input
                  type="number"
                  step="0.01"
                  placeholder={ev.model === "Other" ? "เช่น 0.15" : "ใช้ค่าตามรุ่น"}
                  className="select"
                  value={ev.custom_kwh_per_km || ""}
                  onChange={(e) => handleEvChange(ev.id, 'custom_kwh_per_km', e.target.value ? Number(e.target.value) : "")}
                />
                <div className="labelRow" style={{ marginTop: "8px" }}><div className="labelTitle" style={{ fontSize: "12px" }}>ระยะทางวิ่งต่อเดือน (km)</div></div>
                <input type="number" step="10" className="select" value={ev.monthly_km || 1500} onChange={(e) => handleEvChange(ev.id, "monthly_km", Number(e.target.value))} />
              </div>
            ))}
          </div>

          <hr style={{ margin: "20px 0", borderColor: "#e5e7eb" }} />

          <div className="section">
            <div className="labelRow">
              <div className="labelTitle">ช่วงเวลาใช้ไฟหลัก</div>
            </div>
            <select
              className="select"
              value={form.usage_pattern}
              onChange={(e) => setForm({ ...form, usage_pattern: e.target.value })}
            >
              <option value="day">กลางวัน</option>
              <option value="mixed">ผสม</option>
              <option value="night">กลางคืน</option>
            </select>
          </div>

          <div className="section">
            <div className="labelRow"><div className="labelTitle">พิกัดหลังคาบ้าน (Lat / Lng)</div></div>
            <div className="grid2">
              <input className="miniInput" type="number" step="0.00001" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })} placeholder="Lat" />
              <input className="miniInput" type="number" step="0.00001" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })} placeholder="Lng" />
            </div>
          </div>

          <button className="primaryBtn" onClick={onAnalyze} disabled={loadingScan} style={{ marginTop: "10px", width: "100%" }}>
            {loadingScan ? "กำลังคำนวณ..." : "Input Address / Analyze"}
          </button>
        </aside>

        <section className="centerPanel panelCard">
          <div className="panelHeader">Step 2: Interactive Roadmap</div>
          <div className="roadmapLine">
            {[{ month: 1, title: "ติดตั้งเสร็จสมบูรณ์ ระบบเริ่มจ่ายไฟ" }, { month: 2, title: "เริ่มรับกระแสเงินสดบวกรายเดือน" }, { month: 3, title: "ชาร์จ EV ด้วยแสงอาทิตย์" }].map((m) => (
              <div key={m.month} className="roadmapItem">
                <div className="roadmapDot" />
                <div>
                  <div className="roadmapMonth">Month {m.month}</div>
                  <div className="roadmapTitle">{m.title}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="loanCard" style={{ marginTop: "20px" }}>
            <div className="loanTitle">Energy Model Summary</div>
            <div className="summaryList">
              <div>ผลิตไฟได้ ~{monthlyGeneration.toLocaleString()} kWh/เดือน</div>
              <div>{recommendedPanels} แผง ({recommendedPhase})</div>
              <div>{usagePatternLabel}</div>
            </div>
          </div>
        </section>

        <section className="rightPanel panelCard">
          <div className="panelHeader">ROI SHEET</div>
          
          <div className="hero yellowHero">
            <div className="heroTop">
              <div className="heroTitle">คุณจะประหยัดรวม (ค่าไฟ + ค่าน้ำมัน)</div>
              <div className="heroValue">{formatThb(realSavingsMonth)} <span style={{fontSize:"16px", fontWeight:"normal"}}>/เดือน</span></div>
            </div>
          </div>

          <div className="chartCard" style={{ marginTop: "15px" }}>
            <div className="chartTitle">เปรียบเทียบภาระค่าใช้จ่ายรายเดือน</div>
            
            <div style={{ marginBottom: "15px", paddingBottom: "15px", borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: "14px", fontWeight: "bold", color: "#4b5563", marginBottom: "8px" }}>ก่อนติดตั้ง Solar</div>
              <div className="chartRow">
                <div className="chartRowLabel">- ค่าไฟบ้าน:</div>
                <div className="chartRowValue"><b>{formatThb(monthlyBillBefore)}</b></div>
              </div>
              <div className="chartRow">
                <div className="chartRowLabel">- ค่าน้ำมันรถ:</div>
                <div className="chartRowValue"><b>{formatThb(iceGasCostMonth)}</b></div>
              </div>
              <div className="chartRow" style={{ marginTop: "8px" }}>
                <div className="chartRowLabel" style={{ color: "#ef4444", fontWeight: "bold" }}>รวมรายจ่ายเดิม:</div>
                <div className="chartRowValue" style={{ color: "#ef4444", fontWeight: "bold" }}>{formatThb(beforeTotal)}</div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: "14px", fontWeight: "bold", color: "#166534", marginBottom: "8px" }}>หลังติดตั้ง Solar + ใช้ EV</div>
              <div className="chartRow">
                <div className="chartRowLabel chartRowLabelGreen">- ค่าไฟ (บ้าน+EV):</div>
                <div className="chartRowValue"><b>{formatThb(newMonthlyBill)}</b></div>
              </div>
              <div className="chartRow">
                <div className="chartRowLabel chartRowLabelGreen">- ค่าชาร์จ EV (ส่วนเกินจากโซลาร์):</div>
                <div className="chartRowValue"><b>{formatThb(evCostMonth)}</b></div>
              </div>
              <div className="chartRow" style={{ marginTop: "8px" }}>
                <div className="chartRowLabel" style={{ color: "#16a34a", fontWeight: "bold" }}>รวมรายจ่ายใหม่:</div>
                <div className="chartRowValue" style={{ color: "#16a34a", fontWeight: "bold" }}>{formatThb(afterTotal)}</div>
              </div>
            </div>
          </div>

          <div className="loanCard" style={{ borderColor: "#3b82f6", background: "#eff6ff", marginTop: "15px" }}>
            <div className="loanTitle" style={{ color: "#1e3a8a" }}>Financing Simulation</div>
            <div className="summaryList">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>ค่าผ่อนชำระธนาคาร ({form.loan_months} งวด):</span>
                <b>{formatThb(monthlyLoan)}/เดือน</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>ส่วนที่ประหยัดได้จริง:</span>
                <b>{formatThb(realSavingsMonth)}/เดือน</b>
              </div>
              <hr style={{ borderColor: "#bfdbfe", margin: "10px 0" }} />
              <div style={{ fontSize: "16px", fontWeight: "bold", color: immediateProfit > 0 ? "#16a34a" : "#ef4444", display: "flex", justifyContent: "space-between" }}>
                <span>กำไรเงินสด (Cashflow):</span>
                <span>{immediateProfit > 0 ? "+" : ""}{formatThb(immediateProfit)}/เดือน</span>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "15px" }}>
            <div style={{ padding: "10px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px", color: "#475569" }}>
              <b>ROI:</b> {breakEvenYears} ปี <br/><span style={{color: "#94a3b8"}}>(ช่วง {roiRange} ปี)</span>
            </div>
            <div style={{ padding: "10px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px", color: "#475569" }}>
              <b>Factoring:</b> รวมแผงเสื่อม ~0.5%/ปี และค่าไฟขึ้น ~2%/ปี
            </div>
          </div>

          <div className="chartCard" style={{ marginTop: "15px" }}>
            <div className="chartTitle">กระแสเงินสดสะสม (20 ปี)</div>
            <div style={{ width: "100%", height: 220, marginTop: 8 }}>
              <ResponsiveContainer>
                <LineChart data={cashflowData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="year" label={{ value: "ปี", position: "insideBottomRight", offset: -5 }} fontSize={11} />
                  <YAxis tickFormatter={(v) => `฿${Math.round(v / 1000)}k`} fontSize={11} width={45} />
                  <Tooltip
                    labelFormatter={(v) => `ปีที่ ${v}`}
                    formatter={(v) => formatThb(v)}
                  />
                  {breakEvenYears > 0 && (
                    <ReferenceArea x1={Math.floor(breakEvenYears)} x2={20} fill="#facc15" fillOpacity={0.14} />
                  )}
                  <Line type="monotone" dataKey="profit" name="กำไรสะสมสุทธิ" stroke="#16a34a" strokeWidth={3} dot={false} />
                  {breakEvenYears > 0 && (
                    <ReferenceDot
                      x={Math.ceil(breakEvenYears)}
                      y={0}
                      r={5}
                      fill="#0f172a"
                      stroke="#fff"
                      label={{ position: 'top', value: 'คืนทุน', fill: '#0f172a', fontSize: 11 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}