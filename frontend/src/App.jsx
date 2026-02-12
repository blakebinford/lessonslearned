import { useState, useEffect, useCallback } from "react";
import * as api from "./api";
import { globalCSS } from "./styles";
import AuthScreen from "./components/AuthScreen";
import Header from "./components/Header";
import LessonsLog from "./components/LessonsLog";
import SOWAnalysis from "./components/SOWAnalysis";
import ChatAnalyst from "./components/ChatAnalyst";

function Dashboard({ user, onLogout }) {
  const [org, setOrg] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("log");
  const [showOrgProfile, setShowOrgProfile] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const orgs = await api.getOrganizations();
        const results = orgs.results || orgs;
        if (results.length > 0) {
          const o = results[0];
          setOrg(o);
          const lessonData = await api.getLessons(o.id);
          setLessons(lessonData.results || lessonData);
        }
      } catch (err) {
        console.error("Load failed:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshLessons = useCallback(async () => {
    if (!org) return;
    const data = await api.getLessons(org.id);
    setLessons(data.results || data);
  }, [org]);

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#64748b" }}>Loading...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <Header
        lessons={lessons}
        org={org}
        setOrg={setOrg}
        showOrgProfile={showOrgProfile}
        setShowOrgProfile={setShowOrgProfile}
        user={user}
        onLogout={onLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      {activeTab === "log" && <LessonsLog org={org} lessons={lessons} refreshLessons={refreshLessons} setLessons={setLessons} />}
      {activeTab === "sow" && <SOWAnalysis org={org} lessons={lessons} />}
      {activeTab === "chat" && <ChatAnalyst org={org} lessons={lessons} />}
    </div>
  );
}

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
