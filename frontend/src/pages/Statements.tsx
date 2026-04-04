import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getAccounts, getJobs, getLabels, getTransactions } from "../api/client"
import type { Account, UploadJobResponse, Transaction, Label } from "../types"

// ── Badge configs ──────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  pending:    { bg: "#FEFCE8", color: "#92400E", border: "#FDE68A" },
  processing: { bg: "#EFF4FE", color: "#1E40AF", border: "#BDD0F7" },
  done:       { bg: "#EDFAF3", color: "#166534", border: "#A7E9CB" },
  failed:     { bg: "#FEF0EF", color: "#991B1B", border: "#F9C8C6" },
  finalized:  { bg: "#F5F3FF", color: "#5B21B6", border: "#DDD6FE" },
}

const NATURE_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  expense:    { bg: "#FEF0EF", color: "#991B1B", border: "#F9C8C6" },
  income:     { bg: "#EDFAF3", color: "#166534", border: "#A7E9CB" },
  investment: { bg: "#EFF4FE", color: "#1E40AF", border: "#BDD0F7" },
  transfer:   { bg: "#F5F4F2", color: "#5A5855", border: "#E6E4DC" },
  lending:    { bg: "#FEFCE8", color: "#92400E", border: "#FDE68A" },
  unknown:    { bg: "#F5F4F2", color: "#8A8780", border: "#E6E4DC" },
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

// ── Expanded transaction list ──────────────────────────────────────────────
function JobTransactions({ jobId, labelMap }: { jobId: string; labelMap: Map<string, Label> }) {
  const { data: txns = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["txns-stmt", jobId],
    queryFn: () => getTransactions({ upload_job_id: jobId, include_finalized: true, limit: 1000 }),
  })

  if (isLoading) return (
    <div style={{ padding: "16px 24px", fontSize: 13, color: "#A8A5A0" }}>Loading…</div>
  )
  if (txns.length === 0) return (
    <div style={{ padding: "16px 24px", fontSize: 13, color: "#A8A5A0" }}>No transactions.</div>
  )

  return (
    <div>
      {/* Column header */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 130px 140px 110px",
        padding: "9px 24px", background: "#FAFAF8",
        borderBottom: "1px solid #F0EEE8",
        fontSize: 10, fontWeight: 600, color: "#A8A5A0",
        textTransform: "uppercase", letterSpacing: "0.06em",
      }}>
        <span>Description</span>
        <span style={{ textAlign: "right" }}>Amount</span>
        <span style={{ textAlign: "center" }}>Category</span>
        <span style={{ textAlign: "center" }}>Nature</span>
      </div>

      {txns.map(t => {
        const label = t.label_id ? labelMap.get(t.label_id) : null
        const nature = t.financial_nature ?? "unknown"
        const ns = NATURE_BADGE[nature] ?? NATURE_BADGE.unknown
        const isDebit = t.transaction_type === "debit"

        return (
          <div key={t.id} style={{
            display: "grid", gridTemplateColumns: "1fr 130px 140px 110px",
            padding: "10px 24px", borderBottom: "1px solid #F7F5F0",
            alignItems: "center",
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1A1916" }}>
                {t.description || t.description_raw}
              </div>
              <div style={{ fontSize: 11, color: "#A8A5A0", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                {fmtDate(t.date)}
              </div>
            </div>

            <div style={{
              textAlign: "right", fontSize: 13, fontWeight: 600,
              fontFamily: "'JetBrains Mono', monospace",
              color: isDebit ? "#D94B45" : "#18A96B",
              letterSpacing: "-0.02em",
            }}>
              {isDebit ? "−" : "+"}{fmtAmt(t.amount)}
            </div>

            <div style={{ textAlign: "center" }}>
              {label ? (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                  background: label.color ? `${label.color}18` : "#F5F4F2",
                  color: label.color ?? "#5A5855",
                  border: `1px solid ${label.color ? `${label.color}40` : "#E6E4DC"}`,
                  whiteSpace: "nowrap",
                }}>
                  {label.name}
                </span>
              ) : (
                <span style={{ fontSize: 11, color: "#D0CEC8" }}>—</span>
              )}
            </div>

            <div style={{ textAlign: "center" }}>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                background: ns.bg, color: ns.color, border: `1px solid ${ns.border}`,
                textTransform: "capitalize",
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

// ── Job row (collapsible) ──────────────────────────────────────────────────
function JobRow({ job, labelMap, expanded, onToggle }: {
  job: UploadJobResponse; labelMap: Map<string, Label>
  expanded: boolean; onToggle: () => void
}) {
  const s = STATUS_BADGE[job.status] ?? { bg: "#F5F4F2", color: "#5A5855", border: "#E6E4DC" }

  return (
    <div>
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 18px",
          borderBottom: expanded ? "none" : "1px solid #F0EEE8",
          cursor: "pointer", userSelect: "none",
          background: expanded ? "#FAFAF8" : "transparent",
          transition: "background 0.1s",
        }}
        onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "#FAFAF8" }}
        onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "transparent" }}
      >
        {/* Chevron */}
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="#C8C5BE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
        >
          <polyline points="9 18 15 12 9 6"/>
        </svg>

        {/* Filename + date */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1A1916" }}>
            {job.filename}
          </div>
          <div style={{ fontSize: 11, color: "#A8A5A0", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
            {fmtDate(job.created_at)}
          </div>
        </div>

        {/* Counts */}
        {job.transaction_count != null && (
          <div style={{ fontSize: 11, color: "#8A8780", whiteSpace: "nowrap", fontFamily: "'JetBrains Mono', monospace" }}>
            {job.transaction_count} txns
            {job.duplicate_count ? <span style={{ color: "#A16207" }}> · {job.duplicate_count} dup</span> : null}
            {job.pending_count   ? <span style={{ color: "#D94B45" }}> · {job.pending_count} pending</span> : null}
          </div>
        )}

        {/* Status badge */}
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99,
          background: s.bg, color: s.color, border: `1px solid ${s.border}`,
          whiteSpace: "nowrap", flexShrink: 0, letterSpacing: "0.02em",
          textTransform: "capitalize",
        }}>
          {job.status}
        </span>
      </div>

      {/* Expanded transaction list */}
      {expanded && (
        <div style={{ borderTop: "1px solid #E6E4DC" }}>
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
  const color = account?.color ?? "#A8A5A0"
  const meta = account
    ? [account.bank, account.account_type ? TYPE_LABEL[account.account_type] : null, account.last_4 ? `···· ${account.last_4}` : null].filter(Boolean).join(" · ")
    : null

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: `0 0 0 3px ${color}22` }} />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1916", letterSpacing: "-0.01em" }}>
            {account ? account.display_name : "Unassigned"}
          </span>
          {meta && (
            <span style={{ fontSize: 11, color: "#A8A5A0", marginLeft: 8, fontFamily: "'JetBrains Mono', monospace" }}>
              {meta}
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: "#A8A5A0" }}>
          {jobs.length} file{jobs.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div style={{ border: "1px solid #E6E4DC", borderRadius: 12, overflow: "hidden", background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        {jobs.length === 0 ? (
          <div style={{ padding: "16px 20px", fontSize: 13, color: "#A8A5A0" }}>
            No files uploaded yet.
          </div>
        ) : (
          jobs.map(j => (
            <JobRow
              key={j.job_id} job={j} labelMap={labelMap}
              expanded={expandedJobId === j.job_id}
              onToggle={() => onToggle(j.job_id)}
            />
          ))
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
    return (
      <div style={{ padding: "36px 40px", fontSize: 13, color: "#A8A5A0" }}>Loading…</div>
    )
  }

  const jobsByAccount = new Map<string | null, UploadJobResponse[]>()
  for (const job of jobs) {
    const key = job.account_id ?? null
    if (!jobsByAccount.has(key)) jobsByAccount.set(key, [])
    jobsByAccount.get(key)!.push(job)
  }

  const unassigned = jobsByAccount.get(null) ?? []

  return (
    <div style={{ padding: "36px 40px", maxWidth: 960 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
        Statements
      </h1>
      <p style={{ fontSize: 13, color: "#6B6862", marginBottom: 32 }}>
        All uploaded files grouped by account. Expand a file to view its transactions.
      </p>

      {accounts.length === 0 && jobs.length === 0 && (
        <div style={{
          padding: "40px 24px", borderRadius: 12, border: "1px dashed #D0CEC8",
          background: "#FAFAF8", textAlign: "center", fontSize: 13, color: "#A8A5A0",
        }}>
          No files uploaded yet. Go to Import to get started.
        </div>
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
        <AccountSection
          account={null}
          jobs={unassigned}
          labelMap={labelMap}
          expandedJobId={expandedJobId}
          onToggle={handleToggle}
        />
      )}
    </div>
  )
}
