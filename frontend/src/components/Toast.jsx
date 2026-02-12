import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

const ToastContext = createContext(null);

let toastIdCounter = 0;

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const TOAST_COLORS = {
  success: { bg: "#0d2918", border: "#166534", text: "#34d399", bar: "#34d399" },
  error: { bg: "#2d0a0a", border: "#991b1b", text: "#f87171", bar: "#f87171" },
  info: { bg: "#0c1a2e", border: "#1e40af", text: "#60a5fa", bar: "#60a5fa" },
};

const ICONS = { success: "\u2713", error: "\u2717", info: "\u24D8" };

const DURATION = 5000;

function ToastItem({ toast, onDismiss }) {
  const [progress, setProgress] = useState(100);
  const [exiting, setExiting] = useState(false);
  const startRef = useRef(Date.now());
  const rafRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / DURATION) * 100);
      setProgress(remaining);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        handleDismiss();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const handleDismiss = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setTimeout(() => onDismiss(toast.id), 250);
  }, [exiting, onDismiss, toast.id]);

  const colors = TOAST_COLORS[toast.type] || TOAST_COLORS.info;

  return (
    <div
      onClick={handleDismiss}
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        padding: "12px 16px 10px",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        minWidth: 280,
        maxWidth: 400,
        animation: exiting ? "toastSlideOut 0.25s ease-in forwards" : "toastSlideIn 0.3s ease-out forwards",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 14, color: colors.text, fontWeight: 700, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>
          {ICONS[toast.type]}
        </span>
        <span style={{ fontSize: 13, color: colors.text, lineHeight: 1.4, wordBreak: "break-word" }}>
          {toast.message}
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: 3,
          width: `${progress}%`,
          background: colors.bar,
          opacity: 0.5,
          transition: "width 0.1s linear",
          borderRadius: "0 0 0 8px",
        }}
      />
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "info") => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          {toasts.map(t => (
            <div key={t.id} style={{ pointerEvents: "auto" }}>
              <ToastItem toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
