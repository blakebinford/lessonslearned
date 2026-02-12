import { useState, useRef, useEffect, useCallback, Fragment } from "react";
import * as api from "../api";
import { useToast } from "./Toast";
import LessonModal from "./LessonModal";
import {
  SOW_WORK_TYPES, SEVERITY_COLORS, badge,
  inputStyle, selectStyle, btnPrimary, btnSecondary,
} from "../styles";

export default function SOWAnalysis({ org, lessons, lessonsCount, onLessonsChanged }) {
  const { showToast } = useToast();
  const [sowText, setSowText] = useState("");
  const [sowFilename, setSowFilename] = useState("");
  const [sowWorkType, setSowWorkType] = useState("");
  const [sowAnalysis, setSowAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const sowFileRef = useRef(null);

  // History state
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const [modalLesson, setModalLesson] = useState(null);

  // Deliverables state
  const [deliverables, setDeliverables] = useState({});
  const [deliverablesLoading, setDeliverablesLoading] = useState({});

  // Staffing estimate form state
  const [staffingFormOpen, setStaffingFormOpen] = useState(false);
  const [staffingParams, setStaffingParams] = useState({
    pipe_diameter: "",
    weld_count: "",
    pipeline_mileage: "",
    num_spreads: 1,
    facilities_count: 0,
    duration_months: "",
    special_conditions: [],
  });

  const PIPE_DIAMETERS = ['4"', '6"', '8"', '10"', '12"', '16"', '20"', '24"', '30"', '36"', '42"', '48"'];
  const SPECIAL_CONDITIONS = [
    "Arctic/Cold Weather",
    "Sour Service",
    "FERC Jurisdictional",
    "Foreign Material Exclusion",
    "Class 3/4 Locations",
    "HDD Crossings",
    "Offshore/Water Crossing",
  ];

  const DELIVERABLE_CARDS = [
    { type: "risk_register", icon: "\u26A0\uFE0F", label: "Risk Register", desc: "Generate project risk register from applicable lessons" },
    { type: "staffing_estimate", icon: "\uD83D\uDC65", label: "Quality Staffing", desc: "Estimate quality staffing requirements for scope" },
    { type: "spec_gaps", icon: "\uD83D\uDCCB", label: "Specification Gaps", desc: "Flag code/standard risks from lessons history" },
    { type: "executive_narrative", icon: "\uD83D\uDCDD", label: "Executive Summary", desc: "One-page narrative for bid review" },
  ];

  const handleGenerateDeliverable = async (type, params = {}) => {
    if (!activeHistoryId) return;
    setDeliverablesLoading((prev) => ({ ...prev, [type]: true }));
    try {
      const result = await api.generateDeliverable(activeHistoryId, type, params);
      setDeliverables((prev) => ({ ...prev, [type]: result.content }));
      // Also update sowAnalysis so it persists in local state
      setSowAnalysis((prev) => {
        if (!prev) return prev;
        const updated = { ...prev };
        if (!updated.deliverables) updated.deliverables = {};
        updated.deliverables[type] = result.content;
        return updated;
      });
      if (type === "staffing_estimate") setStaffingFormOpen(false);
    } catch (err) {
      showToast(`Failed to generate deliverable: ${err.message}`, "error");
    } finally {
      setDeliverablesLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleGenerateStaffing = () => {
    const params = {
      pipe_diameter: staffingParams.pipe_diameter,
      weld_count: staffingParams.weld_count ? Number(staffingParams.weld_count) : null,
      pipeline_mileage: staffingParams.pipeline_mileage ? Number(staffingParams.pipeline_mileage) : null,
      num_spreads: Number(staffingParams.num_spreads) || 1,
      facilities_count: Number(staffingParams.facilities_count) || 0,
      duration_months: staffingParams.duration_months ? Number(staffingParams.duration_months) : null,
      special_conditions: staffingParams.special_conditions,
    };
    console.log(">>> STAFFING REQUEST PAYLOAD:", { analysis_id: activeHistoryId, deliverable_type: "staffing_estimate", params });
    handleGenerateDeliverable("staffing_estimate", params);
  };

  const toggleSpecialCondition = (condition) => {
    setStaffingParams((prev) => {
      const conditions = prev.special_conditions.includes(condition)
        ? prev.special_conditions.filter((c) => c !== condition)
        : [...prev.special_conditions, condition];
      return { ...prev, special_conditions: conditions };
    });
  };

  const handleCopyDeliverable = (content) => {
    const text = typeof content === "string" ? content : JSON.stringify(content, null, 2);
    navigator.clipboard.writeText(text).then(
      () => showToast("Copied to clipboard", "success"),
      () => showToast("Failed to copy", "error")
    );
  };

  const handleCopyRiskRegisterTable = (content) => {
    if (!content?.risks) return;
    const header = ["ID", "Category", "Risk Description", "L", "C", "Risk Level", "Mitigation", "Owner"].join("\t");
    const rows = content.risks.map(r =>
      [r.id, r.category, r.description, r.likelihood, r.consequence, r.risk_level, r.mitigation, r.owner].join("\t")
    );
    const tsv = [header, ...rows].join("\n");
    navigator.clipboard.writeText(tsv).then(
      () => showToast("Copied as table — paste into Excel or Word", "success"),
      () => showToast("Failed to copy", "error")
    );
  };

  const handleCopyStaffingTable = (content) => {
    if (!content?.positions) return;
    const header = ["Position", "Count", "Duration (months)", "Phase", "Justification"].join("\t");
    const rows = content.positions.map(p =>
      [p.title, p.count, p.duration_months, p.phase, p.justification].join("\t")
    );
    const summary = content.summary ? `Summary: ${content.summary}\n\n` : "";
    const costNote = content.cost_estimate
      ? `\n\nCost Estimate (ROM — For Bid Purposes Only)\nMonthly Burn Rate: $${(content.cost_estimate.monthly_burn_rate || 0).toLocaleString()}\nTotal Estimated: $${(content.cost_estimate.total_estimated || 0).toLocaleString()}\nBasis: ${content.cost_estimate.basis || ""}`
      : "";
    const tsv = summary + [header, ...rows].join("\n") + `\n\nTotal Headcount: ${content.total_headcount || ""}\nPeak Headcount: ${content.peak_headcount || ""}` + costNote;
    navigator.clipboard.writeText(tsv).then(
      () => showToast("Copied staffing estimate — paste into Excel or Word", "success"),
      () => showToast("Failed to copy", "error")
    );
  };

  // Track expanded risk rows
  const [expandedRisks, setExpandedRisks] = useState({});
  const toggleRiskExpand = (riskId) => {
    setExpandedRisks(prev => ({ ...prev, [riskId]: !prev[riskId] }));
  };

  const RISK_LEVEL_COLORS = {
    Critical: SEVERITY_COLORS.Critical,
    High: SEVERITY_COLORS.High,
    Medium: SEVERITY_COLORS.Medium,
    Low: SEVERITY_COLORS.Low,
  };

  const renderRiskRegister = (content) => {
    if (!content?.risks) return null;
    return (
      <div style={{ fontSize: 12 }}>
        {content.summary && (
          <p style={{ color: "#cbd5e1", lineHeight: 1.6, margin: "0 0 14px", padding: "10px 12px", background: "#111827", borderRadius: 6, borderLeft: "3px solid #a78bfa" }}>
            {content.summary}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button
            onClick={() => handleCopyRiskRegisterTable(content)}
            style={{ background: "none", border: "1px solid #334155", borderRadius: 4, padding: "5px 12px", cursor: "pointer", fontSize: 11, color: "#94a3b8" }}
          >
            {"\uD83D\uDCCB"} Copy as Table
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                {["ID", "Category", "Risk Description", "L", "C", "Risk Level", "Mitigation", "Owner"].map(h => (
                  <th key={h} style={{ background: "#1e293b", color: "#e2e8f0", padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", borderBottom: "2px solid #334155" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.risks.map((risk, i) => {
                const rlc = RISK_LEVEL_COLORS[risk.risk_level] || RISK_LEVEL_COLORS.Medium;
                const isExpanded = expandedRisks[risk.id];
                return (
                  <Fragment key={risk.id || i}>
                    <tr
                      onClick={() => toggleRiskExpand(risk.id)}
                      style={{ background: i % 2 === 0 ? "#0a0e17" : "#0f1629", cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#1a2332"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? "#0a0e17" : "#0f1629"; }}
                    >
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #1e293b", color: "#94a3b8", fontWeight: 600, whiteSpace: "nowrap" }}>{risk.id}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #1e293b", color: "#e2e8f0", whiteSpace: "nowrap" }}>{risk.category}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #1e293b", color: "#cbd5e1", maxWidth: 300 }}>{risk.description}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #1e293b", color: "#cbd5e1", textAlign: "center" }}>{risk.likelihood?.[0]}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #1e293b", color: "#cbd5e1", textAlign: "center" }}>{risk.consequence?.[0]}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #1e293b", textAlign: "center" }}>
                        <span style={{ ...badge(rlc), fontSize: 10 }}>{risk.risk_level}</span>
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #1e293b", color: "#cbd5e1", maxWidth: 260 }}>{risk.mitigation}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #1e293b", color: "#94a3b8", whiteSpace: "nowrap" }}>{risk.owner}</td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: "#111827" }}>
                        <td colSpan={8} style={{ padding: "10px 16px", borderBottom: "1px solid #1e293b" }}>
                          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                            <div>
                              <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Source Lessons</span>
                              <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {(risk.source_lessons || []).map((src, si) => {
                                  const lessonId = typeof src === "number" ? src : parseInt(src, 10);
                                  const lesson = !isNaN(lessonId) ? lessons.find(l => l.id === lessonId) : null;
                                  return lesson ? (
                                    <span
                                      key={si}
                                      onClick={(e) => { e.stopPropagation(); setModalLesson(lesson); }}
                                      style={{ fontSize: 11, color: "#60a5fa", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
                                    >
                                      {lesson.title}
                                    </span>
                                  ) : (
                                    <span key={si} style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>{String(src)}</span>
                                  );
                                })}
                              </div>
                            </div>
                            <div>
                              <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Residual Risk</span>
                              <div style={{ marginTop: 4, fontSize: 11, color: risk.residual_risk === "Medium" ? "#fb923c" : "#34d399" }}>{risk.residual_risk || "—"}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const [lessonsImpactOpen, setLessonsImpactOpen] = useState(false);

  const renderStaffingForm = () => {
    const fieldLabel = { fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 4, display: "block" };
    const fieldInput = { ...inputStyle, padding: "7px 10px", fontSize: 12 };
    return (
      <div style={{ padding: "14px 16px", borderTop: "1px solid #1e293b", background: "#0f1629" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#a78bfa", marginBottom: 12 }}>Staffing Estimate Parameters</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <label style={fieldLabel}>Pipe Diameter</label>
            <select
              value={staffingParams.pipe_diameter}
              onChange={(e) => setStaffingParams((p) => ({ ...p, pipe_diameter: e.target.value }))}
              style={{ ...selectStyle, padding: "7px 10px", fontSize: 12, width: "100%" }}
            >
              <option value="">Select...</option>
              {PIPE_DIAMETERS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Est. Weld Count</label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 2500"
              value={staffingParams.weld_count}
              onChange={(e) => setStaffingParams((p) => ({ ...p, weld_count: e.target.value }))}
              style={fieldInput}
            />
          </div>
          <div>
            <label style={fieldLabel}>Pipeline Mileage</label>
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder="e.g. 45.5"
              value={staffingParams.pipeline_mileage}
              onChange={(e) => setStaffingParams((p) => ({ ...p, pipeline_mileage: e.target.value }))}
              style={fieldInput}
            />
          </div>
          <div>
            <label style={fieldLabel}>Number of Spreads</label>
            <input
              type="number"
              min="1"
              value={staffingParams.num_spreads}
              onChange={(e) => setStaffingParams((p) => ({ ...p, num_spreads: e.target.value }))}
              style={fieldInput}
            />
          </div>
          <div>
            <label style={fieldLabel}>Facilities Count</label>
            <input
              type="number"
              min="0"
              placeholder="Compressor/meter stations"
              value={staffingParams.facilities_count}
              onChange={(e) => setStaffingParams((p) => ({ ...p, facilities_count: e.target.value }))}
              style={fieldInput}
            />
          </div>
          <div>
            <label style={fieldLabel}>Duration (months)</label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 18"
              value={staffingParams.duration_months}
              onChange={(e) => setStaffingParams((p) => ({ ...p, duration_months: e.target.value }))}
              style={fieldInput}
            />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Special Conditions</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SPECIAL_CONDITIONS.map((cond) => {
              const checked = staffingParams.special_conditions.includes(cond);
              return (
                <label
                  key={cond}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "5px 10px", borderRadius: 4, fontSize: 11, cursor: "pointer",
                    background: checked ? "#1e293b" : "#0a0e17",
                    border: checked ? "1px solid #6366f1" : "1px solid #1e293b",
                    color: checked ? "#c7d2fe" : "#94a3b8",
                    transition: "all 0.15s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSpecialCondition(cond)}
                    style={{ display: "none" }}
                  />
                  <span style={{ width: 14, height: 14, borderRadius: 3, border: checked ? "1px solid #6366f1" : "1px solid #475569", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, background: checked ? "#4f46e5" : "transparent", color: "#fff", flexShrink: 0 }}>
                    {checked ? "\u2713" : ""}
                  </span>
                  {cond}
                </label>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={() => setStaffingFormOpen(false)}
            style={{ ...btnSecondary, padding: "6px 14px", fontSize: 11 }}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerateStaffing}
            disabled={deliverablesLoading.staffing_estimate}
            style={{ ...btnPrimary, padding: "6px 16px", fontSize: 11, opacity: deliverablesLoading.staffing_estimate ? 0.6 : 1 }}
          >
            {deliverablesLoading.staffing_estimate ? "Generating..." : "Generate Estimate"}
          </button>
        </div>
      </div>
    );
  };

  const renderStaffingEstimate = (content) => {
    if (!content?.positions) return null;
    return (
      <div style={{ fontSize: 12 }}>
        {content.summary && (
          <p style={{ color: "#cbd5e1", lineHeight: 1.6, margin: "0 0 14px", padding: "10px 12px", background: "#111827", borderRadius: 6, borderLeft: "3px solid #a78bfa" }}>
            {content.summary}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 14 }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              Total: <strong style={{ color: "#e2e8f0" }}>{content.total_headcount}</strong>
            </span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              Peak: <strong style={{ color: "#fbbf24" }}>{content.peak_headcount}</strong>
            </span>
          </div>
          <button
            onClick={() => handleCopyStaffingTable(content)}
            style={{ background: "none", border: "1px solid #334155", borderRadius: 4, padding: "5px 12px", cursor: "pointer", fontSize: 11, color: "#94a3b8" }}
          >
            {"\uD83D\uDCCB"} Copy
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                {["Position", "Count", "Duration", "Phase", "Justification"].map(h => (
                  <th key={h} style={{ background: "#1e293b", color: "#e2e8f0", padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", borderBottom: "2px solid #334155" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.positions.map((pos, i) => {
                const isPeak = pos.count > 1;
                return (
                  <tr
                    key={i}
                    style={{
                      background: isPeak ? "#1a1a2e" : i % 2 === 0 ? "#0a0e17" : "#0f1629",
                      borderLeft: isPeak ? "3px solid #fbbf24" : "3px solid transparent",
                    }}
                  >
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #1e293b", color: "#e2e8f0", fontWeight: 600 }}>{pos.title}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #1e293b", color: isPeak ? "#fbbf24" : "#cbd5e1", textAlign: "center", fontWeight: isPeak ? 700 : 400 }}>{pos.count}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #1e293b", color: "#cbd5e1", textAlign: "center" }}>{pos.duration_months} mo</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #1e293b", color: "#94a3b8", whiteSpace: "nowrap" }}>{pos.phase}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #1e293b", color: "#94a3b8", maxWidth: 280 }}>{pos.justification}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {content.assumptions?.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Assumptions</div>
            <ul style={{ margin: 0, paddingLeft: 16, color: "#94a3b8", fontSize: 11, lineHeight: 1.8 }}>
              {content.assumptions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}

        {content.cost_estimate && (
          <div style={{ marginTop: 14, padding: "12px 14px", background: "#111827", borderRadius: 6, border: "1px solid #334155" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Cost Estimate</span>
              <span style={{ fontSize: 9, color: "#f87171", fontWeight: 700, background: "#1c1017", padding: "3px 8px", borderRadius: 3, border: "1px solid #7f1d1d" }}>ROM — For Bid Purposes Only</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: "#64748b" }}>Monthly Burn Rate</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#34d399" }}>${(content.cost_estimate.monthly_burn_rate || 0).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#64748b" }}>Total Estimated</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#34d399" }}>${(content.cost_estimate.total_estimated || 0).toLocaleString()}</div>
              </div>
            </div>
            {content.cost_estimate.basis && (
              <p style={{ fontSize: 11, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>{content.cost_estimate.basis}</p>
            )}
          </div>
        )}

        {content.lessons_impact?.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <button
              onClick={() => setLessonsImpactOpen(!lessonsImpactOpen)}
              style={{
                width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 12px", background: "#111827", border: "1px solid #1e293b", borderRadius: 6,
                cursor: "pointer", color: "#94a3b8", fontSize: 11, fontWeight: 600,
              }}
            >
              <span>Lessons that influenced this estimate ({content.lessons_impact.length})</span>
              <span style={{ transition: "transform 0.2s", transform: lessonsImpactOpen ? "rotate(180deg)" : "rotate(0deg)" }}>{"\u25BC"}</span>
            </button>
            {lessonsImpactOpen && (
              <div style={{ padding: "10px 12px", background: "#111827", borderTop: "none", border: "1px solid #1e293b", borderTopWidth: 0, borderRadius: "0 0 6px 6px" }}>
                {content.lessons_impact.map((impact, i) => (
                  <div key={i} style={{ padding: "6px 0", borderBottom: i < content.lessons_impact.length - 1 ? "1px solid #1e293b" : "none", fontSize: 11, color: "#cbd5e1", lineHeight: 1.5 }}>
                    {impact}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const fetchHistory = useCallback(async () => {
    if (!org) return;
    setLoadingHistory(true);
    try {
      const data = await api.getSOWAnalyses(org.id);
      setHistory(data.results || data);
    } catch {
      // Silently fail - history is supplementary
    } finally {
      setLoadingHistory(false);
    }
  }, [org]);

  // Fetch history on mount / org change
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSOWFile = async (file) => {
    setSowFilename(file.name);
    setSowAnalysis(null);
    setShowReport(false);
    setActiveHistoryId(null);
    try {
      const result = await api.uploadSOWFile(file);
      setSowText(result.text);
    } catch (err) {
      showToast("File upload failed: " + err.message + ". Try pasting text directly.", "error");
    }
  };

  const runAnalysis = async () => {
    if (!sowText || !org) return;
    setAnalyzing(true);
    setSowAnalysis(null);
    setShowReport(false);
    setActiveHistoryId(null);
    setDeliverables({});
    setDeliverablesLoading({});
    try {
      const result = await api.analyzeSOW(org.id, sowText, sowWorkType, sowFilename);
      setSowAnalysis(result.results);
      setActiveHistoryId(result.id);
      // Refresh history to include the new analysis
      fetchHistory();
    } catch (err) {
      showToast("Analysis failed: " + err.message, "error");
    } finally {
      setAnalyzing(false);
    }
  };

  const loadFromHistory = (item) => {
    setSowAnalysis(item.results);
    setSowFilename(item.filename || "");
    setSowWorkType(item.work_type || "");
    setSowText(item.sow_text || "");
    setActiveHistoryId(item.id);
    setShowReport(false);
    // Restore previously generated deliverables
    setDeliverables(item.results?.deliverables || {});
    setDeliverablesLoading({});
  };

  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    if (!activeHistoryId) return;
    setExporting(true);
    try {
      const resp = await api.exportSOWExcel(activeHistoryId);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = resp.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="?(.+?)"?$/);
      a.download = filenameMatch ? filenameMatch[1] : "SOW Analysis.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast("Excel export failed: " + err.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const startNewAnalysis = () => {
    setSowText("");
    setSowFilename("");
    setSowWorkType("");
    setSowAnalysis(null);
    setShowReport(false);
    setActiveHistoryId(null);
    setDeliverables({});
    setDeliverablesLoading({});
    if (sowFileRef.current) sowFileRef.current.value = "";
  };

  const renderReport = () => {
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const sortedMatches = [...(sowAnalysis.matches || [])].sort((a, b) => ({ High: 0, Medium: 1, Low: 2 }[a.relevance] || 2) - ({ High: 0, Medium: 1, Low: 2 }[b.relevance] || 2));
    const relStyle = (r) => ({ display: "inline-block", padding: "2px 10px", borderRadius: 4, fontSize: 10, fontWeight: 700, ...(r === "High" ? { background: "#fde8e8", color: "#c0392b" } : r === "Medium" ? { background: "#fef3e2", color: "#d35400" } : { background: "#e8f5e9", color: "#27ae60" }) });

    return (
      <div style={{ background: "#fff", color: "#1a1a1a", padding: 32, borderRadius: 8, fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #ddd" }}>
          <button onClick={() => setShowReport(false)} style={{ background: "none", border: "1px solid #ccc", borderRadius: 4, padding: "6px 14px", cursor: "pointer", fontSize: 12 }}>← Back</button>
          <button onClick={() => { const el = document.getElementById("ll-rpt"); if (el) navigator.clipboard.writeText(el.innerText); }} style={{ background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 4, padding: "6px 16px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>📋 Copy</button>
        </div>
        <div id="ll-rpt">
          <div style={{ borderBottom: "3px solid #1e3a5f", paddingBottom: 14, marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e3a5f", margin: "0 0 4px" }}>Lessons Learned — SOW Analysis</h1>
            <div style={{ fontSize: 12, color: "#666" }}>{sowFilename || "Scope Review"}</div>
          </div>
          <div style={{ display: "flex", gap: 28, marginBottom: 22, fontSize: 11, color: "#444", flexWrap: "wrap" }}>
            <div><strong>Date:</strong> {today}</div>
            <div><strong>Lessons:</strong> {lessonsCount}</div>
            <div><strong>Applicable:</strong> {sortedMatches.length}</div>
            {sowWorkType && <div><strong>Scope Type:</strong> {sowWorkType}</div>}
            <div><strong>Gaps:</strong> {sowAnalysis.gaps?.length || 0}</div>
          </div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1e3a5f", borderBottom: "1px solid #ddd", paddingBottom: 6, margin: "24px 0 12px" }}>1. Scope Summary</h2>
          <div style={{ background: "#f0f4f8", borderLeft: "4px solid #1e3a5f", padding: "14px 16px", borderRadius: 4, lineHeight: 1.6 }}>{sowAnalysis.summary}</div>
          {sortedMatches.length > 0 && (<>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1e3a5f", borderBottom: "1px solid #ddd", paddingBottom: 6, margin: "24px 0 12px" }}>2. Applicable Lessons ({sortedMatches.length})</h2>
            {["High", "Medium", "Low"].map(level => {
              const group = sortedMatches.filter(m => m.relevance === level);
              if (!group.length) return null;
              const bc = level === "High" ? "#c0392b" : level === "Medium" ? "#e67e22" : "#27ae60";
              return (<div key={level} style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={relStyle(level)}>{level} Relevance</span><span style={{ fontSize: 12, color: "#888" }}>({group.length})</span></div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead><tr>{["Lesson", "Why It Applies"].map(h => <th key={h} style={{ background: "#1e3a5f", color: "#fff", padding: "7px 10px", textAlign: "left", fontSize: 10, fontWeight: 600 }}>{h}</th>)}</tr></thead>
                  <tbody>{group.map((m, i) => {
                    const lesson = lessons.find(l => l.id === m.lessonId);
                    return (<tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8f9fa", borderLeft: `3px solid ${bc}` }}>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee", verticalAlign: "top", width: "35%" }}><strong>{lesson?.title || m.lessonId}</strong>{lesson && <div style={{ fontSize: 10, color: "#888", marginTop: 3 }}>{[lesson.discipline, lesson.work_type, lesson.project].filter(Boolean).join(" · ")}</div>}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee", color: "#555" }}>{m.reason}</td>
                    </tr>);
                  })}</tbody>
                </table>
              </div>);
            })}
          </>)}
          {sowAnalysis.recommendations?.length > 0 && (<>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1e3a5f", borderBottom: "1px solid #ddd", paddingBottom: 6, margin: "24px 0 12px" }}>3. Recommendations</h2>
            {sowAnalysis.recommendations.map((r, i) => <div key={i} style={{ padding: "10px 14px", background: "#fffbf0", borderLeft: "4px solid #e67e22", borderRadius: 4, marginBottom: 8 }}><span style={{ fontWeight: 700, color: "#e67e22" }}>{i + 1}.</span> {r}</div>)}
          </>)}
          {sowAnalysis.gaps?.length > 0 && (<>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1e3a5f", borderBottom: "1px solid #ddd", paddingBottom: 6, margin: "24px 0 12px" }}>4. Gaps</h2>
            {sowAnalysis.gaps.map((g, i) => <div key={i} style={{ padding: "10px 14px", background: "#fff5f5", borderLeft: "4px solid #e74c3c", borderRadius: 4, marginBottom: 8 }}>{g}</div>)}
          </>)}
          <div style={{ marginTop: 32, paddingTop: 12, borderTop: "1px solid #ddd", fontSize: 10, color: "#999", textAlign: "center" }}>Lessons Learned SOW Analysis · {today} · {lessonsCount} lessons on file</div>
        </div>
      </div>
    );
  };

  if (showReport && sowAnalysis && !sowAnalysis.error) return renderReport();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#e2e8f0", margin: 0 }}>Upload Scope of Work</h3>
          {sowAnalysis && (
            <button onClick={startNewAnalysis} style={{ ...btnSecondary, padding: "6px 14px", fontSize: 12 }}>
              🔄 New Analysis
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div onClick={() => sowFileRef.current?.click()} style={{ padding: "12px 20px", border: "2px dashed #1e293b", borderRadius: 8, background: "#0a0e17", cursor: "pointer" }}>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>📄 {sowFilename || "Upload .docx, .txt, or .pdf"}</span>
            <input ref={sowFileRef} type="file" accept=".docx,.txt,.pdf,.doc" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleSOWFile(f); }} />
          </div>
          <select value={sowWorkType} onChange={e => setSowWorkType(e.target.value)} style={{ ...selectStyle, width: "auto", minWidth: 180, padding: "10px 12px" }}>
            <option value="">All Work Types</option>
            {SOW_WORK_TYPES.map(w => <option key={w}>{w}</option>)}
          </select>
          <button onClick={runAnalysis} disabled={analyzing || !sowText || !org} style={{ ...btnPrimary, opacity: sowText && org ? 1 : 0.5 }}>
            {analyzing ? "Analyzing..." : "⚡ Analyze"}
          </button>
        </div>
        <textarea value={sowText} onChange={e => setSowText(e.target.value)} rows={6} placeholder="Or paste scope text here..." style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      {/* Past Analyses History Panel */}
      <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 8 }}>
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          style={{
            width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 18px", background: "transparent", border: "none", cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
            📁 Past Analyses {history.length > 0 && <span style={{ fontSize: 12, color: "#64748b", fontWeight: 400 }}>({history.length})</span>}
          </span>
          <span style={{ fontSize: 12, color: "#64748b", transition: "transform 0.2s", transform: historyOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
        </button>
        {historyOpen && (
          <div style={{ padding: "0 18px 14px", borderTop: "1px solid #1e293b" }}>
            {loadingHistory ? (
              <div style={{ padding: "16px 0", textAlign: "center", fontSize: 12, color: "#64748b" }}>Loading history...</div>
            ) : history.length === 0 ? (
              <div style={{ padding: "16px 0", textAlign: "center", fontSize: 12, color: "#64748b" }}>No past analyses yet. Run your first analysis above.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                {history.map((item) => {
                  const matchCount = item.results?.matches?.length || 0;
                  const isActive = activeHistoryId === item.id;
                  const date = new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                  const time = new Date(item.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                  return (
                    <div
                      key={item.id}
                      onClick={() => loadFromHistory(item)}
                      style={{
                        padding: "10px 14px", borderRadius: 6, cursor: "pointer",
                        background: isActive ? "#1e293b" : "#0a0e17",
                        border: isActive ? "1px solid #3b82f6" : "1px solid transparent",
                        transition: "background 0.15s, border-color 0.15s",
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#151d2e"; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "#0a0e17"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: isActive ? "#60a5fa" : "#e2e8f0" }}>
                          {item.filename || "Pasted text"}
                        </span>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{date}, {time}</span>
                      </div>
                      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                        {item.work_type && (
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>{item.work_type}</span>
                        )}
                        <span style={{ fontSize: 11, color: "#34d399" }}>{matchCount} match{matchCount !== 1 ? "es" : ""}</span>
                        {(item.results?.gaps?.length || 0) > 0 && (
                          <span style={{ fontSize: 11, color: "#f87171" }}>{item.results.gaps.length} gap{item.results.gaps.length !== 1 ? "s" : ""}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {sowAnalysis && !sowAnalysis.error && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: "12px 18px" }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{sowAnalysis.matches?.length || 0} applicable · {sowAnalysis.gaps?.length || 0} gaps</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowReport(true)} style={{ ...btnPrimary, padding: "8px 16px" }}>📄 Export for Bid Review</button>
              <button onClick={handleExportExcel} disabled={exporting || !activeHistoryId} style={{ ...btnPrimary, padding: "8px 16px", background: "#217346", opacity: !activeHistoryId ? 0.5 : 1 }}>
                {exporting ? "Exporting..." : "📊 Export to Excel"}
              </button>
            </div>
          </div>
          <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: 18 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: "#60a5fa", margin: "0 0 8px" }}>SCOPE SUMMARY</h4>
            <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>{sowAnalysis.summary}</p>
          </div>
          {sowAnalysis.matches?.length > 0 && (
            <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: 18 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: "#34d399", margin: "0 0 14px" }}>APPLICABLE LESSONS ({sowAnalysis.matches.length})</h4>
              {["High", "Medium", "Low"].map(level => {
                const group = sowAnalysis.matches.filter(m => m.relevance === level);
                if (!group.length) return null;
                const gc = level === "High" ? SEVERITY_COLORS.Critical : level === "Medium" ? SEVERITY_COLORS.High : SEVERITY_COLORS.Low;
                return (
                  <div key={level} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={badge(gc)}>{level} Relevance</span>
                      <span style={{ fontSize: 11, color: "#475569" }}>({group.length})</span>
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {group.map((m, i) => {
                        const lesson = lessons.find(l => l.id === m.lessonId);
                        return (
                          <div
                            key={i}
                            onClick={() => lesson && setModalLesson(lesson)}
                            style={{ padding: "12px 14px", background: "#0a0e17", borderRadius: 6, borderLeft: `3px solid ${gc.text}`, cursor: lesson ? "pointer" : "default", transition: "background 0.15s" }}
                            onMouseEnter={e => { if (lesson) e.currentTarget.style.background = "#0f1629"; }}
                            onMouseLeave={e => { if (lesson) e.currentTarget.style.background = "#0a0e17"; }}
                          >
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{lesson?.title || m.lessonId}</span>
                            <p style={{ fontSize: 12, color: "#94a3b8", margin: "6px 0 0", lineHeight: 1.5 }}>{m.reason}</p>
                            {lesson?.recommendation && <p style={{ fontSize: 12, color: "#60a5fa", margin: "6px 0 0" }}>💡 {lesson.recommendation}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {sowAnalysis.recommendations?.length > 0 && (
            <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: 18 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: "#fb923c", margin: "0 0 12px" }}>RECOMMENDATIONS</h4>
              {sowAnalysis.recommendations.map((r, i) => (
                <div key={i} style={{ padding: "10px 12px", background: "#0a0e17", borderRadius: 6, fontSize: 13, color: "#cbd5e1", marginBottom: 8, display: "flex", gap: 8 }}>
                  <span style={{ color: "#fb923c", fontWeight: 700 }}>{i + 1}.</span> {r}
                </div>
              ))}
            </div>
          )}
          {sowAnalysis.gaps?.length > 0 && (
            <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: 18 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: "#f87171", margin: "0 0 12px" }}>GAPS</h4>
              {sowAnalysis.gaps.map((g, i) => (
                <div key={i} style={{ padding: "10px 12px", background: "#0a0e17", borderRadius: 6, fontSize: 13, color: "#cbd5e1", marginBottom: 8, borderLeft: "3px solid #f87171" }}>{g}</div>
              ))}
            </div>
          )}

          {/* Generate Deliverables Section */}
          <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: 18 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: "#a78bfa", margin: "0 0 14px" }}>GENERATE DELIVERABLES</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {DELIVERABLE_CARDS.map((card) => {
                const content = deliverables[card.type];
                const loading = deliverablesLoading[card.type];
                const isStaffing = card.type === "staffing_estimate";
                return (
                  <div key={card.type} style={{ background: "#0a0e17", borderRadius: 8, border: content ? "1px solid #334155" : "1px solid #1e293b", overflow: "hidden", gridColumn: isStaffing && (staffingFormOpen || (content?.positions)) ? "1 / -1" : undefined }}>
                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div>
                          <span style={{ fontSize: 14 }}>{card.icon}</span>{" "}
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{card.label}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {content && !isStaffing && (
                            <button
                              onClick={() => handleCopyDeliverable(content)}
                              style={{ background: "none", border: "1px solid #334155", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "#94a3b8" }}
                              title="Copy to clipboard"
                            >
                              {"\uD83D\uDCCB"} Copy
                            </button>
                          )}
                          <button
                            onClick={() => isStaffing ? setStaffingFormOpen(!staffingFormOpen) : handleGenerateDeliverable(card.type)}
                            disabled={loading || !activeHistoryId}
                            style={{
                              ...btnPrimary,
                              padding: "4px 12px",
                              fontSize: 11,
                              opacity: loading || !activeHistoryId ? 0.6 : 1,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            {loading ? (
                              <>
                                <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #ffffff40", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                                Generating...
                              </>
                            ) : content ? "Regenerate" : "Generate"}
                          </button>
                        </div>
                      </div>
                      <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.4 }}>{card.desc}</p>
                    </div>
                    {isStaffing && staffingFormOpen && !loading && renderStaffingForm()}
                    {content && (
                      <div style={{ padding: "12px 16px", borderTop: "1px solid #1e293b", background: "#0f1629" }}>
                        {content.status === "stub" ? (
                          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                            <span style={{ fontWeight: 600, color: "#a78bfa" }}>{content.title}</span>
                            <p style={{ margin: "6px 0 0" }}>{content.message}</p>
                          </div>
                        ) : content.status === "error" ? (
                          <div style={{ fontSize: 12, color: "#f87171", lineHeight: 1.6 }}>
                            <span style={{ fontWeight: 600 }}>{content.title || "Error"}</span>
                            <p style={{ margin: "6px 0 0" }}>{content.message}</p>
                          </div>
                        ) : card.type === "risk_register" && content.risks ? (
                          renderRiskRegister(content)
                        ) : isStaffing && content.positions ? (
                          renderStaffingEstimate(content)
                        ) : (
                          <pre style={{ fontSize: 12, color: "#cbd5e1", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                            {typeof content === "string" ? content : JSON.stringify(content, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      <LessonModal
        lesson={modalLesson}
        onClose={() => setModalLesson(null)}
        onSaved={() => { setModalLesson(null); if (onLessonsChanged) onLessonsChanged(); }}
      />
    </div>
  );
}
