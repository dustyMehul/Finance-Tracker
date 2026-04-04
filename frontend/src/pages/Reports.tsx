import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer,
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
} from "recharts"
import TransactionDrawer from "../components/TransactionDrawer"

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

// ── Section label ──────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 600, color: "#A8A5A0", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 14px" }}>
      {children}
    </p>
  )
}

export default function Reports() {
  const [period, setPeriod] = useState("last_month")
  const [tab, setTab] = useState("Overview")

  const { data: summary, isLoading } = useQuery({
    queryKey: ["summary", period],
    queryFn: () => api.get(`/reports/summary?period=${period}`).then(r => r.data),
  })

  return (
    <div style={{ padding: "36px 40px", maxWidth: 1160 }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>Reports</h1>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          style={{
            padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: "1px solid #E6E4DC", background: "#FFFFFF",
            color: "#1A1916", cursor: "pointer",
            fontFamily: "'Manrope', sans-serif",
          }}
        >
          {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      <p style={{ fontSize: 12, color: "#A8A5A0", margin: "0 0 24px", fontFamily: "'JetBrains Mono', monospace" }}>
        {isLoading ? "—" : summary?.period_label ?? ""}
      </p>

      {/* Pill tab bar */}
      <div style={{
        display: "flex", gap: 2,
        background: "#EFEDE8", borderRadius: 11, padding: 3,
        marginBottom: 32, width: "fit-content",
      }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "7px 16px", borderRadius: 9, border: "none",
            fontSize: 12, fontWeight: tab === t ? 700 : 500,
            cursor: "pointer",
            background: tab === t ? "#FFFFFF" : "transparent",
            color: tab === t ? "#1A1916" : "#8A8780",
            boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.1), 0 0 0 0.5px rgba(0,0,0,0.04)" : "none",
            transition: "all 0.12s",
            whiteSpace: "nowrap",
            letterSpacing: "0.01em",
            fontFamily: "'Manrope', sans-serif",
          }}>{t}</button>
        ))}
      </div>

      {tab === "Overview"    && <OverviewTab summary={summary} isLoading={isLoading} period={period} />}
      {tab === "Expenses"    && <ExpensesTab period={period} />}
      {tab === "Credit card" && <ExpensesTab period={period} accountType="credit" />}
      {tab === "Investments" && <InvestmentsTab summary={summary} />}
      {tab === "Money lent"  && <MoneyLentTab summary={summary} />}
    </div>
  )
}

// ── Overview Tab ─────────────────────────────────────────────────────────────
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
    <div style={{ textAlign: "center", padding: "60px 0", color: "#A8A5A0", fontSize: 13 }}>Loading…</div>
  )
  if (!summary) return null

  const liquidity = summary.liquidity
  const liquidityPositive = liquidity >= 0

  return (
    <div>
      {/* 4 summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 32 }}>
        <SummaryCard
          label="Cash inflow"
          sublabel="Income and investment returns"
          value={fmt(summary.cash_inflow)}
          valueColor="#18A96B"
          count={`${summary.cash_inflow_count} transaction${summary.cash_inflow_count !== 1 ? "s" : ""}`}
        />
        <SummaryCard
          label="Expenses"
          sublabel="All money spent"
          value={fmt(summary.total_expenses)}
          valueColor="#D94B45"
          count={`${summary.expense_count} transaction${summary.expense_count !== 1 ? "s" : ""}`}
        />
        <SummaryCard
          label="Investments"
          sublabel="Money put into investments"
          value={fmt(summary.total_invested)}
          valueColor="#2A6DD9"
          count={`${summary.invested_count} transaction${summary.invested_count !== 1 ? "s" : ""}`}
        />
        <SummaryCard
          label="Liquidity"
          sublabel="Inflow − Expenses − Investments"
          value={(liquidityPositive ? "" : "−") + fmt(liquidity)}
          valueColor={liquidityPositive ? "#18A96B" : "#D94B45"}
          count={liquidityPositive ? "available" : "shortfall"}
        />
      </div>

      {/* Unknown warning */}
      {summary.unknown_count > 0 && (
        <div style={{
          padding: "11px 16px", borderRadius: 9, marginBottom: 28,
          background: "#FEFCE8", border: "1px solid #FDE68A",
          fontSize: 12, color: "#92400E", fontWeight: 500,
        }}>
          ⚠ {summary.unknown_count} transaction{summary.unknown_count !== 1 ? "s" : ""} have unknown nature — excluded from totals.
          Fix in <a href="/reconcile" style={{ color: "#92400E", fontWeight: 700, textDecoration: "underline" }}>Reconcile</a>.
        </div>
      )}

      {/* Two-column bottom section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

        {/* Spend by category */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E6E4DC", borderRadius: 12, padding: "22px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <SectionLabel>Spend by category</SectionLabel>
          {categories?.categories?.slice(0, 6).map((c: any) => {
            const max = categories.categories[0]?.amount || 1
            const pct = (c.amount / max) * 100
            const totalExpenses = summary?.total_expenses || 1
            const pctOfTotal = Math.round((c.amount / totalExpenses) * 100)
            return (
              <div key={c.label_id ?? c.label_name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: "#6B6862", width: 110, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.label_name}
                </span>
                <div style={{ flex: 1, height: 5, background: "#F0EEE8", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: c.color || "#D0CEC8", borderRadius: 99, transition: "width 0.4s" }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, width: 72, textAlign: "right", flexShrink: 0, color: "#1A1916", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.02em" }}>
                  {fmt(c.amount)}
                </span>
                <span style={{ fontSize: 10, color: "#A8A5A0", width: 30, textAlign: "right", flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>
                  {pctOfTotal}%
                </span>
              </div>
            )
          })}
          {(!categories?.categories || categories.categories.length === 0) && (
            <p style={{ fontSize: 13, color: "#A8A5A0" }}>No expense data for this period.</p>
          )}
        </div>

        {/* Trend chart */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E6E4DC", borderRadius: 12, padding: "22px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <SectionLabel>Income vs Expenses</SectionLabel>
            <TogglePill
              options={["monthly", "annual"]}
              labels={["Monthly", "Annual"]}
              value={trendView}
              onChange={v => setTrendView(v as any)}
            />
          </div>
          <TrendChart items={trend?.items ?? []} />
        </div>

      </div>
    </div>
  )
}

// ── Expenses Tab ─────────────────────────────────────────────────────────────
const LINE_COLORS: Record<string, string> = {
  entertainment: "#8B5CF6",
  food_dining:   "#F97316",
  fuel:          "#EAB308",
  groceries:     "#22C55E",
  shopping:      "#EC4899",
  subscription:  "#06B6D4",
  transport:     "#64748B",
  travel_hotels: "#F43F5E",
}

const LINE_LABELS: Record<string, string> = {
  entertainment: "Entertainment",
  food_dining:   "Food & dining",
  fuel:          "Fuel",
  groceries:     "Groceries",
  shopping:      "Shopping",
  subscription:  "Subscription",
  transport:     "Transport",
  travel_hotels: "Travel & hotels",
}

function ExpensesTooltip({ active, payload, label, activeKey }: any) {
  if (!active || !payload?.length) return null
  const item = payload.find((p: any) => p.dataKey === activeKey)
  if (!item) return null
  const displayName = item.dataKey === "spend"
    ? "Total expenses"
    : (LINE_LABELS[item.dataKey] ?? item.dataKey)
  return (
    <div style={{
      background: "#FFFFFF", border: "1px solid #E6E4DC",
      borderRadius: 9, padding: "9px 13px", fontSize: 12,
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    }}>
      <div style={{ color: "#A8A5A0", marginBottom: 5, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{label}</div>
      <div style={{ color: item.stroke ?? item.fill, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
        {displayName}: {fmt(Number(item.value ?? 0))}
      </div>
    </div>
  )
}

function ExpensesTab({ period, accountType }: { period: string; accountType?: string }) {
  const [trendView, setTrendView] = useState<"monthly" | "annual">("monthly")
  const [activeKey, setActiveKey] = useState<string>("spend")
  const [drawer, setDrawer] = useState<{ labelId: string; name: string; color: string } | null>(null)

  const atParam = accountType ? `&account_type=${accountType}` : ""

  const { data: categories } = useQuery({
    queryKey: ["categories", period, accountType],
    queryFn: () => api.get(`/reports/categories?period=${period}${atParam}`).then(r => r.data),
  })

  const { data: expTrend } = useQuery({
    queryKey: ["expense-trend", trendView, accountType],
    queryFn: () => api.get(`/reports/expense-trend?view=${trendView}${atParam}`).then(r => r.data),
  })

  const allCats: any[] = categories?.categories ?? []
  const top9 = allCats.slice(0, 9)
  const rest = allCats.slice(9)
  const restTotal = rest.reduce((s: number, c: any) => s + c.amount, 0)
  const donutData = [
    ...top9.map((c: any) => ({ name: c.label_name, value: c.amount, fill: c.color || "#D0CEC8" })),
    ...(restTotal > 0 ? [{ name: "Other", value: restTotal, fill: "#D0CEC8" }] : []),
  ]
  const totalExp = allCats.reduce((s: number, c: any) => s + c.amount, 0)

  const trackedSlugs: string[] = expTrend?.tracked ?? []
  const activeLines = trackedSlugs.filter((slug: string) =>
    (expTrend?.items ?? []).some((item: any) => (item.categories?.[slug] ?? 0) > 0)
  )

  const trendItems = (expTrend?.items ?? []).map((item: any) => ({
    label: item.label,
    spend: item.spend,
    ...Object.fromEntries(trackedSlugs.map((s: string) => [s, item.categories?.[s] ?? 0])),
  }))

  function fmtAxis(v: number) {
    if (v >= 1_00_000) return "₹" + (v / 1_00_000).toFixed(1) + "L"
    if (v >= 1_000)    return "₹" + Math.round(v / 1_000) + "k"
    return "₹" + v
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 28 }}>

      {/* Left: donut + legend */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E6E4DC", borderRadius: 12, padding: "22px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <SectionLabel>Spend by category</SectionLabel>

        {donutData.length === 0 ? (
          <p style={{ fontSize: 13, color: "#A8A5A0" }}>No expense data for this period.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ position: "relative", width: 210, height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData} cx="50%" cy="50%"
                    innerRadius={65} outerRadius={95}
                    dataKey="value" strokeWidth={2} stroke="#FFFFFF"
                    style={{ cursor: "pointer" }}
                    onClick={(slice: any) => {
                      const cat = allCats.find((c: any) => c.label_name === slice.name)
                      if (cat?.label_id) setDrawer({ labelId: cat.label_id, name: cat.label_name, color: cat.color || "#D0CEC8" })
                    }}
                  >
                    {donutData.map((d: any, i: number) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <RTooltip
                    formatter={(value, name) => [fmt(Number(value ?? 0)), String(name)]}
                    contentStyle={{ fontSize: 12, borderRadius: 9, border: "1px solid #E6E4DC", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none",
              }}>
                <div style={{ fontSize: 10, color: "#A8A5A0", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1916", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.02em" }}>
                  {fmt(totalExp)}
                </div>
              </div>
            </div>

            <div style={{ width: "100%", marginTop: 10 }}>
              {donutData.map((d: any) => {
                const cat = allCats.find((c: any) => c.label_name === d.name)
                return (
                  <div
                    key={d.name}
                    onClick={() => { if (cat?.label_id) setDrawer({ labelId: cat.label_id, name: d.name, color: d.fill }) }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, marginBottom: 5,
                      cursor: cat?.label_id ? "pointer" : "default",
                      borderRadius: 7, padding: "4px 6px",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => { if (cat?.label_id) (e.currentTarget as HTMLElement).style.background = "#F5F4F2" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
                  >
                    <div style={{ width: 9, height: 9, borderRadius: 2, background: d.fill, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#6B6862", flex: 1 }}>{d.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#1A1916", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(d.value)}</span>
                    <span style={{ fontSize: 10, color: "#A8A5A0", width: 34, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
                      {Math.round((d.value / totalExp) * 100)}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {drawer && (
        <TransactionDrawer
          open={true} onClose={() => setDrawer(null)}
          title={drawer.name} color={drawer.color} labelId={drawer.labelId}
        />
      )}

      {/* Right: trend chart */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E6E4DC", borderRadius: 12, padding: "22px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <SectionLabel>Trend of expenses</SectionLabel>
          <TogglePill
            options={["monthly", "annual"]}
            labels={["Monthly", "Annual"]}
            value={trendView}
            onChange={v => setTrendView(v as any)}
          />
        </div>

        {trendItems.length === 0 ? (
          <p style={{ fontSize: 13, color: "#A8A5A0" }}>No trend data available.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={trendItems} margin={{ top: 4, right: 52, left: 0, bottom: 0 }} onMouseLeave={() => setActiveKey("spend")}>
                <CartesianGrid vertical={false} stroke="#F0EEE8" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#A8A5A0", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="bar" tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: "#C8C5BE", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} width={48} />
                <YAxis yAxisId="line" orientation="right" tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: "#C8C5BE", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} width={48} />
                <RTooltip content={<ExpensesTooltip activeKey={activeKey} />} />
                <Bar yAxisId="bar" dataKey="spend" fill="#D94B45" opacity={0.2} radius={[4, 4, 0, 0]} name="spend" onMouseOver={() => setActiveKey("spend")} />
                {activeLines.map((slug: string) => (
                  <Line
                    key={slug} yAxisId="line" type="linear" dataKey={slug}
                    stroke={LINE_COLORS[slug] ?? "#A8A5A0"} strokeWidth={2}
                    dot={false} name={slug}
                    activeDot={{ onMouseOver: () => setActiveKey(slug), r: 4 }}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>

            {activeLines.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 12 }}>
                {activeLines.map((slug: string) => (
                  <div key={slug} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#8A8780" }}>
                    <div style={{ width: 16, height: 2, background: LINE_COLORS[slug] ?? "#A8A5A0", borderRadius: 1 }} />
                    {LINE_LABELS[slug] ?? slug}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Money Lent Tab ────────────────────────────────────────────────────────────
function MoneyLentTab({ summary }: { summary: any }) {
  const [view, setView] = useState<"monthly" | "annual">("monthly")
  const [hoveredSeries, setHoveredSeries] = useState<"lent_out" | "returned" | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ["lending-trend", view],
    queryFn: () => api.get(`/reports/lending-trend?view=${view}`).then(r => r.data),
  })

  const items: any[] = data?.items ?? []

  const chartData = items.map((item: any) => ({
    label: item.label, lent_out: item.lent_out, returned: item.returned,
  }))

  const maxVal = Math.max(...items.map((i: any) => i.lent_out), ...items.map((i: any) => i.returned), 1)
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)))
  const niceMax   = Math.ceil(maxVal / magnitude) * magnitude

  const netData = chartData.map((d: any) => ({ label: d.label, net: d.returned - d.lent_out }))
  const netMax        = Math.max(...netData.map((d: any) => Math.abs(d.net)), 1)
  const netMagnitude  = Math.pow(10, Math.floor(Math.log10(netMax)))
  const niceNetMax    = Math.ceil(netMax / netMagnitude) * netMagnitude

  function fmtAxis(v: number) {
    const abs = Math.abs(v)
    if (abs >= 1_00_000) return (v < 0 ? "−" : "") + "₹" + (abs / 1_00_000).toFixed(1) + "L"
    if (abs >= 1_000)    return (v < 0 ? "−" : "") + "₹" + Math.round(abs / 1_000) + "k"
    return "₹" + v
  }

  function DiverBar(props: any) {
    const { x, width, payload, background } = props
    if (!background) return null
    const { lent_out, returned } = payload
    const zeroY = background.y + background.height / 2
    const scale = background.height / 2 / niceMax
    const lentH = lent_out * scale
    const returnedH = returned * scale
    const barW = Math.max(width * 0.5, 4)
    const barX = x + (width - barW) / 2
    return (
      <g>
        {returned > 0 && <rect x={barX} y={zeroY - returnedH} width={barW} height={returnedH} fill="#18A96B" rx={3} ry={3} onMouseEnter={() => setHoveredSeries("returned")} />}
        {lent_out > 0 && <rect x={barX} y={zeroY} width={barW} height={lentH} fill="#D94B45" rx={3} ry={3} onMouseEnter={() => setHoveredSeries("lent_out")} />}
      </g>
    )
  }

  function NetBar(props: any) {
    const { x, width, payload, background } = props
    if (!background) return null
    const { net } = payload
    const zeroY = background.y + background.height / 2
    const scale = background.height / 2 / niceNetMax
    const h = Math.abs(net) * scale
    const barW = Math.max(width * 0.5, 4)
    const barX = x + (width - barW) / 2
    const isPos = net >= 0
    return <rect x={barX} y={isPos ? zeroY - h : zeroY} width={barW} height={h} fill={isPos ? "#18A96B" : "#D94B45"} rx={3} ry={3} />
  }

  return (
    <div>
      {drawerOpen && (
        <TransactionDrawer open={true} onClose={() => setDrawerOpen(false)} title="Money lent" color="#A16207" financialNature="lending" />
      )}

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 32 }}>
        <SummaryCard label="Money received" sublabel="Returned to you" value={fmt(summary?.lending_in ?? 0)} valueColor="#18A96B" count="" onClick={() => setDrawerOpen(true)} />
        <SummaryCard label="Money sent" sublabel="Lent out" value={fmt(summary?.lending_out ?? 0)} valueColor="#D94B45" count="" onClick={() => setDrawerOpen(true)} />
        {(() => {
          const net = (summary?.lending_in ?? 0) - (summary?.lending_out ?? 0)
          return <SummaryCard label="Net" sublabel="Received − Sent" value={(net < 0 ? "−" : "") + fmt(Math.abs(net))} valueColor={net >= 0 ? "#18A96B" : "#D94B45"} count="" onClick={() => setDrawerOpen(true)} />
        })()}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 20 }}>
          <SectionLabel>Lending flow</SectionLabel>
          <SectionLabel>Net outstanding</SectionLabel>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#8A8780" }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: "#18A96B" }} /> Returned
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#8A8780" }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: "#D94B45" }} /> Lent out
            </div>
          </div>
          <TogglePill options={["monthly", "annual"]} labels={["Monthly", "Annual"]} value={view} onChange={v => setView(v as any)} />
        </div>
      </div>

      {chartData.length === 0 ? (
        <p style={{ fontSize: 13, color: "#A8A5A0" }}>No lending data available.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ background: "#FFFFFF", border: "1px solid #E6E4DC", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} onMouseLeave={() => setHoveredSeries(null)}>
                <CartesianGrid vertical={false} stroke="#F0EEE8" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#A8A5A0", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: "#C8C5BE", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} width={52} domain={[-niceMax, niceMax]} />
                <RTooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length || !hoveredSeries) return null
                  const d = payload[0]?.payload; if (!d) return null
                  if (hoveredSeries === "lent_out" && d.lent_out > 0) return (
                    <div style={{ background: "#fff", border: "1px solid #E6E4DC", borderRadius: 9, padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                      <div style={{ color: "#A8A5A0", marginBottom: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{label}</div>
                      <div style={{ color: "#D94B45", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>Money lent: {fmt(d.lent_out)}</div>
                    </div>
                  )
                  if (hoveredSeries === "returned" && d.returned > 0) return (
                    <div style={{ background: "#fff", border: "1px solid #E6E4DC", borderRadius: 9, padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                      <div style={{ color: "#A8A5A0", marginBottom: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{label}</div>
                      <div style={{ color: "#18A96B", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>Money returned: {fmt(d.returned)}</div>
                    </div>
                  )
                  return null
                }} />
                <Bar dataKey="lent_out" shape={DiverBar} background={{ fill: "transparent" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: "#FFFFFF", border: "1px solid #E6E4DC", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={netData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#F0EEE8" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#A8A5A0", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: "#C8C5BE", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} width={52} domain={[-niceNetMax, niceNetMax]} />
                <RTooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload; if (!d) return null
                  const isPos = d.net >= 0
                  return (
                    <div style={{ background: "#fff", border: "1px solid #E6E4DC", borderRadius: 9, padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                      <div style={{ color: "#A8A5A0", marginBottom: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{label}</div>
                      <div style={{ color: isPos ? "#18A96B" : "#D94B45", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                        Net: {isPos ? "" : "−"}{fmt(Math.abs(d.net))}
                      </div>
                    </div>
                  )
                }} />
                <Bar dataKey="net" shape={NetBar} background={{ fill: "transparent" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Investments Tab ───────────────────────────────────────────────────────────
function InvestmentsTab({ summary }: { summary: any }) {
  const [view, setView] = useState<"monthly" | "annual">("monthly")
  const [hoveredSeries, setHoveredSeries] = useState<"invested_out" | "withdrawn" | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ["investment-trend", view],
    queryFn: () => api.get(`/reports/investment-trend?view=${view}`).then(r => r.data),
  })

  const items: any[] = data?.items ?? []
  const chartData = items.map((item: any) => ({ label: item.label, invested_out: item.invested_out, withdrawn: item.withdrawn }))

  const maxVal = Math.max(...items.map((i: any) => i.invested_out), ...items.map((i: any) => i.withdrawn), 1)
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)))
  const niceMax   = Math.ceil(maxVal / magnitude) * magnitude

  const netData = chartData.map((d: any) => ({ label: d.label, net: d.invested_out - d.withdrawn }))
  const netMax = Math.max(...netData.map((d: any) => Math.abs(d.net)), 1)
  const netMagnitude = Math.pow(10, Math.floor(Math.log10(netMax)))
  const niceNetMax   = Math.ceil(netMax / netMagnitude) * netMagnitude

  function fmtAxis(v: number) {
    const abs = Math.abs(v)
    if (abs >= 1_00_000) return (v < 0 ? "−" : "") + "₹" + (abs / 1_00_000).toFixed(1) + "L"
    if (abs >= 1_000)    return (v < 0 ? "−" : "") + "₹" + Math.round(abs / 1_000) + "k"
    return "₹" + v
  }

  function DiverBar(props: any) {
    const { x, width, payload, background } = props
    if (!background) return null
    const { invested_out, withdrawn } = payload
    const zeroY = background.y + background.height / 2
    const scale = background.height / 2 / niceMax
    const investedH  = invested_out * scale
    const withdrawnH = withdrawn    * scale
    const barW = Math.max(width * 0.5, 4)
    const barX = x + (width - barW) / 2
    return (
      <g>
        {invested_out > 0 && <rect x={barX} y={zeroY - investedH} width={barW} height={investedH} fill="#18A96B" rx={3} ry={3} onMouseEnter={() => setHoveredSeries("invested_out")} />}
        {withdrawn > 0    && <rect x={barX} y={zeroY} width={barW} height={withdrawnH} fill="#D94B45" rx={3} ry={3} onMouseEnter={() => setHoveredSeries("withdrawn")} />}
      </g>
    )
  }

  function NetBar(props: any) {
    const { x, width, payload, background } = props
    if (!background) return null
    const { net } = payload
    const zeroY = background.y + background.height / 2
    const scale = background.height / 2 / niceNetMax
    const h = Math.abs(net) * scale
    const barW = Math.max(width * 0.5, 4)
    const barX = x + (width - barW) / 2
    const isPos = net >= 0
    return <rect x={barX} y={isPos ? zeroY - h : zeroY} width={barW} height={h} fill={isPos ? "#18A96B" : "#D94B45"} rx={3} ry={3} />
  }

  return (
    <div>
      {drawerOpen && (
        <TransactionDrawer open={true} onClose={() => setDrawerOpen(false)} title="Investments" color="#2A6DD9" financialNature="investment" />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 32 }}>
        <SummaryCard label="Investments" sublabel="Money put in" value={fmt(summary?.investment_out ?? 0)} valueColor="#18A96B" count="" onClick={() => setDrawerOpen(true)} />
        <SummaryCard label="Withdrawals" sublabel="Money taken out" value={fmt(summary?.investment_in ?? 0)} valueColor="#D94B45" count="" onClick={() => setDrawerOpen(true)} />
        {(() => {
          const net = (summary?.investment_out ?? 0) - (summary?.investment_in ?? 0)
          return <SummaryCard label="Net" sublabel="Invested − Withdrawn" value={(net < 0 ? "−" : "") + fmt(Math.abs(net))} valueColor={net >= 0 ? "#18A96B" : "#D94B45"} count="" onClick={() => setDrawerOpen(true)} />
        })()}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 20 }}>
          <SectionLabel>Investment flow</SectionLabel>
          <SectionLabel>Net position</SectionLabel>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#8A8780" }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: "#18A96B" }} /> Invested (out)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#8A8780" }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: "#D94B45" }} /> Withdrawn
            </div>
          </div>
          <TogglePill options={["monthly", "annual"]} labels={["Monthly", "Annual"]} value={view} onChange={v => setView(v as any)} />
        </div>
      </div>

      {chartData.length === 0 ? (
        <p style={{ fontSize: 13, color: "#A8A5A0" }}>No investment data available.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ background: "#FFFFFF", border: "1px solid #E6E4DC", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} onMouseLeave={() => setHoveredSeries(null)}>
                <CartesianGrid vertical={false} stroke="#F0EEE8" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#A8A5A0", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: "#C8C5BE", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} width={52} domain={[-niceMax, niceMax]} />
                <RTooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length || !hoveredSeries) return null
                  const d = payload[0]?.payload; if (!d) return null
                  if (hoveredSeries === "invested_out" && d.invested_out > 0) return (
                    <div style={{ background: "#fff", border: "1px solid #E6E4DC", borderRadius: 9, padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                      <div style={{ color: "#A8A5A0", marginBottom: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{label}</div>
                      <div style={{ color: "#18A96B", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>Investment: {fmt(d.invested_out)}</div>
                    </div>
                  )
                  if (hoveredSeries === "withdrawn" && d.withdrawn > 0) return (
                    <div style={{ background: "#fff", border: "1px solid #E6E4DC", borderRadius: 9, padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                      <div style={{ color: "#A8A5A0", marginBottom: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{label}</div>
                      <div style={{ color: "#D94B45", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>Withdrawal: {fmt(d.withdrawn)}</div>
                    </div>
                  )
                  return null
                }} />
                <Bar dataKey="invested_out" shape={DiverBar} background={{ fill: "transparent" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: "#FFFFFF", border: "1px solid #E6E4DC", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={netData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#F0EEE8" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#A8A5A0", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: "#C8C5BE", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} width={52} domain={[-niceNetMax, niceNetMax]} />
                <RTooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload; if (!d) return null
                  const isPos = d.net >= 0
                  return (
                    <div style={{ background: "#fff", border: "1px solid #E6E4DC", borderRadius: 9, padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                      <div style={{ color: "#A8A5A0", marginBottom: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{label}</div>
                      <div style={{ color: isPos ? "#18A96B" : "#D94B45", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>Net: {isPos ? "" : "−"}{fmt(Math.abs(d.net))}</div>
                    </div>
                  )
                }} />
                <Bar dataKey="net" shape={NetBar} background={{ fill: "transparent" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

// ── TrendChart (overview) ─────────────────────────────────────────────────────
function TrendChart({ items }: { items: any[] }) {
  if (!items.length) return <p style={{ fontSize: 13, color: "#A8A5A0" }}>No trend data available.</p>

  const CHART_H  = 200
  const Y_STEPS  = 4
  const BAR_GAP  = 8
  const Y_AXIS_W = 52

  const maxVal    = Math.max(...items.map((i: any) => Math.max(i.spend, i.income)), 1)
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
      <div style={{ display: "flex", gap: 16, marginBottom: 12, justifyContent: "flex-end" }}>
        {[{ label: "Income", color: "#18A96B" }, { label: "Expenses", color: "#D94B45" }].map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#8A8780" }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 0 }}>
        <div style={{ width: Y_AXIS_W, flexShrink: 0, position: "relative", height: CHART_H + 24 }}>
          {gridLines.map((v, i) => (
            <span key={i} style={{
              position: "absolute", top: (1 - (v / niceMax)) * CHART_H - 8, right: 8,
              fontSize: 9, color: "#C8C5BE", whiteSpace: "nowrap", fontFamily: "'JetBrains Mono', monospace",
            }}>{fmtY(v)}</span>
          ))}
        </div>

        <div style={{ flex: 1, position: "relative" }}>
          <div style={{ position: "relative", height: CHART_H }}>
            {gridLines.map((v, i) => (
              <div key={i} style={{
                position: "absolute", top: (1 - (v / niceMax)) * CHART_H,
                left: 0, right: 0, height: "0.5px",
                background: i === 0 ? "#D0CEC8" : "#F0EEE8",
              }} />
            ))}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", alignItems: "flex-end", gap: BAR_GAP, height: CHART_H }}>
              {items.map((item: any) => {
                const hSpend  = item.spend  > 0 ? Math.max((item.spend  / niceMax) * CHART_H, 3) : 0
                const hIncome = item.income > 0 ? Math.max((item.income / niceMax) * CHART_H, 3) : 0
                return (
                  <div key={item.key} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", gap: 2 }}>
                    <div title={`${item.label} income: ${fmt(item.income)}`} style={{ flex: 1, height: hIncome, background: "#18A96B", borderRadius: "3px 3px 0 0", opacity: hIncome === 0 ? 0 : 0.85 }} />
                    <div title={`${item.label} expenses: ${fmt(item.spend)}`} style={{ flex: 1, height: hSpend, background: "#D94B45", borderRadius: "3px 3px 0 0", opacity: hSpend === 0 ? 0 : 0.85 }} />
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ height: "0.5px", background: "#D0CEC8", marginBottom: 6 }} />
          <div style={{ display: "flex", gap: BAR_GAP }}>
            {items.map((item: any) => (
              <div key={item.key} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "#C8C5BE", fontFamily: "'JetBrains Mono', monospace" }}>
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── SummaryCard ───────────────────────────────────────────────────────────────
function SummaryCard({ label, sublabel, value, valueColor, count, onClick }: {
  label: string; sublabel: string; value: string; valueColor: string; count: string; onClick?: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "#FFFFFF",
        border: `1px solid ${hov && onClick ? "#D0CEC8" : "#E6E4DC"}`,
        borderRadius: 12, padding: "20px 22px",
        cursor: onClick ? "pointer" : "default",
        boxShadow: hov && onClick ? "0 4px 12px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      <p style={{ margin: "0 0 3px", fontSize: 10, fontWeight: 700, color: "#A8A5A0", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </p>
      <p style={{ margin: "0 0 14px", fontSize: 11, color: "#C8C5BE", lineHeight: 1.4 }}>
        {sublabel}
      </p>
      <p style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 700, color: valueColor, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.03em", lineHeight: 1 }}>
        {value}
      </p>
      {count && <p style={{ margin: 0, fontSize: 11, color: "#A8A5A0" }}>{count}</p>}
    </div>
  )
}

// ── TogglePill ────────────────────────────────────────────────────────────────
function TogglePill({ options, labels, value, onChange }: {
  options: string[]; labels: string[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid #E6E4DC", background: "#F5F4F2" }}>
      {options.map((opt, i) => (
        <button key={opt} onClick={() => onChange(opt)} style={{
          padding: "4px 12px", fontSize: 11, border: "none", cursor: "pointer",
          background: value === opt ? "#1A1916" : "transparent",
          color: value === opt ? "#FFFFFF" : "#8A8780",
          fontWeight: value === opt ? 700 : 500,
          transition: "background 0.12s",
          fontFamily: "'Manrope', sans-serif",
          letterSpacing: "0.01em",
        }}>
          {labels[i]}
        </button>
      ))}
    </div>
  )
}
