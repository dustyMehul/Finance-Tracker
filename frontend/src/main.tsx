import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import Upload from "./pages/Upload"
import Reconcile from "./pages/Reconcile"

const queryClient = new QueryClient()

const navStyle = (active: boolean): React.CSSProperties => ({
  fontSize: 13,
  fontWeight: active ? 500 : 400,
  color: active ? "#1a1a18" : "#888780",
  textDecoration: "none",
  padding: "4px 0",
  borderBottom: active ? "2px solid #1a1a18" : "2px solid transparent",
})

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div style={{ borderBottom: "0.5px solid #d3d1c7", padding: "12px 24px", display: "flex", gap: 24, alignItems: "center" }}>
          <span style={{ fontWeight: 500, fontSize: 14, marginRight: 8 }}>Finance Tracker</span>
          <NavLink to="/"         style={({ isActive }) => navStyle(isActive)}>Import</NavLink>
          <NavLink to="/reconcile" style={({ isActive }) => navStyle(isActive)}>Reconcile</NavLink>
        </div>
        <Routes>
          <Route path="/"          element={<Upload />} />
          <Route path="/reconcile" element={<Reconcile />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
