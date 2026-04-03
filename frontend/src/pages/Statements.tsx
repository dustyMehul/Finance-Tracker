import { useQuery } from "@tanstack/react-query"
import { getAccounts, getJobs } from "../api/client"
import type { Account, UploadJobResponse } from "../types"

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:    { bg: "#FAEEDA", color: "#633806" },
  processing: { bg: "#EAF3DE", color: "#27500A" },
  done:       { bg: "#E6F1FB", color: "#0C447C" },
  failed:     { bg: "#FDE8E8", color: "#791F1F" },
  finalized:  { bg: "#EEEDFE", color: "#3C3489" },
}

const TYPE_LABEL: Record<string, string> = {
  savings: "Savings", current: "Current", credit: "Credit Card", wallet: "Wallet",
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function JobRow({ job }: { job: UploadJobResponse }) {
  const s = STATUS_STYLE[job.status] ?? { bg: "#f3f4f6", color: "#444" }
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 16px", borderBottom: "0.5px solid #f3f1e9",
    }}>
      {/* file icon */}
      <div style={{ fontSize: 18, flexShrink: 0 }}>📄</div>

      {/* filename + date */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {job.filename}
        </div>
        <div style={{ fontSize: 12, color: "#888780", marginTop: 2 }}>{fmt(job.created_at)}</div>
      </div>

      {/* counts */}
      {job.transaction_count != null && (
        <div style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
          {job.transaction_count} txns
          {job.duplicate_count ? <span style={{ color: "#BA7517" }}> · {job.duplicate_count} dup</span> : null}
          {job.pending_count ? <span style={{ color: "#E24B4A" }}> · {job.pending_count} pending</span> : null}
        </div>
      )}

      {/* status badge */}
      <span style={{
        fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 99,
        background: s.bg, color: s.color, whiteSpace: "nowrap",
      }}>
        {job.status}
      </span>
    </div>
  )
}

function AccountSection({ account, jobs }: { account: Account | null; jobs: UploadJobResponse[] }) {
  const color = account?.color ?? "#9ca3af"
  const meta = account
    ? [account.bank, account.account_type ? TYPE_LABEL[account.account_type] : null, account.last_4 ? `···· ${account.last_4}` : null].filter(Boolean).join(" · ")
    : null

  return (
    <div style={{ marginBottom: 28 }}>
      {/* account header */}
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

      {/* jobs list */}
      <div style={{ border: "0.5px solid #d3d1c7", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
        {jobs.length === 0 ? (
          <div style={{ padding: "14px 16px", fontSize: 13, color: "#888780" }}>No files uploaded yet.</div>
        ) : (
          jobs.map(j => <JobRow key={j.job_id} job={j} />)
        )}
      </div>
    </div>
  )
}

export default function Statements() {
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: getAccounts,
  })
  const { data: jobs = [], isLoading: loadingJobs } = useQuery<UploadJobResponse[]>({
    queryKey: ["jobs"],
    queryFn: getJobs,
  })

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
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: 20, fontWeight: 500, margin: "0 0 4px" }}>Statements</h1>
      <p style={{ fontSize: 13, color: "#888780", margin: "0 0 28px" }}>
        All uploaded files, grouped by account.
      </p>

      {accounts.length === 0 && jobs.length === 0 && (
        <div style={{ fontSize: 14, color: "#888780" }}>No files uploaded yet.</div>
      )}

      {/* one section per account */}
      {accounts.map(account => (
        <AccountSection
          key={account.id}
          account={account}
          jobs={jobsByAccount.get(account.id) ?? []}
        />
      ))}

      {/* unassigned section — only if there are unassigned jobs */}
      {unassigned.length > 0 && (
        <AccountSection account={null} jobs={unassigned} />
      )}
    </div>
  )
}
