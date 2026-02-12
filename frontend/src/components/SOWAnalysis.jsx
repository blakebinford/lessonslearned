import { useState, useRef } from "react";
import * as api from "../api";
import {
  SOW_WORK_TYPES, SEVERITY_COLORS, badge,
  inputStyle, selectStyle, btnPrimary,
} from "../styles";

export default function SOWAnalysis({ org, lessons, lessonsCount }) {
  const [sowText, setSowText] = useState("");
  const [sowFilename, setSowFilename] = useState("");
  const [sowWorkType, setSowWorkType] = useState("");
  const [sowAnalysis, setSowAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const sowFileRef = useRef(null);

  const handleSOWFile = async (file) => {
    setSowFilename(file.name);
    setSowAnalysis(null);
    setShowReport(false);
    try {
      const result = await api.uploadSOWFile(file);
      setSowText(result.text);
    } catch (err) {
      setSowText(`Error: ${err.message}. Try pasting text directly.`);
    }
  };

  const runAnalysis = async () => {
    if (!sowText || !org) return;
    setAnalyzing(true);
    setSowAnalysis(null);
    setShowReport(false);
    try {
      const result = await api.analyzeSOW(org.id, sowText, sowWorkType, sowFilename);
      setSowAnalysis(result.results);
    } catch (err) {
      setSowAnalysis({ error: err.message });
    } finally {
      setAnalyzing(false);
    }
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
        <h3 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#e2e8f0", margin: "0 0 12px" }}>Upload Scope of Work</h3>
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

      {sowAnalysis && !sowAnalysis.error && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: "12px 18px" }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{sowAnalysis.matches?.length || 0} applicable · {sowAnalysis.gaps?.length || 0} gaps</span>
            <button onClick={() => setShowReport(true)} style={{ ...btnPrimary, padding: "8px 16px" }}>📄 Export for Bid Review</button>
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
                          <div key={i} style={{ padding: "12px 14px", background: "#0a0e17", borderRadius: 6, borderLeft: `3px solid ${gc.text}` }}>
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
        </div>
      )}
      {sowAnalysis?.error && (
        <div style={{ padding: "14px 16px", borderRadius: 8, background: "#2d0a0a", border: "1px solid #991b1b", color: "#f87171", fontSize: 13 }}>{sowAnalysis.error}</div>
      )}
    </div>
  );
}
