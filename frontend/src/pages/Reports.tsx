import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import {
  PieChart, Pie, Tooltip as RTooltip, ResponsiveContainer,
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
} from "recharts"

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

      {tab === "Overview"     && <OverviewTab summary={summary} isLoading={isLoading} period={period} />}
      {tab === "Expenses"     && <ExpensesTab period={period} />}
      {tab === "Credit card"  && <ExpensesTab period={period} accountType="credit" />}
      {tab === "Investments"  && <InvestmentsTab summary={summary} />}
      {tab === "Money lent"   && <MoneyLentTab summary={summary} />}
      {tab !== "Overview" && tab !== "Expenses" && tab !== "Credit card" && tab !== "Investments" && tab !== "Money lent" && (
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
              TREND OF INCOME &amp; EXPENSES
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

// ─── Expenses Tab ────────────────────────────────────────────────────────────

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
      background: "#fff", border: "0.5px solid #d3d1c7",
      borderRadius: 8, padding: "8px 12px", fontSize: 12,
    }}>
      <div style={{ color: "#888780", marginBottom: 4 }}>{label}</div>
      <div style={{ color: item.stroke ?? item.fill, fontWeight: 500 }}>
        {displayName}: {fmt(Number(item.value ?? 0))}
      </div>
    </div>
  )
}

function ExpensesTab({ period, accountType }: { period: string; accountType?: string }) {
  const [trendView, setTrendView] = useState<"monthly" | "annual">("monthly")
  const [activeKey, setActiveKey] = useState<string>("spend")

  const atParam = accountType ? `&account_type=${accountType}` : ""

  const { data: categories } = useQuery({
    queryKey: ["categories", period, accountType],
    queryFn: () => api.get(`/reports/categories?period=${period}${atParam}`).then(r => r.data),
  })

  const { data: expTrend } = useQuery({
    queryKey: ["expense-trend", trendView, accountType],
    queryFn: () => api.get(`/reports/expense-trend?view=${trendView}${atParam}`).then(r => r.data),
  })

  // build donut slices: top 9 + rest
  const allCats: any[] = categories?.categories ?? []
  const top9 = allCats.slice(0, 9)
  const rest = allCats.slice(9)
  const restTotal = rest.reduce((s: number, c: any) => s + c.amount, 0)
  const donutData = [
    ...top9.map((c: any) => ({ name: c.label_name, value: c.amount, fill: c.color || "#d3d1c7" })),
    ...(restTotal > 0 ? [{ name: "Other", value: restTotal, fill: "#d3d1c7" }] : []),
  ]
  const totalExp = allCats.reduce((s: number, c: any) => s + c.amount, 0)

  // determine which tracked slugs have any data in the trend
  const trackedSlugs: string[] = expTrend?.tracked ?? []
  const activeLines = trackedSlugs.filter((slug: string) =>
    (expTrend?.items ?? []).some((item: any) => (item.categories?.[slug] ?? 0) > 0)
  )

  // flatten trend items for recharts
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
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 32 }}>

      {/* ── Left: donut chart ── */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 500, color: "#888780", letterSpacing: "0.05em", margin: "0 0 16px" }}>
          SPEND BY CATEGORY
        </p>

        {donutData.length === 0 ? (
          <p style={{ fontSize: 13, color: "#b4b2a9" }}>No expense data for this period.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ position: "relative", width: 220, height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%" cy="50%"
                    innerRadius={68} outerRadius={100}
                    dataKey="value"
                    strokeWidth={1.5}
                    stroke="#fff"
                  />
                  <RTooltip
                    formatter={(value, name) => [fmt(Number(value ?? 0)), String(name)]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "0.5px solid #d3d1c7" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* centre label */}
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center", pointerEvents: "none",
              }}>
                <div style={{ fontSize: 11, color: "#888780" }}>Total</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "#1a1a18" }}>{fmt(totalExp)}</div>
              </div>
            </div>

            {/* legend */}
            <div style={{ width: "100%", marginTop: 12 }}>
              {donutData.map((d: any) => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: d.fill, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "#444441", flex: 1 }}>{d.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#1a1a18" }}>{fmt(d.value)}</span>
                  <span style={{ fontSize: 11, color: "#888780", width: 36, textAlign: "right" }}>
                    {Math.round((d.value / totalExp) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Right: trend + category lines ── */}
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

        {trendItems.length === 0 ? (
          <p style={{ fontSize: 13, color: "#b4b2a9" }}>No trend data available.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart
                data={trendItems}
                margin={{ top: 4, right: 52, left: 0, bottom: 0 }}
                onMouseLeave={() => setActiveKey("spend")}
              >
                <CartesianGrid vertical={false} stroke="#f1efe8" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#888780" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="bar" tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: "#b4b2a9" }} axisLine={false} tickLine={false} width={48} />
                <YAxis yAxisId="line" orientation="right" tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: "#b4b2a9" }} axisLine={false} tickLine={false} width={48} />
                <RTooltip content={<ExpensesTooltip activeKey={activeKey} />} />
                <Bar
                  yAxisId="bar" dataKey="spend" fill="#E24B4A" opacity={0.25}
                  radius={[3, 3, 0, 0]} name="spend"
                  onMouseOver={() => setActiveKey("spend")}
                />
                {activeLines.map((slug: string) => (
                  <Line
                    key={slug}
                    yAxisId="line"
                    type="linear"
                    dataKey={slug}
                    stroke={LINE_COLORS[slug] ?? "#888780"}
                    strokeWidth={2}
                    dot={false}
                    name={slug}
                    activeDot={{ onMouseOver: () => setActiveKey(slug), r: 4 }}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>

            {/* line legend */}
            {activeLines.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 10 }}>
                {activeLines.map((slug: string) => (
                  <div key={slug} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#888780" }}>
                    <div style={{ width: 16, height: 2, background: LINE_COLORS[slug] ?? "#888780", borderRadius: 1 }} />
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

// ─── Money Lent Tab ──────────────────────────────────────────────────────────

function MoneyLentTab({ summary }: { summary: any }) {
  const [view, setView] = useState<"monthly" | "annual">("monthly")
  const [hoveredSeries, setHoveredSeries] = useState<"lent_out" | "returned" | null>(null)

  const { data } = useQuery({
    queryKey: ["lending-trend", view],
    queryFn: () => api.get(`/reports/lending-trend?view=${view}`).then(r => r.data),
  })

  const items: any[] = data?.items ?? []

  const chartData = items.map((item: any) => ({
    label:    item.label,
    lent_out: item.lent_out,
    returned: item.returned,
  }))

  const maxVal = Math.max(
    ...items.map((i: any) => i.lent_out),
    ...items.map((i: any) => i.returned),
    1,
  )
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)))
  const niceMax   = Math.ceil(maxVal / magnitude) * magnitude

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
    const zeroY     = background.y + background.height / 2
    const scale     = background.height / 2 / niceMax
    const lentH     = lent_out * scale
    const returnedH = returned * scale
    const barW = Math.max(width * 0.5, 4)
    const barX = x + (width - barW) / 2
    return (
      <g>
        {returned > 0 && (
          <rect x={barX} y={zeroY - returnedH} width={barW} height={returnedH}
            fill="#1D9E75" rx={3} ry={3}
            onMouseEnter={() => setHoveredSeries("returned")}
          />
        )}
        {lent_out > 0 && (
          <rect x={barX} y={zeroY} width={barW} height={lentH}
            fill="#E24B4A" rx={3} ry={3}
            onMouseEnter={() => setHoveredSeries("lent_out")}
          />
        )}
      </g>
    )
  }

  // positive net = more returned than lent (green up), negative = more lent out (red down)
  const netData = chartData.map((d: any) => ({
    label: d.label,
    net:   d.returned - d.lent_out,
  }))
  const netMax        = Math.max(...netData.map((d: any) => Math.abs(d.net)), 1)
  const netMagnitude  = Math.pow(10, Math.floor(Math.log10(netMax)))
  const niceNetMax    = Math.ceil(netMax / netMagnitude) * netMagnitude

  function NetBar(props: any) {
    const { x, width, payload, background } = props
    if (!background) return null
    const { net } = payload
    const zeroY = background.y + background.height / 2
    const scale = background.height / 2 / niceNetMax
    const h     = Math.abs(net) * scale
    const barW  = Math.max(width * 0.5, 4)
    const barX  = x + (width - barW) / 2
    const isPos = net >= 0
    return (
      <rect
        x={barX} y={isPos ? zeroY - h : zeroY}
        width={barW} height={h}
        fill={isPos ? "#1D9E75" : "#E24B4A"}
        rx={3} ry={3}
      />
    )
  }

  return (
    <div>
      {/* 3 summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 28 }}>
        <SummaryCard label="Money received" sublabel="Returned to you" value={fmt(summary?.lending_in ?? 0)} valueColor="#1D9E75" count="" />
        <SummaryCard label="Money sent" sublabel="Lent out" value={fmt(summary?.lending_out ?? 0)} valueColor="#E24B4A" count="" />
        {(() => {
          const net = (summary?.lending_in ?? 0) - (summary?.lending_out ?? 0)
          return <SummaryCard label="Net" sublabel="Received − Sent" value={(net < 0 ? "−" : "") + fmt(Math.abs(net))} valueColor={net >= 0 ? "#1D9E75" : "#E24B4A"} count="" />
        })()}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: "#888780", letterSpacing: "0.05em", margin: 0 }}>LENDING FLOW</p>
          <p style={{ fontSize: 11, fontWeight: 500, color: "#888780", letterSpacing: "0.05em", margin: 0 }}>NET OUTSTANDING</p>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#888780" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#1D9E75" }} /> Returned
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#888780" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#E24B4A" }} /> Lent out
            </div>
          </div>
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "0.5px solid #d3d1c7" }}>
            {(["monthly", "annual"] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: "4px 12px", fontSize: 12, border: "none", cursor: "pointer",
                background: view === v ? "#1a1a18" : "transparent",
                color: view === v ? "#fff" : "#888780",
                fontWeight: view === v ? 500 : 400,
              }}>{v === "monthly" ? "Monthly" : "Annual"}</button>
            ))}
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <p style={{ fontSize: 13, color: "#b4b2a9" }}>No lending data available.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} onMouseLeave={() => setHoveredSeries(null)}>
              <CartesianGrid vertical={false} stroke="#f1efe8" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#888780" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: "#b4b2a9" }} axisLine={false} tickLine={false} width={52} domain={[-niceMax, niceMax]} />
              <RTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length || !hoveredSeries) return null
                  const d = payload[0]?.payload
                  if (!d) return null
                  if (hoveredSeries === "lent_out" && d.lent_out > 0) return (
                    <div style={{ background: "#fff", border: "0.5px solid #d3d1c7", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                      <div style={{ color: "#888780", marginBottom: 4 }}>{label}</div>
                      <div style={{ color: "#E24B4A" }}>Money lent : {fmt(d.lent_out)}</div>
                    </div>
                  )
                  if (hoveredSeries === "returned" && d.returned > 0) return (
                    <div style={{ background: "#fff", border: "0.5px solid #d3d1c7", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                      <div style={{ color: "#888780", marginBottom: 4 }}>{label}</div>
                      <div style={{ color: "#1D9E75" }}>Money returned : {fmt(d.returned)}</div>
                    </div>
                  )
                  return null
                }}
              />
              <Bar dataKey="lent_out" shape={DiverBar} background={{ fill: "transparent" }} />
            </ComposedChart>
          </ResponsiveContainer>

          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={netData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#f1efe8" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#888780" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: "#b4b2a9" }} axisLine={false} tickLine={false} width={52} domain={[-niceNetMax, niceNetMax]} />
              <RTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload
                  if (!d) return null
                  const isPos = d.net >= 0
                  return (
                    <div style={{ background: "#fff", border: "0.5px solid #d3d1c7", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                      <div style={{ color: "#888780", marginBottom: 4 }}>{label}</div>
                      <div style={{ color: isPos ? "#1D9E75" : "#E24B4A" }}>
                        Net : {isPos ? "" : "−"}{fmt(Math.abs(d.net))}
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="net" shape={NetBar} background={{ fill: "transparent" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─── Investments Tab ─────────────────────────────────────────────────────────

function InvestmentsTab({ summary }: { summary: any }) {
  const [view, setView] = useState<"monthly" | "annual">("monthly")
  const [hoveredSeries, setHoveredSeries] = useState<"invested_out" | "withdrawn" | null>(null)

  const { data } = useQuery({
    queryKey: ["investment-trend", view],
    queryFn: () => api.get(`/reports/investment-trend?view=${view}`).then(r => r.data),
  })

  const items: any[] = data?.items ?? []

  const chartData = items.map((item: any) => ({
    label:        item.label,
    invested_out: item.invested_out,
    withdrawn:    item.withdrawn,
  }))

  function DiverBar(props: any) {
    const { x, width, payload, background } = props
    if (!background) return null
    const { invested_out, withdrawn } = payload
    const zeroY      = background.y + background.height / 2
    const scale      = background.height / 2 / niceMax
    const investedH  = invested_out * scale
    const withdrawnH = withdrawn    * scale
    const barW = Math.max(width * 0.5, 4)
    const barX = x + (width - barW) / 2
    return (
      <g>
        {invested_out > 0 && (
          <rect x={barX} y={zeroY - investedH} width={barW} height={investedH}
            fill="#1D9E75" rx={3} ry={3}
            onMouseEnter={() => setHoveredSeries("invested_out")}
          />
        )}
        {withdrawn > 0 && (
          <rect x={barX} y={zeroY} width={barW} height={withdrawnH}
            fill="#E24B4A" rx={3} ry={3}
            onMouseEnter={() => setHoveredSeries("withdrawn")}
          />
        )}
      </g>
    )
  }

  const maxVal = Math.max(
    ...items.map((i: any) => i.invested_out),
    ...items.map((i: any) => i.withdrawn),
    1,
  )
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)))
  const niceMax   = Math.ceil(maxVal / magnitude) * magnitude

  function fmtAxis(v: number) {
    const abs = Math.abs(v)
    if (abs >= 1_00_000) return (v < 0 ? "−" : "") + "₹" + (abs / 1_00_000).toFixed(1) + "L"
    if (abs >= 1_000)    return (v < 0 ? "−" : "") + "₹" + Math.round(abs / 1_000) + "k"
    return "₹" + v
  }

  // net data for the second chart
  const netData = chartData.map((d: any) => ({
    label: d.label,
    net:   d.invested_out - d.withdrawn,
  }))
  const netMax = Math.max(...netData.map((d: any) => Math.abs(d.net)), 1)
  const netMagnitude = Math.pow(10, Math.floor(Math.log10(netMax)))
  const niceNetMax   = Math.ceil(netMax / netMagnitude) * netMagnitude

  function NetBar(props: any) {
    const { x, width, payload, background } = props
    if (!background) return null
    const { net } = payload
    const zeroY  = background.y + background.height / 2
    const scale  = background.height / 2 / niceNetMax
    const h      = Math.abs(net) * scale
    const barW   = Math.max(width * 0.5, 4)
    const barX   = x + (width - barW) / 2
    const isPos  = net >= 0
    return (
      <rect
        x={barX}
        y={isPos ? zeroY - h : zeroY}
        width={barW} height={h}
        fill={isPos ? "#1D9E75" : "#E24B4A"}
        rx={3} ry={3}
      />
    )
  }

  return (
    <div>
      {/* 3 summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 28 }}>
        <SummaryCard label="Investments" sublabel="Money put in" value={fmt(summary?.investment_out ?? 0)} valueColor="#1D9E75" count="" />
        <SummaryCard label="Withdrawals" sublabel="Money taken out" value={fmt(summary?.investment_in ?? 0)} valueColor="#E24B4A" count="" />
        {(() => {
          const net = (summary?.investment_out ?? 0) - (summary?.investment_in ?? 0)
          return <SummaryCard label="Net" sublabel="Invested − Withdrawn" value={(net < 0 ? "−" : "") + fmt(Math.abs(net))} valueColor={net >= 0 ? "#1D9E75" : "#E24B4A"} count="" />
        })()}
      </div>

      {/* header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: "#888780", letterSpacing: "0.05em", margin: 0 }}>
            INVESTMENT FLOW
          </p>
          <p style={{ fontSize: 11, fontWeight: 500, color: "#888780", letterSpacing: "0.05em", margin: 0 }}>
            NET POSITION
          </p>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#888780" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#1D9E75" }} />
              Invested (out)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#888780" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#E24B4A" }} />
              Withdrawn
            </div>
          </div>
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "0.5px solid #d3d1c7" }}>
            {(["monthly", "annual"] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: "4px 12px", fontSize: 12, border: "none", cursor: "pointer",
                background: view === v ? "#1a1a18" : "transparent",
                color: view === v ? "#fff" : "#888780",
                fontWeight: view === v ? 500 : 400,
              }}>
                {v === "monthly" ? "Monthly" : "Annual"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <p style={{ fontSize: 13, color: "#b4b2a9" }}>No investment data available.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* ── Left: diverging flow ── */}
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} onMouseLeave={() => setHoveredSeries(null)}>
              <CartesianGrid vertical={false} stroke="#f1efe8" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#888780" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: "#b4b2a9" }} axisLine={false} tickLine={false} width={52} domain={[-niceMax, niceMax]} />
              <RTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length || !hoveredSeries) return null
                  const d = payload[0]?.payload
                  if (!d) return null
                  if (hoveredSeries === "invested_out" && d.invested_out > 0) return (
                    <div style={{ background: "#fff", border: "0.5px solid #d3d1c7", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                      <div style={{ color: "#888780", marginBottom: 4 }}>{label}</div>
                      <div style={{ color: "#1D9E75" }}>Investment done : {fmt(d.invested_out)}</div>
                    </div>
                  )
                  if (hoveredSeries === "withdrawn" && d.withdrawn > 0) return (
                    <div style={{ background: "#fff", border: "0.5px solid #d3d1c7", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                      <div style={{ color: "#888780", marginBottom: 4 }}>{label}</div>
                      <div style={{ color: "#E24B4A" }}>Investment withdrawal : {fmt(d.withdrawn)}</div>
                    </div>
                  )
                  return null
                }}
              />
              <Bar dataKey="invested_out" shape={DiverBar} background={{ fill: "transparent" }} />
            </ComposedChart>
          </ResponsiveContainer>

          {/* ── Right: net position ── */}
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={netData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#f1efe8" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#888780" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: "#b4b2a9" }} axisLine={false} tickLine={false} width={52} domain={[-niceNetMax, niceNetMax]} />
              <RTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload
                  if (!d) return null
                  const isPos = d.net >= 0
                  return (
                    <div style={{ background: "#fff", border: "0.5px solid #d3d1c7", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                      <div style={{ color: "#888780", marginBottom: 4 }}>{label}</div>
                      <div style={{ color: isPos ? "#1D9E75" : "#E24B4A" }}>
                        Net : {isPos ? "" : "−"}{fmt(Math.abs(d.net))}
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="net" shape={NetBar} background={{ fill: "transparent" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─── Overview trend chart ─────────────────────────────────────────────────────

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
