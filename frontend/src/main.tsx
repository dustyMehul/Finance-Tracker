import React, { useState } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import Upload from "./pages/Upload"
import Reconcile from "./pages/Reconcile"
import Labels from "./pages/Labels"
import Reports from "./pages/Reports"
import Transfers from "./pages/Transfers"
import SetupModal from "./pages/SetupModal"

const queryClient = new QueryClient()

const navStyle = (active: boolean): React.CSSProperties => ({
  fontSize: 15,
  fontWeight: active ? 500 : 400,
  color: active ? "#1a1a18" : "#888780",
  textDecoration: "none",
  padding: "4px 0",
  borderBottom: active ? "2px solid #1a1a18" : "2px solid transparent",
})

function App() {
  const [setupOpen, setSetupOpen] = useState(false)
  return (
    <BrowserRouter>
      <div style={{ borderBottom: "0.5px solid #d3d1c7", padding: "14px 32px", display: "flex", gap: 28, alignItems: "center" }}>
        <span style={{ fontWeight: 600, fontSize: 16, marginRight: 8 }}>Finance Tracker</span>
        <NavLink to="/"           style={({ isActive }) => navStyle(isActive)}>Import</NavLink>
        <NavLink to="/reconcile"  style={({ isActive }) => navStyle(isActive)}>Reconcile</NavLink>
        <NavLink to="/transfers"  style={({ isActive }) => navStyle(isActive)}>Transfers</NavLink>
        <NavLink to="/reports"    style={({ isActive }) => navStyle(isActive)}>Reports</NavLink>
        <div style={{ marginLeft: "auto" }}>
          <button
            onClick={() => setSetupOpen(true)}
            style={{
              fontSize: 14, fontWeight: 500, cursor: "pointer",
              padding: "6px 14px", borderRadius: 6,
              border: "1px solid #d1d5db", background: "#f9fafb", color: "#374151",
            }}
          >
            Setup
          </button>
        </div>
      </div>
      <Routes>
        <Route path="/"           element={<Upload onOpenAccounts={() => setSetupOpen(true)} />} />
        <Route path="/reconcile"  element={<Reconcile />} />
        <Route path="/transfers"  element={<Transfers />} />
        <Route path="/labels"     element={<Labels />} />
        <Route path="/reports"    element={<Reports />} />
      </Routes>
      <SetupModal open={setupOpen} onClose={() => setSetupOpen(false)} />
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
