import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"

const api = axios.create({ baseURL: "http://localhost:8000" })

const PERIODS = [
  { value: "current_month", label: "This month" },
  { value: "last_month",    label: "Last month" },
  { value: "last_90",       label: "Last 3 months" },
  { value: "last_180",      label: "Last 6 months" },
  { value: "current_fy",    label: "Current FY" },
  { value: "all",           label: "All time" },
]

const TABS = ["Overview", "Expenses", "Credit card", "Investments", "Money lent"]

function fmt(n: number) {
  return "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN")
}

export default function Reports() {
  const [period, setPeriod] = useState("last_month")
  const [tab, setTab] = useState("Overview")

  const { data: summary, isLoading } = useQuery({
    queryKey: ["summary", period],
    queryFn: () => api.get(`/reports/summary?period=${period}`).then(r => r.data),
  })

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 2rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>Reports</h1>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          style={{
            padding: "7px 12px", borderRadius: 8, fontSize: 13,
            border: "0.5px solid #d3d1c7", background: "transparent",
            color: "inherit", cursor: "pointer",
          }}
        >
          {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      <p style={{ fontSize: 13, color: "#888780", margin: "0 0 20px" }}>
        {isLoading ? "—" : summary?.period_label ?? ""}
      </p>

      <div style={{ display: "flex", borderBottom: "0.5px solid #d3d1c7", marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "10px 18px", fontSize: 13, cursor: "pointer",
            background: "transparent", border: "none",
            borderBottom: tab === t ? "2px solid #1a1a18" : "2px solid transparent",
            color: tab === t ? "#1a1a18" : "#888780",
            fontWeight: tab === t ? 500 : 400,
            marginBottom: -1, whiteSpace: "nowrap",
          }}>{t}</button>
        ))}
      </div>

      {tab === "Overview" && <OverviewTab summary={summary} isLoading={isLoading} period={period} />}
      {tab !== "Overview" && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#b4b2a9", fontSize: 13 }}>
          Coming soon
        </div>
      )}
    </div>
  )
}

function OverviewTab({ summary, isLoading, period }: { summary: any; isLoading: boolean; period: string }) {
  const [trendView, setTrendView] = useState<"monthly" | "annual">("monthly")

  const { data: categories } = useQuery({
    queryKey: ["categories", period],
    queryFn: () => api.get(`/reports/categories?period=${period}`).then(r => r.data),
  })

  const { data: trend } = useQuery({
    queryKey: ["trend", trendView],
    queryFn: () => api.get(`/reports/trend?view=${trendView}`).then(r => r.data),
  })

  if (isLoading) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: "#b4b2a9", fontSize: 13 }}>Loading…</div>
  )
  if (!summary) return null

  const liquidity = summary.liquidity
  const liquidityPositive = liquidity >= 0

  return (
    <div>
      {/* 4 cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 28 }}>
        <SummaryCard
          label="Cash inflow"
          sublabel="Incomes and investment withdrawals"
          value={fmt(summary.cash_inflow)}
          valueColor="#1D9E75"
          count={`${summary.cash_inflow_count} transaction${summary.cash_inflow_count !== 1 ? "s" : ""}`}
        />
        <SummaryCard
          label="Expenses"
          sublabel="All money spent"
          value={fmt(summary.total_expenses)}
          valueColor="#E24B4A"
          count={`${summary.expense_count} transaction${summary.expense_count !== 1 ? "s" : ""}`}
        />
        <SummaryCard
          label="Investments"
          sublabel="Money put into investments"
          value={fmt(summary.total_invested)}
          valueColor="#185FA5"
          count={`${summary.invested_count} transaction${summary.invested_count !== 1 ? "s" : ""}`}
        />
        <SummaryCard
          label="Liquidity"
          sublabel="Inflow − Expenses − Investments"
          value={(liquidityPositive ? "" : "−") + fmt(liquidity)}
          valueColor={liquidityPositive ? "#1D9E75" : "#E24B4A"}
          count={liquidityPositive ? "cash available" : "shortfall"}
        />
      </div>

      {/* unknown warning */}
      {summary.unknown_count > 0 && (
        <div style={{
          padding: "10px 16px", borderRadius: 8, marginBottom: 24,
          background: "#FAEEDA", border: "0.5px solid #BA7517",
          fontSize: 13, color: "#633806",
        }}>
          ⚠ {summary.unknown_count} transaction{summary.unknown_count !== 1 ? "s" : ""} have unknown nature — excluded from totals.
          Fix in <a href="/reconcile" style={{ color: "#633806", fontWeight: 500 }}>Reconcile</a>.
        </div>
      )}

      {/* bottom section: categories + trend */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* spend by category */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 500, color: "#888780", letterSpacing: "0.05em", margin: "0 0 14px" }}>
            SPEND BY CATEGORY
          </p>
          {categories?.categories?.slice(0, 6).map((c: any) => {
            const max = categories.categories[0]?.amount || 1
            const pct = (c.amount / max) * 100
            const totalExpenses = summary?.total_expenses || 1
            const pctOfTotal = Math.round((c.amount / totalExpenses) * 100)
            return (
              <div key={c.label_id ?? c.label_name} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: "#444441", width: 100, flexShrink: 0 }}>{c.label_name}</span>
                <div style={{ flex: 1, height: 6, background: "#f1efe8", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: c.color || "#d3d1c7", borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, width: 64, textAlign: "right", flexShrink: 0, color: "#1a1a18" }}>
                  {fmt(c.amount)}
                </span>
                <span style={{ fontSize: 11, color: "#888780", width: 32, textAlign: "right", flexShrink: 0 }}>
                  {pctOfTotal}%
                </span>
              </div>
            )
          })}
          {(!categories?.categories || categories.categories.length === 0) && (
            <p style={{ fontSize: 13, color: "#b4b2a9" }}>No expense data for this period.</p>
          )}
        </div>

        {/* monthly trend */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: "#888780", letterSpacing: "0.05em", margin: 0 }}>
              TREND OF EXPENSES
            </p>
            <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "0.5px solid #d3d1c7" }}>
              {(["monthly", "annual"] as const).map(v => (
                <button key={v} onClick={() => setTrendView(v)} style={{
                  padding: "4px 12px", fontSize: 12, border: "none", cursor: "pointer",
                  background: trendView === v ? "#1a1a18" : "transparent",
                  color: trendView === v ? "#fff" : "#888780",
                  fontWeight: trendView === v ? 500 : 400,
                }}>
                  {v === "monthly" ? "Monthly" : "Annual"}
                </button>
              ))}
            </div>
          </div>

          <TrendChart items={trend?.items ?? []} />
        </div>

      </div>
    </div>
  )
}

function TrendChart({ items }: { items: any[] }) {
  if (!items.length) return (
    <p style={{ fontSize: 13, color: "#b4b2a9" }}>No trend data available.</p>
  )

  const CHART_H   = 200
  const Y_STEPS   = 4
  const BAR_GAP   = 8
  const Y_AXIS_W  = 52

  const maxVal = Math.max(...items.map((i: any) => Math.max(i.spend, i.income)), 1)

  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)))
  const niceMax   = Math.ceil(maxVal / magnitude) * magnitude
  const stepVal   = niceMax / Y_STEPS

  const gridLines = Array.from({ length: Y_STEPS + 1 }, (_, i) => i * stepVal)

  function fmtY(v: number) {
    if (v >= 1_00_000) return "₹" + (v / 1_00_000).toFixed(1) + "L"
    if (v >= 1_000)    return "₹" + (v / 1_000).toFixed(0) + "k"
    return "₹" + v
  }

  return (
    <div>
      {/* legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 10, justifyContent: "flex-end" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#888780" }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "#1D9E75" }} />
          Income
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#888780" }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "#E24B4A" }} />
          Expenses
        </div>
      </div>

      <div style={{ display: "flex", gap: 0 }}>
        {/* y-axis labels */}
        <div style={{ width: Y_AXIS_W, flexShrink: 0, position: "relative", height: CHART_H + 24 }}>
          {gridLines.map((v, i) => {
            const yPct = 1 - (v / niceMax)
            return (
              <span key={i} style={{
                position: "absolute",
                top: yPct * CHART_H - 8,
                right: 8,
                fontSize: 10,
                color: "#b4b2a9",
                whiteSpace: "nowrap",
              }}>{fmtY(v)}</span>
            )
          })}
        </div>

        {/* chart area */}
        <div style={{ flex: 1, position: "relative" }}>
          {/* horizontal grid lines */}
          <div style={{ position: "relative", height: CHART_H }}>
            {gridLines.map((v, i) => {
              const yPct = 1 - (v / niceMax)
              return (
                <div key={i} style={{
                  position: "absolute",
                  top: yPct * CHART_H,
                  left: 0, right: 0,
                  height: "0.5px",
                  background: i === 0 ? "#d3d1c7" : "#f1efe8",
                }} />
              )
            })}

            {/* bars */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              display: "flex", alignItems: "flex-end", gap: BAR_GAP, height: CHART_H,
            }}>
              {items.map((item: any) => {
                const hSpend  = item.spend  > 0 ? Math.max((item.spend  / niceMax) * CHART_H, 3) : 0
                const hIncome = item.income > 0 ? Math.max((item.income / niceMax) * CHART_H, 3) : 0
                return (
                  <div key={item.key} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", gap: 2 }}>
                    <div
                      title={`${item.label} income: ${fmt(item.income)}`}
                      style={{
                        flex: 1, height: hIncome,
                        background: "#1D9E75",
                        borderRadius: "3px 3px 0 0",
                        opacity: hIncome === 0 ? 0 : 1,
                      }}
                    />
                    <div
                      title={`${item.label} expenses: ${fmt(item.spend)}`}
                      style={{
                        flex: 1, height: hSpend,
                        background: "#E24B4A",
                        borderRadius: "3px 3px 0 0",
                        opacity: hSpend === 0 ? 0 : 1,
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* x-axis baseline */}
          <div style={{ height: "0.5px", background: "#d3d1c7", marginBottom: 6 }} />

          {/* x-axis labels */}
          <div style={{ display: "flex", gap: BAR_GAP }}>
            {items.map((item: any) => (
              <div key={item.key} style={{ flex: 1, textAlign: "center", fontSize: 11, color: "#888780" }}>
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, sublabel, value, valueColor, count }: {
  label: string; sublabel: string; value: string; valueColor: string; count: string
}) {
  return (
    <div style={{
      background: "var(--color-background-secondary, #f5f4f0)",
      borderRadius: 12, padding: "18px 20px",
    }}>
      <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 500, color: "#888780", letterSpacing: "0.02em" }}>
        {label.toUpperCase()}
      </p>
      <p style={{ margin: "0 0 10px", fontSize: 10, color: "#b4b2a9", lineHeight: 1.4 }}>
        {sublabel}
      </p>
      <p style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 500, color: valueColor }}>
        {value}
      </p>
      <p style={{ margin: 0, fontSize: 11, color: "#888780" }}>{count}</p>
    </div>
  )
}
