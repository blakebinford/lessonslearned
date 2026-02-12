import OrgProfile from "./OrgProfile";

export default function Header({ lessonsCount, org, setOrg, showOrgProfile, setShowOrgProfile, user, onLogout, activeTab, setActiveTab }) {
  return (
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

      {showOrgProfile && <OrgProfile org={org} setOrg={setOrg} onClose={() => setShowOrgProfile(false)} />}

      <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
        {[{ key: "log", label: "📋 Lessons Log" }, { key: "sow", label: "📄 SOW Analysis" }, { key: "chat", label: "⚡ AI Analyst" }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: "7px 16px", borderRadius: "6px 6px 0 0", border: `1px solid ${activeTab === tab.key ? "#2563eb" : "#1e293b"}`, borderBottom: activeTab === tab.key ? "1px solid #0a0e17" : "1px solid #1e293b", background: activeTab === tab.key ? "#0a0e17" : "#111827", color: activeTab === tab.key ? "#e2e8f0" : "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: -1 }}>{tab.label}</button>
        ))}
      </div>
    </div>
  );
}
