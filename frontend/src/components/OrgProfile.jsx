import { useState, useRef } from "react";
import * as api from "../api";
import { inputStyle, btnPrimary, btnSecondary, labelStyle } from "../styles";

export default function OrgProfile({ org, setOrg, onClose }) {
  const [orgForm, setOrgForm] = useState({ name: org?.name || "", profile_text: org?.profile_text || "" });
  const [orgSaved, setOrgSaved] = useState(false);
  const orgFileRef = useRef(null);

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

  return (
    <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: 18, marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h3 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#e2e8f0", margin: "0 0 4px" }}>Organization Profile</h3>
          <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>Tell the AI what programs your organization already has in place.</p>
        </div>
        <button onClick={onClose} style={btnSecondary}>Close</button>
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
}
