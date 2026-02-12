import { useState, useEffect, useRef } from "react";
import * as api from "../api";
import { useToast } from "./Toast";
import {
  WORK_TYPES, PHASES, DISCIPLINES, SEVERITIES, ENVIRONMENTS,
  SEVERITY_COLORS, badge, inputStyle, selectStyle, btnPrimary, btnSecondary, labelStyle,
} from "../styles";

const overlayStyle = {
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 1000, padding: 20,
};

const modalStyle = {
  background: "#111827", border: "1px solid #1e293b", borderRadius: 10,
  width: "100%", maxWidth: 720, maxHeight: "90vh", overflow: "auto",
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
};

const fieldRow = (label, value) => {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <span style={{ ...labelStyle, marginBottom: 3 }}>{label}</span>
      <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{value}</div>
    </div>
  );
};

export default function LessonModal({ lesson, onClose, onSaved }) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (lesson) {
      setForm({ ...lesson });
      setEditing(false);
    }
  }, [lesson]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!lesson) return null;

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.title?.trim() || !form.description?.trim()) return;
    setSaving(true);
    try {
      await api.updateLesson(lesson.id, form);
      showToast("Lesson updated", "success");
      setEditing(false);
      if (onSaved) onSaved();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({ ...lesson });
    setEditing(false);
  };

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const sev = SEVERITY_COLORS[lesson.severity] || SEVERITY_COLORS.Medium;

  return (
    <div ref={overlayRef} style={overlayStyle} onClick={handleOverlayClick}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "#e2e8f0", margin: "0 0 8px", lineHeight: 1.4 }}>
              {lesson.title}
            </h3>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={badge(sev)}>{lesson.severity}</span>
              {lesson.discipline && <span style={badge({ bg: "#1a1a2e", text: "#93c5fd", border: "#1e40af" })}>{lesson.discipline}</span>}
              {lesson.work_type && <span style={badge({ bg: "#1a1a2e", text: "#a78bfa", border: "#5b21b6" })}>{lesson.work_type}</span>}
              {lesson.phase && <span style={badge({ bg: "#0d1f1a", text: "#4ade80", border: "#166534" })}>{lesson.phase}</span>}
              {lesson.environment && <span style={badge({ bg: "#1a1a2e", text: "#e2e8f0", border: "#334155" })}>{lesson.environment}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "2px 6px", flexShrink: 0 }} title="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          {editing ? (
            /* ── Edit Mode ── */
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <span style={labelStyle}>Title *</span>
                <input value={form.title || ""} onChange={e => setField("title", e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <span style={labelStyle}>Work Type</span>
                  <select value={form.work_type || ""} onChange={e => setField("work_type", e.target.value)} style={selectStyle}>
                    <option value="">Select...</option>
                    {WORK_TYPES.map(w => <option key={w}>{w}</option>)}
                  </select>
                </div>
                <div>
                  <span style={labelStyle}>Phase</span>
                  <select value={form.phase || ""} onChange={e => setField("phase", e.target.value)} style={selectStyle}>
                    <option value="">Select...</option>
                    {PHASES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <span style={labelStyle}>Discipline</span>
                  <select value={form.discipline || ""} onChange={e => setField("discipline", e.target.value)} style={selectStyle}>
                    <option value="">Select...</option>
                    {DISCIPLINES.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <span style={labelStyle}>Severity</span>
                  <select value={form.severity || "Medium"} onChange={e => setField("severity", e.target.value)} style={selectStyle}>
                    {SEVERITIES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <span style={labelStyle}>Environment</span>
                  <select value={form.environment || ""} onChange={e => setField("environment", e.target.value)} style={selectStyle}>
                    <option value="">Select...</option>
                    {ENVIRONMENTS.map(e => <option key={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <span style={labelStyle}>Project</span>
                  <input value={form.project || ""} onChange={e => setField("project", e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div>
                <span style={labelStyle}>Location</span>
                <input value={form.location || ""} onChange={e => setField("location", e.target.value)} style={inputStyle} />
              </div>
              <div>
                <span style={labelStyle}>Description *</span>
                <textarea value={form.description || ""} onChange={e => setField("description", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div>
                <span style={labelStyle}>Root Cause</span>
                <textarea value={form.root_cause || ""} onChange={e => setField("root_cause", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div>
                <span style={labelStyle}>Recommendation</span>
                <textarea value={form.recommendation || ""} onChange={e => setField("recommendation", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div>
                <span style={labelStyle}>Impact</span>
                <textarea value={form.impact || ""} onChange={e => setField("impact", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div>
                <span style={labelStyle}>Keywords (comma-separated)</span>
                <input value={form.keywords || ""} onChange={e => setField("keywords", e.target.value)} style={inputStyle} />
              </div>
            </div>
          ) : (
            /* ── View Mode ── */
            <div>
              {fieldRow("Description", lesson.description)}
              {fieldRow("Root Cause", lesson.root_cause)}
              {lesson.recommendation && (
                <div style={{ marginBottom: 12 }}>
                  <span style={{ ...labelStyle, marginBottom: 3 }}>Recommendation</span>
                  <div style={{ fontSize: 13, color: "#94a3b8", padding: "10px 12px", background: "#0a0e17", borderRadius: 4, borderLeft: "3px solid #2563eb", lineHeight: 1.6 }}>
                    {lesson.recommendation}
                  </div>
                </div>
              )}
              {fieldRow("Impact", lesson.impact)}
              {fieldRow("Project", lesson.project)}
              {fieldRow("Location", lesson.location)}
              {fieldRow("Keywords", lesson.keywords)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid #1e293b", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {editing ? (
            <>
              <button onClick={handleCancel} style={btnSecondary}>Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title?.trim() || !form.description?.trim()}
                style={{ ...btnPrimary, opacity: saving || !form.title?.trim() || !form.description?.trim() ? 0.5 : 1 }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} style={btnSecondary}>Close</button>
              <button onClick={() => setEditing(true)} style={btnPrimary}>Edit</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
