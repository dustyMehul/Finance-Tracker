import React, { useState } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import Upload from "./pages/Upload"
import Reconcile from "./pages/Reconcile"
import Labels from "./pages/Labels"
import Reports from "./pages/Reports"
import Transfers from "./pages/Transfers"
import Statements from "./pages/Statements"
import SetupModal from "./pages/SetupModal"

const queryClient = new QueryClient()

// ── SVG Icons ──────────────────────────────────────────────────────────────
const UploadIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)
const ReconcileIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
)
const TransfersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
)
const StatementsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
)
const ReportsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)
const SettingsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>
)

// ── Sidebar nav item ───────────────────────────────────────────────────────
function NavItem({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        display: "flex", alignItems: "center", gap: 9,
        padding: "7px 10px", borderRadius: 7,
        textDecoration: "none", fontSize: 13, fontWeight: isActive ? 600 : 500,
        letterSpacing: "0.01em",
        color: isActive ? "#F0EFEB" : hov ? "#C8C5BE" : "#8A8780",
        background: isActive ? "#252523" : hov ? "#1C1C1A" : "transparent",
        transition: "background 0.1s, color 0.1s",
        marginBottom: 1,
      })}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  )
}

// ── App ────────────────────────────────────────────────────────────────────
function App() {
  const [setupOpen, setSetupOpen] = useState(false)
  const [setupHov, setSetupHov] = useState(false)

  return (
    <BrowserRouter>
      <div style={{ display: "flex", minHeight: "100vh" }}>

        {/* ── Sidebar ── */}
        <aside style={{
          width: 216, flexShrink: 0,
          background: "#111110",
          position: "fixed", top: 0, left: 0, bottom: 0,
          display: "flex", flexDirection: "column",
          borderRight: "1px solid #1D1D1B",
          zIndex: 100,
        }}>

          {/* Brand */}
          <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid #1D1D1B" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: "linear-gradient(135deg, #18A96B 0%, #0D7A4E 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, lineHeight: 1 }}>₹</span>
              </div>
              <div>
                <div style={{ color: "#F0EFEB", fontWeight: 700, fontSize: 13, letterSpacing: "-0.01em" }}>Finance Tracker</div>
                <div style={{ color: "#4A4846", fontSize: 10, letterSpacing: "0.05em", marginTop: 1 }}>Personal · Local</div>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
            <NavItem to="/"            end  icon={<UploadIcon />}     label="Import" />
            <NavItem to="/reconcile"        icon={<ReconcileIcon />}  label="Reconcile" />
            <NavItem to="/transfers"        icon={<TransfersIcon />}  label="Transfers" />
            <NavItem to="/statements"       icon={<StatementsIcon />} label="Statements" />
            <NavItem to="/reports"          icon={<ReportsIcon />}    label="Reports" />
          </nav>

          {/* Setup — pinned to bottom */}
          <div style={{ padding: "8px", borderTop: "1px solid #1D1D1B" }}>
            <button
              onClick={() => setSetupOpen(true)}
              onMouseEnter={() => setSetupHov(true)}
              onMouseLeave={() => setSetupHov(false)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 9,
                padding: "7px 10px", borderRadius: 7, border: "none",
                background: setupHov ? "#1C1C1A" : "transparent",
                color: setupHov ? "#C8C5BE" : "#8A8780",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                letterSpacing: "0.01em", transition: "background 0.1s, color 0.1s",
                fontFamily: "'Manrope', sans-serif",
              }}
            >
              <SettingsIcon />
              <span>Setup</span>
            </button>
          </div>
        </aside>

        {/* ── Main canvas ── */}
        <main style={{ marginLeft: 216, flex: 1, minHeight: "100vh", background: "#F7F6F3" }}>
          <Routes>
            <Route path="/"           element={<Upload onOpenAccounts={() => setSetupOpen(true)} />} />
            <Route path="/reconcile"  element={<Reconcile />} />
            <Route path="/transfers"  element={<Transfers />} />
            <Route path="/statements" element={<Statements />} />
            <Route path="/labels"     element={<Labels />} />
            <Route path="/reports"    element={<Reports />} />
          </Routes>
          <SetupModal open={setupOpen} onClose={() => setSetupOpen(false)} />
        </main>

      </div>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
