import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getTransactions, getLabels, getJobs, updateTransaction, finalizeJob } from "../api/client"
import type { Transaction, ReviewStatus } from "../types"

// ── Badge configs ──────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  pending:   { bg: "#1c1508", color: "#e3b341", border: "#3d2e08" },
  approved:  { bg: "#0e1c15", color: "#56d364", border: "#1a4128" },
  edited:    { bg: "#0c1f2e", color: "#79c0ff", border: "#1a3956" },
  ignored:   { bg: "#21262d", color: "#8b949e", border: "#30363d" },
  finalized: { bg: "#1a0e2e", color: "#d2a8ff", border: "#3d1f6d" },
}

const NATURE_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  expense:    { bg: "#1c0a09", color: "#ff7b72", border: "#3d1210" },
  income:     { bg: "#0e1c15", color: "#56d364", border: "#1a4128" },
  transfer:   { bg: "#21262d", color: "#8b949e", border: "#30363d" },
  investment: { bg: "#0c1f2e", color: "#79c0ff", border: "#1a3956" },
  lending:    { bg: "#1c1508", color: "#e3b341", border: "#3d2e08" },
  unknown:    { bg: "#21262d", color: "#656d76", border: "#30363d" },
}

const EXCLUDED_NATURES = new Set(["transfer", "lending", "unknown"])

const NATURE_HAS_LABELS = new Set(["expense", "income", "investment", "lending", "transfer"])

const NATURE_OPTIONS = [
  { value: "expense",    label: "Expense" },
  { value: "income",     label: "Income" },
  { value: "investment", label: "Investment" },
  { value: "transfer",   label: "Transfer" },
  { value: "lending",    label: "Lending" },
  { value: "unknown",    label: "Unknown" },
]

function NatureBadge({ nature }: { nature: string | null }) {
  const s = NATURE_BADGE[nature ?? "unknown"] ?? NATURE_BADGE.unknown
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: "nowrap", textTransform: "capitalize", letterSpacing: "0.02em",
    }}>
      {nature ?? "unknown"}
    </span>
  )
}

// ── Shared select/input style ──────────────────────────────────────────────
const editInp: React.CSSProperties = {
  padding: "6px 10px", borderRadius: 7, border: "1px solid #30363d",
  fontSize: 12, background: "#0d1117", color: "#e6edf3",
  fontFamily: "'Outfit', sans-serif", outline: "none",
}

export default function Reconcile() {
  const queryClient = useQueryClient()
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [noteValue, setNoteValue]     = useState("")
  const [labelValue, setLabelValue]   = useState<string>("")
  const [natureValue, setNatureValue] = useState<string>("")

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: getJobs,
  })

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => getTransactions(),
  })

  const { data: labels = [] } = useQuery({
    queryKey: ["labels"],
    queryFn: getLabels,
  })

  const labelMap = Object.fromEntries(labels.map(l => [l.id, l]))

  const updateMutation = useMutation({
    mutationFn: ({ id, update }: { id: string; update: Parameters<typeof updateTransaction>[1] }) =>
      updateTransaction(id, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      setEditingId(null)
    },
  })

  const finalizeMutation = useMutation({
    mutationFn: (jobId: string) => finalizeJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
  })

  const activeJobs    = jobs.filter(j => j.status === "done")
  const finalizedJobs = jobs.filter(j => j.status === "finalized")

  function txnsForJob(jobId: string) {
    return transactions.filter(t => t.upload_job_id === jobId)
  }

  function pendingCount(jobId: string) {
    return txnsForJob(jobId).filter(t => t.review_status === "pending").length
  }

  function setStatus(txn: Transaction, status: ReviewStatus) {
    updateMutation.mutate({ id: txn.id, update: { review_status: status } })
  }

  const NO_LABEL_NATURES = new Set(["unknown"])

  function saveNote(txn: Transaction) {
    const resolvedNature = natureValue || txn.financial_nature || ""
    const update: Parameters<typeof updateTransaction>[1] = {
      user_note: noteValue,
      review_status: "edited",
    }
    if (natureValue && natureValue !== txn.financial_nature) {
      update.financial_nature = natureValue as any
    }
    if (NO_LABEL_NATURES.has(resolvedNature)) {
      update.clear_label = true
    } else if (labelValue && labelValue !== txn.label_id) {
      update.label_id = labelValue
    } else if (!labelValue && txn.label_id) {
      update.clear_label = true
    }
    updateMutation.mutate({ id: txn.id, update })
  }

  function approveAll(jobId: string) {
    txnsForJob(jobId)
      .filter(t => t.review_status === "pending")
      .forEach(t => updateMutation.mutate({ id: t.id, update: { review_status: "approved" } }))
  }

  if (jobsLoading) return (
    <div style={{ padding: "36px 40px", fontSize: 13, color: "#656d76" }}>Loading…</div>
  )

  return (
    <div style={{ padding: "36px 40px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4, color: "#e6edf3" }}>
        Reconcile
      </h1>
      <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 32 }}>
        Review and finalize each imported statement. Finalized statements are locked and used in reports.
      </p>

      {activeJobs.length === 0 && finalizedJobs.length === 0 && (
        <div style={{
          padding: "40px 24px", borderRadius: 12, border: "1px dashed #30363d",
          background: "#161b22", textAlign: "center", fontSize: 13, color: "#656d76",
        }}>
          No statements imported yet. Go to Import to upload one.
        </div>
      )}

      {/* ── Active jobs ── */}
      {activeJobs.map(job => {
        const txns    = txnsForJob(job.job_id)
        const pending = pendingCount(job.job_id)
        const isOpen  = expandedJob === job.job_id
        const canFinalize = pending === 0 && txns.length > 0

        return (
          <div key={job.job_id} style={{
            border: "1px solid #30363d",
            borderRadius: 12,
            marginBottom: 14,
            overflow: "hidden",
            background: "#161b22",
          }}>
            {/* Job header */}
            <div
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 20px", cursor: "pointer",
                background: isOpen ? "#1c2128" : "#161b22",
                transition: "background 0.1s",
              }}
              onClick={() => setExpandedJob(isOpen ? null : job.job_id)}
            >
              {/* Chevron */}
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="#484f58" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink: 0, transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
              >
                <polyline points="9 18 15 12 9 6"/>
              </svg>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#e6edf3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {job.filename}
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 11, color: "#656d76", fontFamily: "'JetBrains Mono', monospace" }}>
                  {job.transaction_count} transactions
                  {job.duplicate_count ? ` · ${job.duplicate_count} duplicates` : ""}
                  {" · "}{new Date(job.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>

              {pending > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99,
                  background: "#1c1508", color: "#e3b341", border: "1px solid #3d2e08",
                  whiteSpace: "nowrap",
                }}>
                  {pending} pending
                </span>
              )}

              {canFinalize && (
                <button
                  onClick={(e) => { e.stopPropagation(); finalizeMutation.mutate(job.job_id) }}
                  disabled={finalizeMutation.isPending}
                  style={{
                    padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", border: "1px solid #388bfd",
                    background: "#1f6feb", color: "#fff",
                    opacity: finalizeMutation.isPending ? 0.6 : 1,
                    whiteSpace: "nowrap", transition: "opacity 0.15s",
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  {finalizeMutation.isPending ? "Finalizing…" : "Finalize statement"}
                </button>
              )}
            </div>

            {/* Transaction table */}
            {isOpen && (
              <div style={{ borderTop: "1px solid #30363d" }}>

                {/* Bulk actions bar */}
                {pending > 0 && (
                  <div style={{
                    padding: "10px 20px", background: "#1c2128",
                    display: "flex", gap: 8, alignItems: "center",
                    borderBottom: "1px solid #21262d",
                  }}>
                    <span style={{ fontSize: 12, color: "#8b949e", flex: 1, fontWeight: 500 }}>
                      {pending} transactions pending review
                    </span>
                    <button onClick={() => approveAll(job.job_id)} style={{
                      padding: "4px 12px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                      border: "1px solid #1a4128", background: "#0e1c15",
                      color: "#56d364", cursor: "pointer", letterSpacing: "0.02em",
                      fontFamily: "'Outfit', sans-serif",
                    }}>✓ Approve all</button>
                    <button onClick={() =>
                      txnsForJob(job.job_id)
                        .filter(t => t.review_status === "pending")
                        .forEach(t => updateMutation.mutate({ id: t.id, update: { review_status: "ignored" } }))
                    } style={{
                      padding: "4px 12px", borderRadius: 99, fontSize: 11, fontWeight: 500,
                      border: "1px solid #30363d", background: "transparent",
                      color: "#8b949e", cursor: "pointer", fontFamily: "'Outfit', sans-serif",
                    }}>✕ Ignore all</button>
                  </div>
                )}

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#1c2128", borderBottom: "1px solid #21262d" }}>
                        {["Date", "Description", "Amount", "Nature", "Category", "Conf.", "Status", ""].map(h => (
                          <th key={h} style={{
                            padding: "10px 14px",
                            textAlign: h === "Amount" ? "right" : "left",
                            fontSize: 10, fontWeight: 600, color: "#656d76",
                            textTransform: "uppercase", letterSpacing: "0.06em",
                            whiteSpace: "nowrap",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {txns.map(txn => {
                        const sb       = STATUS_BADGE[txn.review_status] ?? STATUS_BADGE.pending
                        const isEditing = editingId === txn.id
                        const label    = txn.label_id ? labelMap[txn.label_id] : null
                        const conf     = txn.category_confidence
                        const isDebit  = txn.transaction_type === "debit"

                        return (
                          <React.Fragment key={txn.id}>
                            {/* Warning row for excluded natures */}
                            {txn.financial_nature && EXCLUDED_NATURES.has(txn.financial_nature) && txn.review_status !== "ignored" && (
                              <tr>
                                <td colSpan={8} style={{
                                  padding: "4px 14px",
                                  background: "#1c1508",
                                  borderBottom: "1px solid #3d2e08",
                                }}>
                                  <span style={{ fontSize: 11, color: "#e3b341", fontWeight: 500 }}>
                                    ⚠ {txn.financial_nature === "transfer"
                                      ? "Transfer — excluded from reports. Assign a label (e.g. CC payment) for your records."
                                      : `${txn.financial_nature} — not counted in spend or income reports`}
                                  </span>
                                </td>
                              </tr>
                            )}

                            {/* Main transaction row */}
                            <tr style={{
                              borderBottom: "1px solid #21262d",
                              opacity: txn.review_status === "ignored" ? 0.38 : 1,
                              background: txn.is_duplicate ? "#1c1508" : "transparent",
                            }}>
                              <td style={{ padding: "11px 14px", whiteSpace: "nowrap", color: "#656d76", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                                {txn.date}
                              </td>
                              <td style={{ padding: "11px 14px", maxWidth: 260 }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#e6edf3" }}>
                                  {txn.description}
                                </p>
                                {txn.is_duplicate && (
                                  <span style={{
                                    fontSize: 10, fontWeight: 600, color: "#e3b341",
                                    background: "#1c1508", padding: "1px 6px", borderRadius: 4,
                                    border: "1px solid #3d2e08",
                                  }}>
                                    duplicate
                                  </span>
                                )}
                                {txn.user_note && (
                                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#656d76", fontStyle: "italic" }}>
                                    {txn.user_note}
                                  </p>
                                )}
                              </td>
                              <td style={{ padding: "11px 14px", whiteSpace: "nowrap", textAlign: "right" }}>
                                <span style={{
                                  fontSize: 13, fontWeight: 700,
                                  fontFamily: "'JetBrains Mono', monospace",
                                  letterSpacing: "-0.02em",
                                  color: isDebit ? "#f85149" : "#3fb950",
                                }}>
                                  {isDebit ? "−" : "+"}₹{txn.amount.toLocaleString("en-IN")}
                                </span>
                              </td>
                              <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                                <NatureBadge nature={txn.financial_nature} />
                              </td>
                              <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                                {label ? (
                                  <span style={{
                                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                                    background: label.color ? `${label.color}20` : "#21262d",
                                    color: label.color ?? "#8b949e",
                                    border: `1px solid ${label.color ? `${label.color}40` : "#30363d"}`,
                                  }}>
                                    {label.name}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 11, color: "#484f58" }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                                {conf != null ? (
                                  <span style={{
                                    fontSize: 12, fontWeight: 600,
                                    fontFamily: "'JetBrains Mono', monospace",
                                    color: conf >= 0.9 ? "#3fb950" : conf >= 0.75 ? "#e3b341" : "#f85149",
                                  }}>
                                    {Math.round(conf * 100)}%
                                  </span>
                                ) : <span style={{ fontSize: 11, color: "#484f58" }}>—</span>}
                              </td>
                              <td style={{ padding: "11px 14px" }}>
                                <span style={{
                                  fontSize: 10, fontWeight: 600, padding: "2px 8px",
                                  borderRadius: 99, background: sb.bg, color: sb.color,
                                  border: `1px solid ${sb.border}`,
                                  textTransform: "capitalize", letterSpacing: "0.02em",
                                }}>
                                  {txn.review_status}
                                </span>
                              </td>
                              <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                                <div style={{ display: "flex", gap: 5 }}>
                                  {txn.review_status !== "approved" && (
                                    <ActionBtn icon="✓" title="Approve" color="#3fb950" bg="#0e1c15" border="#1a4128" onClick={() => setStatus(txn, "approved")} />
                                  )}
                                  {txn.review_status !== "ignored" && (
                                    <ActionBtn icon="✕" title="Ignore" color="#8b949e" bg="#21262d" border="#30363d" onClick={() => setStatus(txn, "ignored")} />
                                  )}
                                  <ActionBtn
                                    icon="✎" title="Edit" color="#79c0ff" bg="#0c1f2e" border="#1a3956"
                                    onClick={() => {
                                      setEditingId(isEditing ? null : txn.id)
                                      setNoteValue(txn.user_note ?? "")
                                      setLabelValue(txn.label_id ?? "")
                                      setNatureValue(txn.financial_nature ?? "")
                                    }}
                                  />
                                </div>
                              </td>
                            </tr>

                            {/* Inline edit row */}
                            {isEditing && (
                              <tr style={{ background: "#0c1f2e" }}>
                                <td colSpan={8} style={{ padding: "12px 14px" }}>
                                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                    <select
                                      value={natureValue}
                                      onChange={e => { setNatureValue(e.target.value); setLabelValue("") }}
                                      style={{ ...editInp, minWidth: 140 }}
                                    >
                                      <option value="">— nature —</option>
                                      {NATURE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>

                                    {(!natureValue || NATURE_HAS_LABELS.has(natureValue)) && (
                                      <select
                                        value={labelValue}
                                        onChange={e => setLabelValue(e.target.value)}
                                        style={{ ...editInp, minWidth: 160 }}
                                      >
                                        <option value="">— category —</option>
                                        {labels
                                          .filter(l => !natureValue || l.nature === natureValue)
                                          .map(l => <option key={l.id} value={l.id}>{l.name}</option>)
                                        }
                                      </select>
                                    )}
                                    {natureValue && !NATURE_HAS_LABELS.has(natureValue) && (
                                      <span style={{ fontSize: 12, color: "#656d76", fontStyle: "italic" }}>No labels for {natureValue}</span>
                                    )}

                                    <input
                                      autoFocus type="text" placeholder="Add a note… (optional)"
                                      value={noteValue} onChange={e => setNoteValue(e.target.value)}
                                      onKeyDown={e => e.key === "Enter" && saveNote(txn)}
                                      style={{ ...editInp, flex: 1, minWidth: 180 }}
                                    />

                                    <button
                                      onClick={() => saveNote(txn)}
                                      style={{
                                        padding: "6px 16px", borderRadius: 7, border: "1px solid #388bfd",
                                        background: "#1f6feb", color: "#fff", fontSize: 12,
                                        fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit', sans-serif",
                                      }}
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingId(null)}
                                      style={{
                                        padding: "6px 14px", borderRadius: 7,
                                        border: "1px solid #30363d", background: "#21262d",
                                        fontSize: 12, fontWeight: 500, cursor: "pointer",
                                        color: "#8b949e", fontFamily: "'Outfit', sans-serif",
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* ── Finalized jobs ── */}
      {finalizedJobs.length > 0 && (
        <div style={{ marginTop: 36 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#656d76", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>
            Finalized statements
          </p>
          {finalizedJobs.map(job => (
            <div key={job.job_id} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "13px 20px",
              border: "1px solid #30363d", borderRadius: 10,
              marginBottom: 8, background: "#161b22",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#8b949e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {job.filename}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#656d76", fontFamily: "'JetBrains Mono', monospace" }}>
                  {job.transaction_count} transactions · finalized{" "}
                  {job.finalized_at
                    ? new Date(job.finalized_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    : ""}
                </p>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 99,
                background: "#1a0e2e", color: "#d2a8ff", border: "1px solid #3d1f6d",
                textTransform: "uppercase", letterSpacing: "0.04em",
              }}>
                Finalized
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ActionBtn({ icon, title, color, bg, border, onClick }: {
  icon: string; title: string; color: string; bg: string; border: string; onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 28, height: 28, borderRadius: 7,
        border: `1px solid ${hov ? border : "#30363d"}`,
        background: hov ? bg : "transparent",
        cursor: "pointer", color, fontSize: 13,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.1s, border-color 0.1s",
      }}
    >
      {icon}
    </button>
  )
}
