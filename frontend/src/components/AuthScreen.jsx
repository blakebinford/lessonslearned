import { useState } from "react";
import * as api from "../api";
import { inputStyle, btnPrimary, labelStyle } from "../styles";

export default function AuthScreen({ onAuth }) {
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
