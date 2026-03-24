import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts"

const api = axios.create({ baseURL: "http://localhost:8000" })

const PERIODS = [
  { value: "current_month", label: "This month" },
  { value: "last_month",    label: "Last month" },
  { value: "last_30",       label: "Last 30 days" },
  { value: "last_90",       label: "Last 3 months" },
  { value: "last_180",      label: "Last 6 months" },
  { value: "all",           label: "All time" },
]

const TABS = ["Overview", "Categories", "Trends", "Merchants"]

function fmt(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN")
}

function useSummary(period: string)    { return useQuery({ queryKey: ["summary", period],    queryFn: () => api.get(`/reports/summary?period=${period}`).then(r => r.data) }) }
function useCategories(period: string) { return useQuery({ queryKey: ["categories", period], queryFn: () => api.get(`/reports/categories?period=${period}`).then(r => r.data) }) }
function useMonthly(period: string)    { return useQuery({ queryKey: ["monthly", period],    queryFn: () => api.get(`/reports/monthly?period=${period}`).then(r => r.data) }) }
function useMerchants(period: string)  { return useQuery({ queryKey: ["merchants", period],  queryFn: () => api.get(`/reports/merchants?period=${period}&limit=15`).then(r => r.data) }) }

export default function Reports() {
  const [period, setPeriod] = useState("last_month")
  const [tab, setTab]       = useState("Overview")

  const summary    = useSummary(period)
  const categories = useCategories(period)
  const monthly    = useMonthly(period)
  const merchants  = useMerchants(period)

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "2rem 2rem" }}>

      {/* header + period selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Reports</h1>
        <div style={{ marginLeft: "auto" }}>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            style={{
              padding: "7px 12px", borderRadius: 8, fontSize: 14,
              border: "0.5px solid #d3d1c7", background: "transparent",
              color: "inherit", cursor: "pointer",
            }}
          >
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "0.5px solid #d3d1c7" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 18px", fontSize: 14, cursor: "pointer",
            background: "transparent", border: "none",
            borderBottom: tab === t ? "2px solid #1a1a18" : "2px solid transparent",
            color: tab === t ? "#1a1a18" : "#888780",
            fontWeight: tab === t ? 500 : 400,
            marginBottom: -1,
          }}>{t}</button>
        ))}
      </div>

      {/* summary cards — always visible */}
      {summary.data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
          <SummaryCard label="Total spend"   value={fmt(summary.data.total_spend)}  sub={`${summary.data.debit_count} transactions`}  color="#E24B4A" />
          <SummaryCard label="Total income"  value={fmt(summary.data.total_income)} sub={`${summary.data.credit_count} transactions`} color="#1D9E75" />
          <SummaryCard label="Net flow"      value={fmt(Math.abs(summary.data.net))}
            sub={summary.data.net >= 0 ? "surplus" : "deficit"}
            color={summary.data.net >= 0 ? "#1D9E75" : "#E24B4A"} />
          <SummaryCard label="Transactions"  value={summary.data.count.toString()} sub={`${summary.data.period.from} → ${summary.data.period.to}`} color="#378ADD" />
        </div>
      )}

      {/* tab content */}
      {tab === "Overview" && (
        <OverviewTab categories={categories.data} monthly={monthly.data} merchants={merchants.data} />
      )}
      {tab === "Categories" && (
        <CategoriesTab data={categories.data} />
      )}
      {tab === "Trends" && (
        <TrendsTab data={monthly.data} />
      )}
      {tab === "Merchants" && (
        <MerchantsTab data={merchants.data} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------
function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      background: "var(--color-background-secondary, #f5f4f0)",
      borderRadius: 12, padding: "16px 20px",
      border: "0.5px solid #d3d1c7",
    }}>
      <p style={{ margin: "0 0 6px", fontSize: 12, color: "#888780" }}>{label}</p>
      <p style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 500, color }}>{value}</p>
      <p style={{ margin: 0, fontSize: 12, color: "#b4b2a9" }}>{sub}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------
function OverviewTab({ categories, monthly, merchants }: any) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <ChartCard title="Spend by category">
          {categories?.categories?.length > 0
            ? <DonutChart data={categories.categories} />
            : <Empty />}
        </ChartCard>
        <ChartCard title="Monthly trend">
          {monthly?.months?.length > 0
            ? <MonthlyBar data={monthly.months} />
            : <Empty />}
        </ChartCard>
      </div>
      <ChartCard title="Top merchants">
        {merchants?.merchants?.length > 0
          ? <MerchantBar data={merchants.merchants.slice(0, 10)} />
          : <Empty />}
      </ChartCard>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Categories tab
// ---------------------------------------------------------------------------
function CategoriesTab({ data }: any) {
  if (!data) return <Empty />
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <ChartCard title="Spend by category">
        <DonutChart data={data.categories} />
      </ChartCard>
      <div style={{ background: "var(--color-background-secondary, #f5f4f0)", borderRadius: 12, border: "0.5px solid #d3d1c7", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "0.5px solid #d3d1c7" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>Breakdown</p>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid #d3d1c7" }}>
              {["Category", "Amount", "%", "Txns"].map(h => (
                <th key={h} style={{ padding: "8px 16px", textAlign: "left", fontWeight: 500, color: "#888780" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.categories.map((c: any) => (
              <tr key={c.label_id} style={{ borderBottom: "0.5px solid #f1efe8" }}>
                <td style={{ padding: "10px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, display: "inline-block", flexShrink: 0 }} />
                    {c.label_name}
                  </div>
                </td>
                <td style={{ padding: "10px 16px", fontWeight: 500 }}>₹{c.amount.toLocaleString("en-IN")}</td>
                <td style={{ padding: "10px 16px", color: "#888780" }}>{c.percentage}%</td>
                <td style={{ padding: "10px 16px", color: "#888780" }}>{c.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trends tab
// ---------------------------------------------------------------------------
function TrendsTab({ data }: any) {
  if (!data) return <Empty />
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <ChartCard title="Monthly spend vs income">
        <MonthlyBar data={data.months} height={320} />
      </ChartCard>
      <ChartCard title="Month summary">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid #d3d1c7" }}>
              {["Month", "Spend", "Income", "Net", "Transactions"].map(h => (
                <th key={h} style={{ padding: "8px 16px", textAlign: "left", fontWeight: 500, color: "#888780" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...data.months].reverse().map((m: any) => {
              const net = m.income - m.spend
              return (
                <tr key={m.month} style={{ borderBottom: "0.5px solid #f1efe8" }}>
                  <td style={{ padding: "10px 16px", fontWeight: 500 }}>{m.month}</td>
                  <td style={{ padding: "10px 16px", color: "#E24B4A" }}>₹{m.spend.toLocaleString("en-IN")}</td>
                  <td style={{ padding: "10px 16px", color: "#1D9E75" }}>₹{m.income.toLocaleString("en-IN")}</td>
                  <td style={{ padding: "10px 16px", color: net >= 0 ? "#1D9E75" : "#E24B4A", fontWeight: 500 }}>
                    {net >= 0 ? "+" : "−"}₹{Math.abs(net).toLocaleString("en-IN")}
                  </td>
                  <td style={{ padding: "10px 16px", color: "#888780" }}>{m.count}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </ChartCard>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Merchants tab
// ---------------------------------------------------------------------------
function MerchantsTab({ data }: any) {
  if (!data) return <Empty />
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <ChartCard title="Top merchants by spend">
        <MerchantBar data={data.merchants.slice(0, 10)} height={400} />
      </ChartCard>
      <div style={{ background: "var(--color-background-secondary, #f5f4f0)", borderRadius: 12, border: "0.5px solid #d3d1c7", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "0.5px solid #d3d1c7" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>All merchants</p>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid #d3d1c7" }}>
              {["#", "Merchant", "Amount", "Txns"].map(h => (
                <th key={h} style={{ padding: "8px 16px", textAlign: "left", fontWeight: 500, color: "#888780" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.merchants.map((m: any, i: number) => (
              <tr key={m.name} style={{ borderBottom: "0.5px solid #f1efe8" }}>
                <td style={{ padding: "10px 16px", color: "#b4b2a9", fontWeight: 500 }}>{i + 1}</td>
                <td style={{ padding: "10px 16px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</td>
                <td style={{ padding: "10px 16px", fontWeight: 500 }}>₹{m.amount.toLocaleString("en-IN")}</td>
                <td style={{ padding: "10px 16px", color: "#888780" }}>{m.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart components
// ---------------------------------------------------------------------------
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--color-background-secondary, #f5f4f0)", borderRadius: 12, border: "0.5px solid #d3d1c7", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "0.5px solid #d3d1c7" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{title}</p>
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  )
}

function Empty() {
  return <p style={{ color: "#b4b2a9", fontSize: 13, textAlign: "center", padding: "2rem 0" }}>No data for this period</p>
}

function DonutChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="amount" nameKey="label_name"
          cx="50%" cy="50%" innerRadius={70} outerRadius={110}
          paddingAngle={2}>
          {data.map((entry: any, i: number) => (
            <Cell key={i} fill={entry.color || "#d3d1c7"} />
          ))}
        </Pie>
        <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString("en-IN")}`} />
        <Legend formatter={(v) => <span style={{ fontSize: 12 }}>{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function MonthlyBar({ data, height = 260 }: { data: any[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1efe8" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#888780" }} />
        <YAxis tick={{ fontSize: 12, fill: "#888780" }}
          tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
        <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString("en-IN")}`} />
        <Legend formatter={(v) => <span style={{ fontSize: 12 }}>{v}</span>} />
        <Bar dataKey="spend"  name="Spend"  fill="#E24B4A" radius={[4, 4, 0, 0]} />
        <Bar dataKey="income" name="Income" fill="#1D9E75" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function MerchantBar({ data, height = 280 }: { data: any[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1efe8" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#888780" }}
          tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
        <YAxis type="category" dataKey="name" width={140}
          tick={{ fontSize: 11, fill: "#888780" }} />
        <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString("en-IN")}`} />
        <Bar dataKey="amount" name="Amount" fill="#378ADD" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
