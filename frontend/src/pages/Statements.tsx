import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getAccounts, getJobs, getLabels, getTransactions } from "../api/client"
import type { Account, UploadJobResponse, Transaction, Label } from "../types"

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:    { bg: "#FAEEDA", color: "#633806" },
  processing: { bg: "#EAF3DE", color: "#27500A" },
  done:       { bg: "#E6F1FB", color: "#0C447C" },
  failed:     { bg: "#FDE8E8", color: "#791F1F" },
  finalized:  { bg: "#EEEDFE", color: "#3C3489" },
}

const NATURE_STYLE: Record<string, { bg: string; color: string }> = {
  expense:    { bg: "#FDE8E8", color: "#791F1F" },
  income:     { bg: "#EAF3DE", color: "#27500A" },
  investment: { bg: "#E6F1FB", color: "#0C447C" },
  transfer:   { bg: "#F1EFE8", color: "#444441" },
  lending:    { bg: "#FAEEDA", color: "#633806" },
  unknown:    { bg: "#F3F4F6", color: "#6B7280" },
}

const TYPE_LABEL: Record<string, string> = {
  savings: "Savings", current: "Current", credit: "Credit Card", wallet: "Wallet",
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function fmtAmt(n: number) {
  return "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN")
}

// ── Transaction rows inside an expanded job ────────────────────────────────
function JobTransactions({ jobId, labelMap }: { jobId: string; labelMap: Map<string, Label> }) {
  const { data: txns = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["txns-stmt", jobId],
    queryFn: () => getTransactions({ upload_job_id: jobId, include_finalized: true, limit: 1000 }),
  })

  if (isLoading) return (
    <div style={{ padding: "14px 20px", fontSize: 13, color: "#888780" }}>Loading…</div>
  )
  if (txns.length === 0) return (
    <div style={{ padding: "14px 20px", fontSize: 13, color: "#888780" }}>No transactions.</div>
  )

  return (
    <div>
      {/* column header */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 120px 120px 110px",
        padding: "7px 20px", background: "#f8f7f4",
        borderBottom: "0.5px solid #e5e3db",
        fontSize: 11, fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.04em",
      }}>
        <span>Description</span>
        <span style={{ textAlign: "right" }}>Amount</span>
        <span style={{ textAlign: "center" }}>Category</span>
        <span style={{ textAlign: "center" }}>Nature</span>
      </div>

      {txns.map(t => {
        const label = t.label_id ? labelMap.get(t.label_id) : null
        const nature = t.financial_nature ?? "unknown"
        const ns = NATURE_STYLE[nature] ?? NATURE_STYLE.unknown
        const isDebit = t.transaction_type === "debit"
        return (
          <div key={t.id} style={{
            display: "grid", gridTemplateColumns: "1fr 120px 120px 110px",
            padding: "9px 20px", borderBottom: "0.5px solid #f3f1e9",
            alignItems: "center",
          }}>
            {/* description + date */}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.description || t.description_raw}
              </div>
              <div style={{ fontSize: 11, color: "#888780", marginTop: 1 }}>{fmtDate(t.date)}</div>
            </div>

            {/* amount */}
            <div style={{ textAlign: "right", fontSize: 13, fontWeight: 500, color: isDebit ? "#E24B4A" : "#1D9E75" }}>
              {isDebit ? "−" : "+"}{fmtAmt(t.amount)}
            </div>

            {/* label */}
            <div style={{ textAlign: "center" }}>
              {label ? (
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 99,
                  background: label.color ? `${label.color}22` : "#f1efe8",
                  color: label.color ?? "#444441",
                  border: `0.5px solid ${label.color ?? "#d3d1c7"}`,
                  whiteSpace: "nowrap",
                }}>
                  {label.name}
                </span>
              ) : (
                <span style={{ fontSize: 11, color: "#b4b2a9" }}>—</span>
              )}
            </div>

            {/* nature */}
            <div style={{ textAlign: "center" }}>
              <span style={{
                fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 99,
                background: ns.bg, color: ns.color,
              }}>
                {nature}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Single job row (collapsible) ───────────────────────────────────────────
function JobRow({ job, labelMap, expanded, onToggle }: {
  job: UploadJobResponse; labelMap: Map<string, Label>
  expanded: boolean; onToggle: () => void
}) {
  const s = STATUS_STYLE[job.status] ?? { bg: "#f3f4f6", color: "#444" }

  return (
    <div>
      {/* header row — click to expand */}
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 16px", borderBottom: expanded ? "none" : "0.5px solid #f3f1e9",
          cursor: "pointer", userSelect: "none",
          background: expanded ? "#f8f7f4" : "transparent",
          transition: "background 0.1s",
        }}
        onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "#faf9f7" }}
        onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "transparent" }}
      >
        {/* chevron */}
        <span style={{ fontSize: 11, color: "#b4b2a9", flexShrink: 0, transition: "transform 0.15s", display: "inline-block", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}>
          ▶
        </span>

        {/* filename + date */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {job.filename}
          </div>
          <div style={{ fontSize: 12, color: "#888780", marginTop: 2 }}>{fmtDate(job.created_at)}</div>
        </div>

        {/* counts */}
        {job.transaction_count != null && (
          <div style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
            {job.transaction_count} txns
            {job.duplicate_count ? <span style={{ color: "#BA7517" }}> · {job.duplicate_count} dup</span> : null}
            {job.pending_count   ? <span style={{ color: "#E24B4A" }}> · {job.pending_count} pending</span> : null}
          </div>
        )}

        {/* status badge */}
        <span style={{
          fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 99,
          background: s.bg, color: s.color, whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {job.status}
        </span>
      </div>

      {/* expanded transactions */}
      {expanded && (
        <div style={{ borderTop: "0.5px solid #e5e3db" }}>
          <JobTransactions jobId={job.job_id} labelMap={labelMap} />
        </div>
      )}
    </div>
  )
}

// ── Account section ────────────────────────────────────────────────────────
function AccountSection({ account, jobs, labelMap, expandedJobId, onToggle }: {
  account: Account | null
  jobs: UploadJobResponse[]
  labelMap: Map<string, Label>
  expandedJobId: string | null
  onToggle: (id: string) => void
}) {
  const color = account?.color ?? "#9ca3af"
  const meta = account
    ? [account.bank, account.account_type ? TYPE_LABEL[account.account_type] : null, account.last_4 ? `···· ${account.last_4}` : null].filter(Boolean).join(" · ")
    : null

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <div>
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            {account ? account.display_name : "Unassigned"}
          </span>
          {meta && <span style={{ fontSize: 12, color: "#888780", marginLeft: 8 }}>{meta}</span>}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#888780" }}>
          {jobs.length} file{jobs.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div style={{ border: "0.5px solid #d3d1c7", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
        {jobs.length === 0 ? (
          <div style={{ padding: "14px 16px", fontSize: 13, color: "#888780" }}>No files uploaded yet.</div>
        ) : (
          jobs.map(j => <JobRow key={j.job_id} job={j} labelMap={labelMap} expanded={expandedJobId === j.job_id} onToggle={() => onToggle(j.job_id)} />)
        )}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function Statements() {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

  function handleToggle(id: string) {
    setExpandedJobId(prev => prev === id ? null : id)
  }

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery<Account[]>({
    queryKey: ["accounts"], queryFn: getAccounts,
  })
  const { data: jobs = [], isLoading: loadingJobs } = useQuery<UploadJobResponse[]>({
    queryKey: ["jobs"], queryFn: getJobs,
  })
  const { data: labels = [] } = useQuery<Label[]>({
    queryKey: ["labels"], queryFn: getLabels,
  })

  const labelMap = new Map(labels.map(l => [l.id, l]))

  if (loadingAccounts || loadingJobs) {
    return <div style={{ padding: "2rem", fontSize: 14, color: "#888780" }}>Loading…</div>
  }

  const jobsByAccount = new Map<string | null, UploadJobResponse[]>()
  for (const job of jobs) {
    const key = job.account_id ?? null
    if (!jobsByAccount.has(key)) jobsByAccount.set(key, [])
    jobsByAccount.get(key)!.push(job)
  }

  const unassigned = jobsByAccount.get(null) ?? []

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: 20, fontWeight: 500, margin: "0 0 4px" }}>Statements</h1>
      <p style={{ fontSize: 13, color: "#888780", margin: "0 0 28px" }}>
        All uploaded files, grouped by account. Click a file to view its transactions.
      </p>

      {accounts.length === 0 && jobs.length === 0 && (
        <div style={{ fontSize: 14, color: "#888780" }}>No files uploaded yet.</div>
      )}

      {accounts.map(account => (
        <AccountSection
          key={account.id}
          account={account}
          jobs={jobsByAccount.get(account.id) ?? []}
          labelMap={labelMap}
          expandedJobId={expandedJobId}
          onToggle={handleToggle}
        />
      ))}

      {unassigned.length > 0 && (
        <AccountSection account={null} jobs={unassigned} labelMap={labelMap} expandedJobId={expandedJobId} onToggle={handleToggle} />
      )}
    </div>
  )
}
