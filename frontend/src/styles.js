/* Global styles and constants shared across components */

export const WORK_TYPES = ["Pipeline Construction", "Compressor Station", "Meter Station", "HDD/Bore", "Hydrostatic Test", "Tie-In", "Coating/Cathodic Protection", "Civil/Earthwork", "Fabrication", "Commissioning", "Integrity/Repair", "Environmental", "Other"];
export const PHASES = ["Pre-Construction", "Mobilization", "Construction", "Mechanical Completion", "Commissioning", "Close-Out"];
export const DISCIPLINES = ["Quality", "Welding", "NDE", "Coatings", "Civil", "Mechanical", "Electrical", "Environmental", "Safety", "Project Controls", "Materials/Procurement", "Regulatory"];
export const SEVERITIES = ["Critical", "High", "Medium", "Low"];
export const ENVIRONMENTS = ["Arctic/Cold Weather", "Desert/Extreme Heat", "Coastal/Saltwater", "Wetland/Swamp", "Mountain/Steep Terrain", "Urban/Congested", "River/Water Crossing", "Normal"];
export const SOW_WORK_TYPES = [
  "Pipeline Mainline / Spread",
  "Compressor / Pump Station",
  "Meter / Regulator Station",
  "Facilities / Terminal",
  "HDD / Bore",
  "Hydrostatic Test",
  "Tie-In / Interconnect",
  "Fabrication",
  "Integrity / Repair",
  "Commissioning",
];

export const SEVERITY_COLORS = {
  Critical: { bg: "#2d0a0a", text: "#f87171", border: "#991b1b" },
  High: { bg: "#2d1a00", text: "#fb923c", border: "#9a3412" },
  Medium: { bg: "#1a1a2e", text: "#a78bfa", border: "#5b21b6" },
  Low: { bg: "#0d2918", text: "#34d399", border: "#166534" },
};

export const badge = (color) => ({
  display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10,
  fontWeight: 600, background: color.bg, color: color.text, border: `1px solid ${color.border}`,
  whiteSpace: "nowrap",
});

export const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #1e293b",
  background: "#111827", color: "#e2e8f0", fontSize: 13, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
};

export const selectStyle = { ...inputStyle, cursor: "pointer" };

export const btnPrimary = {
  padding: "10px 20px", borderRadius: 6, border: "none", background: "#2563eb",
  color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
};

export const btnSecondary = {
  padding: "10px 20px", borderRadius: 6, border: "1px solid #334155", background: "transparent",
  color: "#94a3b8", fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: "pointer",
};

export const labelStyle = {
  fontSize: 10, fontWeight: 600, letterSpacing: 1.2, color: "#64748b",
  textTransform: "uppercase", marginBottom: 5, display: "block",
};

export const globalCSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'IBM Plex Mono', 'SF Mono', monospace;
    background: #0a0e17;
    color: #e2e8f0;
    min-height: 100vh;
  }
  input:focus, textarea:focus, select:focus {
    border-color: #3b82f6 !important;
    outline: none;
  }
  button:hover { opacity: 0.9; }
  @keyframes pulse {
    0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
    40% { opacity: 1; transform: scale(1); }
  }
`;
