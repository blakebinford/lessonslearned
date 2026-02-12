import { useState, useRef, useCallback } from "react";
import * as api from "../api";
import { useToast } from "./Toast";
import {
  WORK_TYPES, PHASES, DISCIPLINES, SEVERITIES, ENVIRONMENTS,
  SEVERITY_COLORS, badge, inputStyle, selectStyle, btnPrimary, btnSecondary, labelStyle,
} from "../styles";

const emptyForm = { title: "", description: "", root_cause: "", recommendation: "", impact: "", work_type: "", phase: "", discipline: "", severity: "Medium", environment: "", project: "", location: "", keywords: "" };

export default function LessonsLog({ org, lessons, lessonsCount, setLessons, setLessonsCount }) {
  const { showToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [searchText, setSearchText] = useState("");
  const [filterDiscipline, setFilterDiscipline] = useState("All");
  const [filterSeverity, setFilterSeverity] = useState("All");
  const [filterWorkType, setFilterWorkType] = useState("All");

  const [lessonsPage, setLessonsPage] = useState(1);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const searchTimerRef = useRef(null);

  const importRef = useRef(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const fetchLessons = useCallback(async (page, search, discipline, severity, workType) => {
    if (!org) return;
    setLessonsLoading(true);
    try {
      const params = { page };
      if (search) params.search = search;
      if (discipline && discipline !== "All") params.discipline = discipline;
      if (severity && severity !== "All") params.severity = severity;
      if (workType && workType !== "All") params.work_type = workType;
      const data = await api.getLessons(org.id, params);
      setLessons(data.results || []);
      setLessonsCount(data.count || 0);
    } catch (err) {
      console.error("Failed to fetch lessons:", err);
    } finally {
      setLessonsLoading(false);
    }
  }, [org, setLessons, setLessonsCount]);

  const refreshLessons = useCallback(() => {
    return fetchLessons(lessonsPage, searchText, filterDiscipline, filterSeverity, filterWorkType);
  }, [fetchLessons, lessonsPage, searchText, filterDiscipline, filterSeverity, filterWorkType]);

  const totalPages = Math.ceil(lessonsCount / 50) || 1;

  const handleSearchChange = (val) => {
    setSearchText(val);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setLessonsPage(1);
      fetchLessons(1, val, filterDiscipline, filterSeverity, filterWorkType);
    }, 300);
  };

  const handleDisciplineChange = (val) => {
    setFilterDiscipline(val);
    setLessonsPage(1);
    fetchLessons(1, searchText, val, filterSeverity, filterWorkType);
  };

  const handleSeverityChange = (val) => {
    setFilterSeverity(val);
    setLessonsPage(1);
    fetchLessons(1, searchText, filterDiscipline, val, filterWorkType);
  };

  const handleWorkTypeChange = (val) => {
    setFilterWorkType(val);
    setLessonsPage(1);
    fetchLessons(1, searchText, filterDiscipline, filterSeverity, val);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setLessonsPage(newPage);
    fetchLessons(newPage, searchText, filterDiscipline, filterSeverity, filterWorkType);
  };

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim() || !org) return;
    try {
      if (editId) {
        await api.updateLesson(editId, form);
        await refreshLessons();
        showToast("Lesson updated", "success");
      } else {
        await api.createLesson({ ...form, organization: org.id });
        setLessonsPage(1);
        await fetchLessons(1, searchText, filterDiscipline, filterSeverity, filterWorkType);
        showToast("Lesson saved", "success");
      }
      setForm(emptyForm);
      setEditId(null);
      setShowForm(false);
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleEdit = (lesson) => {
    setForm(lesson);
    setEditId(lesson.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (deleteConfirmId === id) {
      try {
        await api.deleteLesson(id);
        setDeleteConfirmId(null);
        await refreshLessons();
        showToast("Lesson deleted", "success");
      } catch (err) { showToast(err.message, "error"); }
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(prev => prev === id ? null : prev), 4000);
    }
  };

  const handleImport = async (file) => {
    if (!org) return;
    try {
      const result = await api.importLessons(org.id, file);
      await refreshLessons();
      showToast(`Imported ${result.imported} lessons from "${result.filename}"`, "success");
    } catch (err) {
      showToast("Import failed: " + err.message, "error");
    }
  };

  const hasActiveFilters = searchText || filterDiscipline !== "All" || filterSeverity !== "All" || filterWorkType !== "All";

  const renderForm = () => (
    <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: 24, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
          {editId ? "Edit Lesson" : "New Lesson Learned"}
        </h3>
        <button onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }} style={btnSecondary}>Cancel</button>
      </div>
      <div style={{ display: "grid", gap: 16 }}>
        <div><span style={labelStyle}>Title *</span><input value={form.title} onChange={e => setField("title", e.target.value)} style={inputStyle} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div><span style={labelStyle}>Work Type</span><select value={form.work_type} onChange={e => setField("work_type", e.target.value)} style={selectStyle}><option value="">Select...</option>{WORK_TYPES.map(w => <option key={w}>{w}</option>)}</select></div>
          <div><span style={labelStyle}>Phase</span><select value={form.phase} onChange={e => setField("phase", e.target.value)} style={selectStyle}><option value="">Select...</option>{PHASES.map(p => <option key={p}>{p}</option>)}</select></div>
          <div><span style={labelStyle}>Discipline</span><select value={form.discipline} onChange={e => setField("discipline", e.target.value)} style={selectStyle}><option value="">Select...</option>{DISCIPLINES.map(d => <option key={d}>{d}</option>)}</select></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div><span style={labelStyle}>Severity</span><select value={form.severity} onChange={e => setField("severity", e.target.value)} style={selectStyle}>{SEVERITIES.map(s => <option key={s}>{s}</option>)}</select></div>
          <div><span style={labelStyle}>Environment</span><select value={form.environment} onChange={e => setField("environment", e.target.value)} style={selectStyle}><option value="">Select...</option>{ENVIRONMENTS.map(e => <option key={e}>{e}</option>)}</select></div>
          <div><span style={labelStyle}>Project</span><input value={form.project} onChange={e => setField("project", e.target.value)} style={inputStyle} /></div>
        </div>
        <div><span style={labelStyle}>Location</span><input value={form.location} onChange={e => setField("location", e.target.value)} style={inputStyle} /></div>
        <div><span style={labelStyle}>Description *</span><textarea value={form.description} onChange={e => setField("description", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} /></div>
        <div><span style={labelStyle}>Root Cause</span><textarea value={form.root_cause} onChange={e => setField("root_cause", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} /></div>
        <div><span style={labelStyle}>Recommendation</span><textarea value={form.recommendation} onChange={e => setField("recommendation", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} /></div>
        <div><span style={labelStyle}>Impact</span><textarea value={form.impact} onChange={e => setField("impact", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} /></div>
        <div><span style={labelStyle}>Keywords (comma-separated)</span><input value={form.keywords} onChange={e => setField("keywords", e.target.value)} style={inputStyle} /></div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={handleSave} disabled={!form.title || !form.description} style={{ ...btnPrimary, opacity: form.title && form.description ? 1 : 0.5 }}>
            {editId ? "Update" : "Save Lesson"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {showForm && renderForm()}
      <input ref={importRef} type="file" accept=".xlsx,.xls,.xlsm,.csv" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />
      {!showForm && (lessonsCount > 0 || hasActiveFilters) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => setShowForm(true)} style={btnPrimary}>+ New Lesson</button>
          <button onClick={() => importRef.current?.click()} style={btnSecondary}>📥 Import XLSX</button>
          <input value={searchText} onChange={e => handleSearchChange(e.target.value)} placeholder="Search..." style={{ ...inputStyle, width: 180, padding: "8px 12px" }} />
          <select value={filterDiscipline} onChange={e => handleDisciplineChange(e.target.value)} style={{ ...selectStyle, width: "auto", padding: "8px 10px" }}><option value="All">All Disciplines</option>{DISCIPLINES.map(d => <option key={d}>{d}</option>)}</select>
          <select value={filterSeverity} onChange={e => handleSeverityChange(e.target.value)} style={{ ...selectStyle, width: "auto", padding: "8px 10px" }}><option value="All">All Severities</option>{SEVERITIES.map(s => <option key={s}>{s}</option>)}</select>
          <select value={filterWorkType} onChange={e => handleWorkTypeChange(e.target.value)} style={{ ...selectStyle, width: "auto", padding: "8px 10px" }}><option value="All">All Work Types</option>{WORK_TYPES.map(w => <option key={w}>{w}</option>)}</select>
          <span style={{ fontSize: 11, color: "#475569", marginLeft: "auto" }}>{lessonsCount} result{lessonsCount !== 1 ? "s" : ""}</span>
        </div>
      )}
      {lessonsLoading && !showForm && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b", fontSize: 13 }}>Loading...</div>
      )}
      {!lessonsLoading && lessonsCount === 0 && !hasActiveFilters && !showForm && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <h3 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 18, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>No Lessons Yet</h3>
          <p style={{ fontSize: 13, color: "#475569", maxWidth: 420, margin: "0 auto 20px" }}>Start building your database by adding lessons or importing from a spreadsheet.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => setShowForm(true)} style={btnPrimary}>Add First Lesson</button>
            <button onClick={() => importRef.current?.click()} style={btnSecondary}>📥 Import from XLSX</button>
          </div>
        </div>
      )}
      {!lessonsLoading && lessonsCount === 0 && hasActiveFilters && !showForm && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b", fontSize: 13 }}>No lessons match the current filters.</div>
      )}
      {!lessonsLoading && !showForm && lessons.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {lessons.map(l => {
            const sev = SEVERITY_COLORS[l.severity] || SEVERITY_COLORS.Medium;
            return (
              <div key={l.id} style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#e2e8f0", margin: "0 0 6px" }}>{l.title}</h4>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={badge(sev)}>{l.severity}</span>
                      {l.discipline && <span style={badge({ bg: "#1a1a2e", text: "#93c5fd", border: "#1e40af" })}>{l.discipline}</span>}
                      {l.work_type && <span style={badge({ bg: "#1a1a2e", text: "#a78bfa", border: "#5b21b6" })}>{l.work_type}</span>}
                      {l.phase && <span style={badge({ bg: "#0d1f1a", text: "#4ade80", border: "#166534" })}>{l.phase}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => handleEdit(l)} style={{ background: "none", border: "1px solid #334155", borderRadius: 4, color: "#64748b", cursor: "pointer", padding: "3px 8px", fontSize: 10, fontFamily: "inherit" }}>Edit</button>
                    <button onClick={() => handleDelete(l.id)} style={{ background: deleteConfirmId === l.id ? "#7f1d1d" : "none", border: `1px solid ${deleteConfirmId === l.id ? "#991b1b" : "#334155"}`, borderRadius: 4, color: deleteConfirmId === l.id ? "#fca5a5" : "#64748b", cursor: "pointer", padding: "3px 8px", fontSize: 10, fontFamily: "inherit", fontWeight: deleteConfirmId === l.id ? 600 : 400 }}>
                      {deleteConfirmId === l.id ? "Confirm Delete" : "Delete"}
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: "#cbd5e1", margin: "0 0 8px", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{l.description}</p>
                {l.recommendation && (
                  <div style={{ fontSize: 12, color: "#94a3b8", padding: "8px 10px", background: "#0a0e17", borderRadius: 4, borderLeft: "3px solid #2563eb" }}>
                    <strong style={{ color: "#60a5fa" }}>Recommendation:</strong> {l.recommendation}
                  </div>
                )}
                <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: "#475569" }}>
                  {l.project && <span>📁 {l.project}</span>}
                  {l.location && <span>📍 {l.location}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!lessonsLoading && !showForm && totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 20, paddingTop: 16, borderTop: "1px solid #1e293b" }}>
          <button onClick={() => handlePageChange(lessonsPage - 1)} disabled={lessonsPage <= 1}
            style={{ ...btnSecondary, opacity: lessonsPage <= 1 ? 0.4 : 1, cursor: lessonsPage <= 1 ? "default" : "pointer" }}>Previous</button>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Page {lessonsPage} of {totalPages}</span>
          <button onClick={() => handlePageChange(lessonsPage + 1)} disabled={lessonsPage >= totalPages}
            style={{ ...btnSecondary, opacity: lessonsPage >= totalPages ? 0.4 : 1, cursor: lessonsPage >= totalPages ? "default" : "pointer" }}>Next</button>
        </div>
      )}
    </>
  );
}
