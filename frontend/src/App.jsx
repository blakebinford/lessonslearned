import { useState, useEffect, useRef, useCallback } from "react";
import * as api from "./api";
import {
  WORK_TYPES, PHASES, DISCIPLINES, SEVERITIES, ENVIRONMENTS, SOW_WORK_TYPES,
  SEVERITY_COLORS, badge, inputStyle, selectStyle, btnPrimary, btnSecondary,
  labelStyle, globalCSS,
} from "./styles";

/* ════════════════════════════════
   AUTH SCREEN
   ════════════════════════════════ */
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = mode === "login"
        ? await api.login(username, password)
        : await api.register(username, password, email);
      localStorage.setItem("ll_token", data.token);
      localStorage.setItem("ll_user", data.username);
      onAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20 }}>
      <div style={{ width: 380, background: "#111827", border: "1px solid #1e293b", borderRadius: 12, padding: 32 }}>
        <h1 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 22, fontWeight: 700, color: "#e2e8f0", marginBottom: 4, textAlign: "center" }}>
          Lessons Learned
        </h1>
        <p style={{ fontSize: 12, color: "#64748b", textAlign: "center", marginBottom: 24 }}>
          {mode === "login" ? "Sign in to continue" : "Create your account"}
        </p>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <div>
            <span style={labelStyle}>Username</span>
            <input value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} required />
          </div>
          {mode === "register" && (
            <div>
              <span style={labelStyle}>Email</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
            </div>
          )}
          <div>
            <span style={labelStyle}>Password</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} required />
          </div>
          {error && <div style={{ fontSize: 12, color: "#f87171", padding: "8px 10px", background: "#2d0a0a", borderRadius: 4 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ ...btnPrimary, width: "100%", opacity: loading ? 0.6 : 1 }}>
            {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            style={{ background: "none", border: "none", color: "#60a5fa", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════
   MAIN DASHBOARD
   ════════════════════════════════ */
function Dashboard({ user, onLogout }) {
  // Core state
  const [org, setOrg] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("log");

  // Lesson form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const emptyForm = { title: "", description: "", root_cause: "", recommendation: "", impact: "", work_type: "", phase: "", discipline: "", severity: "Medium", environment: "", project: "", location: "", keywords: "" };
  const [form, setForm] = useState(emptyForm);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [filterDiscipline, setFilterDiscipline] = useState("All");
  const [filterSeverity, setFilterSeverity] = useState("All");
  const [filterWorkType, setFilterWorkType] = useState("All");

  // Pagination & loading
  const [lessonsPage, setLessonsPage] = useState(1);
  const [lessonsCount, setLessonsCount] = useState(0);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const searchTimerRef = useRef(null);

  // Import
  const importRef = useRef(null);
  const [importResult, setImportResult] = useState(null);

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Org profile
  const [showOrgProfile, setShowOrgProfile] = useState(false);
  const [orgForm, setOrgForm] = useState({ name: "", profile_text: "" });
  const [orgSaved, setOrgSaved] = useState(false);

  // SOW
  const [sowText, setSowText] = useState("");
  const [sowFilename, setSowFilename] = useState("");
  const [sowWorkType, setSowWorkType] = useState("");
  const [sowAnalysis, setSowAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const sowFileRef = useRef(null);
  const orgFileRef = useRef(null);

  // Chat
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Load org + lessons
  useEffect(() => {
    (async () => {
      try {
        const orgs = await api.getOrganizations();
        const results = orgs.results || orgs;
        if (results.length > 0) {
          const o = results[0];
          setOrg(o);
          setOrgForm({ name: o.name, profile_text: o.profile_text || "" });
          const lessonData = await api.getLessons(o.id);
          setLessons(lessonData.results || []);
          setLessonsCount(lessonData.count || 0);
        }
      } catch (err) {
        console.error("Load failed:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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
  }, [org]);

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

  // ── Handlers ──
  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim() || !org) return;
    try {
      if (editId) {
        await api.updateLesson(editId, form);
        await refreshLessons();
      } else {
        await api.createLesson({ ...form, organization: org.id });
        setLessonsPage(1);
        await fetchLessons(1, searchText, filterDiscipline, filterSeverity, filterWorkType);
      }
      setForm(emptyForm);
      setEditId(null);
      setShowForm(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = (lesson) => {
    setForm(lesson);
    setEditId(lesson.id);
    setShowForm(true);
    setActiveTab("log");
  };

  const handleDelete = async (id) => {
    if (deleteConfirmId === id) {
      try {
        await api.deleteLesson(id);
        setDeleteConfirmId(null);
        await refreshLessons();
      } catch (err) { alert(err.message); }
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(prev => prev === id ? null : prev), 4000);
    }
  };

  const handleImport = async (file) => {
    if (!org) return;
    setImportResult(null);
    try {
      const result = await api.importLessons(org.id, file);
      setImportResult({ success: true, ...result });
      await refreshLessons();
    } catch (err) {
      setImportResult({ error: err.message });
    }
  };

  const handleSaveOrg = async () => {
    if (!org) return;
    try {
      const updated = await api.updateOrganization(org.id, orgForm);
      setOrg(updated);
      setOrgSaved(true);
      setTimeout(() => setOrgSaved(false), 2000);
    } catch (err) { alert(err.message); }
  };

  const handleOrgDocUpload = async (file) => {
    try {
      const result = await api.uploadSOWFile(file);
      setOrgForm(prev => ({
        ...prev,
        profile_text: prev.profile_text
          ? prev.profile_text + "\n\n--- Extracted from " + file.name + " ---\n" + result.text.slice(0, 12000)
          : result.text.slice(0, 12000),
      }));
    } catch (err) { alert(err.message); }
  };

  // SOW
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

  // Chat
  const sendChat = async (text) => {
    if (!text.trim() || !org) return;
    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setChatInput("");
    setChatLoading(true);
    try {
      const data = await api.chatWithAnalyst(org.id, text, messages);
      setMessages([...newMessages, { role: "assistant", content: data.response }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Error connecting. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  // ═══════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════

  const renderOrgProfile = () => (
    <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: 18, marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h3 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#e2e8f0", margin: "0 0 4px" }}>Organization Profile</h3>
          <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>Tell the AI what programs your organization already has in place.</p>
        </div>
        <button onClick={() => setShowOrgProfile(false)} style={btnSecondary}>Close</button>
      </div>
      <div style={{ marginBottom: 12 }}>
        <span style={labelStyle}>Organization Name</span>
        <input value={orgForm.name} onChange={e => setOrgForm(prev => ({ ...prev, name: e.target.value }))} style={inputStyle} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <span style={labelStyle}>Existing Programs & Procedures</span>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button onClick={() => orgFileRef.current?.click()} style={{ ...btnSecondary, padding: "7px 14px", fontSize: 11 }}>📄 Upload Quality Manual</button>
          <input ref={orgFileRef} type="file" accept=".docx,.txt,.doc" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleOrgDocUpload(f); e.target.value = ""; }} />
        </div>
        <textarea value={orgForm.profile_text} onChange={e => setOrgForm(prev => ({ ...prev, profile_text: e.target.value }))}
          rows={8} placeholder="Paste or upload your QMS summary..." style={{ ...inputStyle, resize: "vertical", fontSize: 12 }} />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={handleSaveOrg} style={btnPrimary}>Save Profile</button>
        {orgSaved && <span style={{ fontSize: 12, color: "#34d399" }}>✓ Saved</span>}
      </div>
    </div>
  );

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

  const hasActiveFilters = searchText || filterDiscipline !== "All" || filterSeverity !== "All" || filterWorkType !== "All";

  const renderLog = () => (
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
      {importResult && !showForm && (
        <div style={{ marginBottom: 14, padding: "12px 16px", borderRadius: 8, fontSize: 13, background: importResult.error ? "#2d0a0a" : "#0d2918", border: `1px solid ${importResult.error ? "#991b1b" : "#166534"}`, color: importResult.error ? "#f87171" : "#34d399", display: "flex", justifyContent: "space-between" }}>
          <span>{importResult.error || `Imported ${importResult.imported} lessons from "${importResult.filename}"`}</span>
          <button onClick={() => setImportResult(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}>✕</button>
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

  const renderSOW = () => {
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

  const renderChat = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)", minHeight: 400 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 0", display: "flex", flexDirection: "column", gap: 16 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ width: 56, height: 56, borderRadius: 12, background: "linear-gradient(135deg, #1e3a5f, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24 }}>⚡</div>
            <h3 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 18, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>AI Lessons Analyst</h3>
            <p style={{ fontSize: 13, color: "#475569", maxWidth: 480, margin: "0 auto 24px" }}>
              {lessonsCount > 0 ? `${lessonsCount} lessons loaded. Ask about patterns, gaps, or draft new lessons.` : "Add lessons first."}
            </p>
            {lessonsCount > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxWidth: 520, margin: "0 auto" }}>
                {["What are the most common root causes?", "What gaps exist for Arctic work?", "Draft a lesson about preheat failures", "Which lessons apply to a new mainline spread?"]
                  .map((p, i) => <button key={i} onClick={() => sendChat(p)} style={{ padding: "12px 14px", borderRadius: 6, border: "1px solid #1e293b", background: "#111827", color: "#94a3b8", fontSize: 12, fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}>{p}</button>)}
              </div>
            )}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", padding: "0 4px" }}>
            <div style={{ maxWidth: "85%", padding: "12px 16px", borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: msg.role === "user" ? "#1e3a5f" : "#111827", border: `1px solid ${msg.role === "user" ? "#2563eb" : "#1e293b"}`, color: msg.role === "user" ? "#bfdbfe" : "#cbd5e1", fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
              {msg.role === "assistant" && <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: "#3b82f6", marginBottom: 6 }}>AI ANALYST</div>}
              {msg.content}
            </div>
          </div>
        ))}
        {chatLoading && (
          <div style={{ display: "flex", justifyContent: "flex-start", padding: "0 4px" }}>
            <div style={{ padding: "14px 18px", borderRadius: "12px 12px 12px 2px", background: "#111827", border: "1px solid #1e293b" }}>
              <div style={{ display: "flex", gap: 6 }}>{[0, 1, 2].map(n => <div key={n} style={{ width: 7, height: 7, borderRadius: "50%", background: "#3b82f6", animation: `pulse 1.2s ease-in-out ${n * 0.2}s infinite` }} />)}</div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div style={{ borderTop: "1px solid #1e293b", padding: "14px 0 0", display: "flex", gap: 8 }}>
        <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(chatInput); } }}
          placeholder="Ask about patterns, gaps, or draft new lessons..." rows={1} style={{ flex: 1, ...inputStyle, padding: "12px 14px" }} />
        <button onClick={() => sendChat(chatInput)} disabled={chatLoading || !chatInput.trim()} style={{ ...btnPrimary, opacity: chatLoading || !chatInput.trim() ? 0.4 : 1 }}>Send</button>
      </div>
    </div>
  );

  // ═══════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════
  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#64748b" }}>Loading...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, borderBottom: "1px solid #1e293b", paddingBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: lessonsCount > 0 ? "#34d399" : "#64748b", boxShadow: lessonsCount > 0 ? "0 0 8px #34d399" : "none" }} />
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 3, color: "#64748b", textTransform: "uppercase" }}>{lessonsCount} Lessons</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setShowOrgProfile(!showOrgProfile)} style={{ background: showOrgProfile ? "#1e293b" : "none", border: `1px solid ${org?.profile_text ? "#2563eb" : "#334155"}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", color: org?.profile_text ? "#60a5fa" : "#64748b" }}>
              ⚙ Org Profile {org?.profile_text ? "✓" : ""}
            </button>
            <span style={{ fontSize: 11, color: "#475569" }}>{user.username}</span>
            <button onClick={onLogout} style={{ background: "none", border: "1px solid #334155", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 10, color: "#64748b", fontFamily: "inherit" }}>Logout</button>
          </div>
        </div>
        <h1 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 26, fontWeight: 700, margin: "8px 0 4px", background: "linear-gradient(135deg, #e2e8f0, #94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Lessons Learned</h1>

        {showOrgProfile && renderOrgProfile()}

        <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
          {[{ key: "log", label: "📋 Lessons Log" }, { key: "sow", label: "📄 SOW Analysis" }, { key: "chat", label: "⚡ AI Analyst" }].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: "7px 16px", borderRadius: "6px 6px 0 0", border: `1px solid ${activeTab === tab.key ? "#2563eb" : "#1e293b"}`, borderBottom: activeTab === tab.key ? "1px solid #0a0e17" : "1px solid #1e293b", background: activeTab === tab.key ? "#0a0e17" : "#111827", color: activeTab === tab.key ? "#e2e8f0" : "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: -1 }}>{tab.label}</button>
          ))}
        </div>
      </div>

      {activeTab === "log" && renderLog()}
      {activeTab === "sow" && renderSOW()}
      {activeTab === "chat" && renderChat()}
    </div>
  );
}

/* ════════════════════════════════
   APP ROOT
   ════════════════════════════════ */
export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("ll_token");
    const username = localStorage.getItem("ll_user");
    if (token && username) setUser({ token, username });
  }, []);

  const handleAuth = (data) => setUser({ token: data.token, username: data.username });
  const handleLogout = () => {
    localStorage.removeItem("ll_token");
    localStorage.removeItem("ll_user");
    setUser(null);
  };

  return (
    <>
      <style>{globalCSS}</style>
      {user ? <Dashboard user={user} onLogout={handleLogout} /> : <AuthScreen onAuth={handleAuth} />}
    </>
  );
}
