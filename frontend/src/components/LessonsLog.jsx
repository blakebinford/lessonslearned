import { useState, useRef, useCallback, useEffect } from "react";
import * as api from "../api";
import { useToast } from "./Toast";
import LessonModal from "./LessonModal";
import {
  WORK_TYPES, PHASES, DISCIPLINES, SEVERITIES, ENVIRONMENTS,
  SEVERITY_COLORS, badge, inputStyle, selectStyle, btnPrimary, btnSecondary, labelStyle,
} from "../styles";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 50;

const emptyForm = { title: "", description: "", root_cause: "", recommendation: "", impact: "", work_type: "", phase: "", discipline: "", severity: "Medium", environment: "", project: "", location: "", keywords: "" };

const pgBtn = {
  minWidth: 32, height: 32, padding: "0 8px", borderRadius: 6,
  border: "1px solid #334155", background: "transparent", color: "#94a3b8",
  fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};
const pgBtnActive = {
  background: "#2563eb", color: "#fff", border: "1px solid #2563eb", fontWeight: 600,
};

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

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
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const searchTimerRef = useRef(null);

  const importRef = useRef(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [modalLesson, setModalLesson] = useState(null);
  const [stats, setStats] = useState(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!org) return;
    try {
      const data = await api.getLessonStats(org.id);
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, [org]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const fetchLessons = useCallback(async (page, search, discipline, severity, workType, size) => {
    if (!org) return;
    setLessonsLoading(true);
    try {
      const params = { page, page_size: size ?? pageSize };
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
  }, [org, pageSize, setLessons, setLessonsCount]);

  const refreshLessons = useCallback(() => {
    fetchStats();
    return fetchLessons(lessonsPage, searchText, filterDiscipline, filterSeverity, filterWorkType);
  }, [fetchLessons, fetchStats, lessonsPage, searchText, filterDiscipline, filterSeverity, filterWorkType]);

  const totalPages = Math.ceil(lessonsCount / pageSize) || 1;

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

  const handlePageSizeChange = (newSize) => {
    const size = Number(newSize);
    setPageSize(size);
    setLessonsPage(1);
    fetchLessons(1, searchText, filterDiscipline, filterSeverity, filterWorkType, size);
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
        fetchStats();
        await fetchLessons(1, searchText, filterDiscipline, filterSeverity, filterWorkType, pageSize);
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

  // Bulk selection helpers
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (lessons.length > 0 && lessons.every(l => selectedIds.has(l.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(lessons.map(l => l.id)));
    }
  };

  const allOnPageSelected = lessons.length > 0 && lessons.every(l => selectedIds.has(l.id));

  // Clear selection when lessons change (page, filter, etc.)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [lessonsPage, filterDiscipline, filterSeverity, filterWorkType, searchText]);

  // Bulk delete
  const handleBulkDelete = async () => {
    setBulkActionLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await api.bulkDeleteLessons(ids);
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      await refreshLessons();
      showToast(`Deleted ${result.deleted} lesson${result.deleted !== 1 ? "s" : ""}`, "success");
    } catch (err) {
      showToast("Bulk delete failed: " + err.message, "error");
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk update
  const handleBulkUpdate = async (fields) => {
    setBulkActionLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await api.bulkUpdateLessons(ids, fields);
      setSelectedIds(new Set());
      await refreshLessons();
      const fieldName = Object.keys(fields)[0].replace("_", " ");
      showToast(`Updated ${fieldName} on ${result.updated} lesson${result.updated !== 1 ? "s" : ""}`, "success");
    } catch (err) {
      showToast("Bulk update failed: " + err.message, "error");
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Export selected as CSV
  const handleExportSelected = () => {
    const selected = lessons.filter(l => selectedIds.has(l.id));
    if (selected.length === 0) return;
    const headers = ["Title", "Description", "Root Cause", "Recommendation", "Impact", "Severity", "Work Type", "Discipline", "Phase", "Environment", "Project", "Location", "Keywords"];
    const keys = ["title", "description", "root_cause", "recommendation", "impact", "severity", "work_type", "discipline", "phase", "environment", "project", "location", "keywords"];
    const escape = (v) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [headers.join(",")];
    for (const l of selected) {
      rows.push(keys.map(k => escape(l[k])).join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lessons-export.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${selected.length} lesson${selected.length !== 1 ? "s" : ""} to CSV`, "success");
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

  const statCard = { background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: "12px 16px", minWidth: 0, flex: 1 };
  const statLabel = { fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 4 };
  const statValue = { fontSize: 20, fontWeight: 700, color: "#e2e8f0", fontFamily: "'IBM Plex Sans', sans-serif" };

  const renderStatsBar = () => {
    if (!stats || stats.total === 0) return null;
    const sevOrder = ["Critical", "High", "Medium", "Low"];
    const trendDiff = stats.this_month - stats.last_month;
    const trendArrow = trendDiff > 0 ? "\u2191" : trendDiff < 0 ? "\u2193" : "\u2192";
    const trendColor = trendDiff > 0 ? "#34d399" : trendDiff < 0 ? "#f87171" : "#94a3b8";
    return (
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {/* Total */}
        <div style={statCard}>
          <div style={statLabel}>Total Lessons</div>
          <div style={statValue}>{stats.total}</div>
        </div>
        {/* Severity breakdown */}
        <div style={{ ...statCard, flex: 2 }}>
          <div style={statLabel}>By Severity</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            {sevOrder.map(s => {
              const count = stats.by_severity[s] || 0;
              if (count === 0) return null;
              const c = SEVERITY_COLORS[s];
              return <span key={s} style={badge(c)}>{s}: {count}</span>;
            })}
          </div>
        </div>
        {/* Top disciplines */}
        <div style={statCard}>
          <div style={statLabel}>Top Disciplines</div>
          <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.7, marginTop: 2 }}>
            {Object.keys(stats.by_discipline).length === 0
              ? <span style={{ color: "#475569" }}>--</span>
              : Object.entries(stats.by_discipline).map(([name, n]) => (
                  <div key={name} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                    <span style={{ color: "#64748b", fontWeight: 600, flexShrink: 0 }}>{n}</span>
                  </div>
                ))}
          </div>
        </div>
        {/* Top work types */}
        <div style={statCard}>
          <div style={statLabel}>Top Work Types</div>
          <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.7, marginTop: 2 }}>
            {Object.keys(stats.by_work_type).length === 0
              ? <span style={{ color: "#475569" }}>--</span>
              : Object.entries(stats.by_work_type).map(([name, n]) => (
                  <div key={name} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                    <span style={{ color: "#64748b", fontWeight: 600, flexShrink: 0 }}>{n}</span>
                  </div>
                ))}
          </div>
        </div>
        {/* Monthly trend */}
        <div style={statCard}>
          <div style={statLabel}>This Month</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={statValue}>{stats.this_month}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: trendColor }}>{trendArrow}</span>
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>vs {stats.last_month} last month</div>
        </div>
      </div>
    );
  };

  return (
    <>
      {showForm && renderForm()}
      {!showForm && renderStatsBar()}
      <input ref={importRef} type="file" accept=".xlsx,.xls,.xlsm,.csv" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />
      {!showForm && (lessonsCount > 0 || hasActiveFilters) && (
        <div style={{ display: "flex", gap: 8, marginBottom: selectedIds.size > 0 ? 0 : 16, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => setShowForm(true)} style={btnPrimary}>+ New Lesson</button>
          <button onClick={() => importRef.current?.click()} style={btnSecondary}>📥 Import XLSX</button>
          <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 12, color: "#94a3b8", userSelect: "none" }}>
            <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll}
              style={{ accentColor: "#2563eb", width: 15, height: 15, cursor: "pointer" }} />
            Select All
          </label>
          <input value={searchText} onChange={e => handleSearchChange(e.target.value)} placeholder="Search..." style={{ ...inputStyle, width: 180, padding: "8px 12px" }} />
          <select value={filterDiscipline} onChange={e => handleDisciplineChange(e.target.value)} style={{ ...selectStyle, width: "auto", padding: "8px 10px" }}><option value="All">All Disciplines</option>{DISCIPLINES.map(d => <option key={d}>{d}</option>)}</select>
          <select value={filterSeverity} onChange={e => handleSeverityChange(e.target.value)} style={{ ...selectStyle, width: "auto", padding: "8px 10px" }}><option value="All">All Severities</option>{SEVERITIES.map(s => <option key={s}>{s}</option>)}</select>
          <select value={filterWorkType} onChange={e => handleWorkTypeChange(e.target.value)} style={{ ...selectStyle, width: "auto", padding: "8px 10px" }}><option value="All">All Work Types</option>{WORK_TYPES.map(w => <option key={w}>{w}</option>)}</select>
          <span style={{ fontSize: 11, color: "#475569", marginLeft: "auto" }}>{lessonsCount} result{lessonsCount !== 1 ? "s" : ""}</span>
        </div>
      )}
      {/* Bulk action bar */}
      {!showForm && selectedIds.size > 0 && (
        <div style={{
          display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
          padding: "10px 16px", marginBottom: 16, marginTop: 8,
          background: "#1e293b", borderRadius: 8, border: "1px solid #334155",
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginRight: 4 }}>
            {selectedIds.size} selected
          </span>
          <button
            onClick={() => setShowBulkDeleteConfirm(true)}
            disabled={bulkActionLoading}
            style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #991b1b", background: "#7f1d1d", color: "#fca5a5", fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}
          >
            Delete Selected
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>Severity:</span>
            <select
              value=""
              onChange={e => { if (e.target.value) handleBulkUpdate({ severity: e.target.value }); }}
              disabled={bulkActionLoading}
              style={{ ...selectStyle, width: "auto", padding: "5px 8px", fontSize: 12 }}
            >
              <option value="">Set...</option>
              {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>Work Type:</span>
            <select
              value=""
              onChange={e => { if (e.target.value) handleBulkUpdate({ work_type: e.target.value }); }}
              disabled={bulkActionLoading}
              style={{ ...selectStyle, width: "auto", padding: "5px 8px", fontSize: 12 }}
            >
              <option value="">Set...</option>
              {WORK_TYPES.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <button
            onClick={handleExportSelected}
            disabled={bulkActionLoading}
            style={{ ...btnSecondary, padding: "6px 14px", fontSize: 12 }}
          >
            Export Selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "#64748b", fontSize: 12, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}
          >
            Clear selection
          </button>
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
              <div key={l.id} style={{ background: "#111827", border: selectedIds.has(l.id) ? "1px solid #2563eb" : "1px solid #1e293b", borderRadius: 8, padding: 16, display: "flex", gap: 12, alignItems: "start" }}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(l.id)}
                  onChange={() => toggleSelect(l.id)}
                  style={{ accentColor: "#2563eb", width: 16, height: 16, marginTop: 2, cursor: "pointer", flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <h4
                      onClick={() => setModalLesson(l)}
                      style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#e2e8f0", margin: "0 0 6px", cursor: "pointer", transition: "color 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.color = "#60a5fa"}
                      onMouseLeave={e => e.currentTarget.style.color = "#e2e8f0"}
                    >{l.title}</h4>
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
              </div>
            );
          })}
        </div>
      )}
      {!lessonsLoading && !showForm && lessonsCount > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid #1e293b", flexWrap: "wrap", gap: 12 }}>
          {/* Showing X–Y of Z */}
          <span style={{ fontSize: 12, color: "#64748b", minWidth: 140 }}>
            Showing {Math.min((lessonsPage - 1) * pageSize + 1, lessonsCount)}–{Math.min(lessonsPage * pageSize, lessonsCount)} of {lessonsCount}
          </span>

          {/* Page buttons */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => handlePageChange(1)} disabled={lessonsPage <= 1}
                style={{ ...pgBtn, opacity: lessonsPage <= 1 ? 0.3 : 1, cursor: lessonsPage <= 1 ? "default" : "pointer" }}
                title="First page">{"«"}</button>
              <button onClick={() => handlePageChange(lessonsPage - 1)} disabled={lessonsPage <= 1}
                style={{ ...pgBtn, opacity: lessonsPage <= 1 ? 0.3 : 1, cursor: lessonsPage <= 1 ? "default" : "pointer" }}
                title="Previous page">{"‹"}</button>
              {getPageNumbers(lessonsPage, totalPages).map((p, i) =>
                p === "..." ? (
                  <span key={`ellipsis-${i}`} style={{ color: "#475569", fontSize: 12, padding: "0 4px", userSelect: "none" }}>…</span>
                ) : (
                  <button key={p} onClick={() => handlePageChange(p)}
                    style={{ ...pgBtn, ...(p === lessonsPage ? pgBtnActive : {}) }}>
                    {p}
                  </button>
                )
              )}
              <button onClick={() => handlePageChange(lessonsPage + 1)} disabled={lessonsPage >= totalPages}
                style={{ ...pgBtn, opacity: lessonsPage >= totalPages ? 0.3 : 1, cursor: lessonsPage >= totalPages ? "default" : "pointer" }}
                title="Next page">{"›"}</button>
              <button onClick={() => handlePageChange(totalPages)} disabled={lessonsPage >= totalPages}
                style={{ ...pgBtn, opacity: lessonsPage >= totalPages ? 0.3 : 1, cursor: lessonsPage >= totalPages ? "default" : "pointer" }}
                title="Last page">{"»"}</button>
            </div>
          )}

          {/* Rows per page */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 140, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Rows per page:</span>
            <select value={pageSize} onChange={e => handlePageSizeChange(e.target.value)}
              style={{ ...selectStyle, width: "auto", padding: "4px 8px", fontSize: 12, minWidth: 52 }}>
              {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      )}
      {/* Bulk delete confirmation modal */}
      {showBulkDeleteConfirm && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowBulkDeleteConfirm(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div style={{
            background: "#111827", border: "1px solid #1e293b", borderRadius: 12,
            padding: 32, maxWidth: 440, width: "90%", textAlign: "center",
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>
              Delete {selectedIds.size} Lesson{selectedIds.size !== 1 ? "s" : ""}?
            </h3>
            <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24, lineHeight: 1.5 }}>
              Are you sure you want to delete {selectedIds.size} lesson{selectedIds.size !== 1 ? "s" : ""}? This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={bulkActionLoading}
                style={btnSecondary}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkActionLoading}
                style={{ ...btnPrimary, background: "#dc2626", opacity: bulkActionLoading ? 0.6 : 1 }}
              >
                {bulkActionLoading ? "Deleting..." : `Delete ${selectedIds.size} Lesson${selectedIds.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
      <LessonModal
        lesson={modalLesson}
        onClose={() => setModalLesson(null)}
        onSaved={() => { setModalLesson(null); refreshLessons(); }}
      />
    </>
  );
}
