import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getTransactions, getLabels, getJobs, updateTransaction, finalizeJob } from "../api/client"
import type { Transaction, ReviewStatus } from "../types"

// ── Badge configs ──────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  pending:   { bg: "#FEFCE8", color: "#92400E", border: "#FDE68A" },
  approved:  { bg: "#EDFAF3", color: "#166534", border: "#A7E9CB" },
  edited:    { bg: "#EFF4FE", color: "#1E40AF", border: "#BDD0F7" },
  ignored:   { bg: "#F5F4F2", color: "#8A8780", border: "#E6E4DC" },
  finalized: { bg: "#F5F3FF", color: "#5B21B6", border: "#DDD6FE" },
}

const NATURE_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  expense:    { bg: "#FEF0EF", color: "#991B1B", border: "#F9C8C6" },
  income:     { bg: "#EDFAF3", color: "#166534", border: "#A7E9CB" },
  transfer:   { bg: "#F5F4F2", color: "#5A5855", border: "#E6E4DC" },
  investment: { bg: "#EFF4FE", color: "#1E40AF", border: "#BDD0F7" },
  lending:    { bg: "#FEFCE8", color: "#92400E", border: "#FDE68A" },
  unknown:    { bg: "#F5F4F2", color: "#8A8780", border: "#E6E4DC" },
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
  padding: "6px 10px", borderRadius: 7, border: "1px solid #E6E4DC",
  fontSize: 12, background: "#FFFFFF", color: "#1A1916",
  fontFamily: "'Manrope', sans-serif", outline: "none",
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
    <div style={{ padding: "36px 40px", fontSize: 13, color: "#A8A5A0" }}>Loading…</div>
  )

  return (
    <div style={{ padding: "36px 40px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
        Reconcile
      </h1>
      <p style={{ fontSize: 13, color: "#6B6862", marginBottom: 32 }}>
        Review and finalize each imported statement. Finalized statements are locked and used in reports.
      </p>

      {activeJobs.length === 0 && finalizedJobs.length === 0 && (
        <div style={{
          padding: "40px 24px", borderRadius: 12, border: "1px dashed #D0CEC8",
          background: "#FAFAF8", textAlign: "center", fontSize: 13, color: "#A8A5A0",
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
            border: "1px solid #E6E4DC",
            borderRadius: 12,
            marginBottom: 14,
            overflow: "hidden",
            background: "#FFFFFF",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            {/* Job header */}
            <div
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 20px", cursor: "pointer",
                background: isOpen ? "#FAFAF8" : "#FFFFFF",
                transition: "background 0.1s",
              }}
              onClick={() => setExpandedJob(isOpen ? null : job.job_id)}
            >
              {/* Chevron */}
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="#C8C5BE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink: 0, transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
              >
                <polyline points="9 18 15 12 9 6"/>
              </svg>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#1A1916", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {job.filename}
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 11, color: "#A8A5A0", fontFamily: "'JetBrains Mono', monospace" }}>
                  {job.transaction_count} transactions
                  {job.duplicate_count ? ` · ${job.duplicate_count} duplicates` : ""}
                  {" · "}{new Date(job.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>

              {pending > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99,
                  background: "#FEFCE8", color: "#92400E", border: "1px solid #FDE68A",
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
                    cursor: "pointer", border: "none",
                    background: "#1A1916", color: "#fff",
                    opacity: finalizeMutation.isPending ? 0.6 : 1,
                    whiteSpace: "nowrap", transition: "opacity 0.15s",
                    fontFamily: "'Manrope', sans-serif",
                  }}
                >
                  {finalizeMutation.isPending ? "Finalizing…" : "Finalize statement"}
                </button>
              )}
            </div>

            {/* Transaction table */}
            {isOpen && (
              <div style={{ borderTop: "1px solid #E6E4DC" }}>

                {/* Bulk actions bar */}
                {pending > 0 && (
                  <div style={{
                    padding: "10px 20px", background: "#FAFAF8",
                    display: "flex", gap: 8, alignItems: "center",
                    borderBottom: "1px solid #F0EEE8",
                  }}>
                    <span style={{ fontSize: 12, color: "#8A8780", flex: 1, fontWeight: 500 }}>
                      {pending} transactions pending review
                    </span>
                    <button onClick={() => approveAll(job.job_id)} style={{
                      padding: "4px 12px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                      border: "1px solid #A7E9CB", background: "#EDFAF3",
                      color: "#166534", cursor: "pointer", letterSpacing: "0.02em",
                    }}>✓ Approve all</button>
                    <button onClick={() =>
                      txnsForJob(job.job_id)
                        .filter(t => t.review_status === "pending")
                        .forEach(t => updateMutation.mutate({ id: t.id, update: { review_status: "ignored" } }))
                    } style={{
                      padding: "4px 12px", borderRadius: 99, fontSize: 11, fontWeight: 500,
                      border: "1px solid #E6E4DC", background: "transparent",
                      color: "#8A8780", cursor: "pointer",
                    }}>✕ Ignore all</button>
                  </div>
                )}

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#FAFAF8", borderBottom: "1px solid #E6E4DC" }}>
                        {["Date", "Description", "Amount", "Nature", "Category", "Conf.", "Status", ""].map(h => (
                          <th key={h} style={{
                            padding: "10px 14px",
                            textAlign: h === "Amount" ? "right" : "left",
                            fontSize: 10, fontWeight: 600, color: "#A8A5A0",
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
                                  background: "#FEFCE8",
                                  borderBottom: "1px solid #FDE68A",
                                }}>
                                  <span style={{ fontSize: 11, color: "#92400E", fontWeight: 500 }}>
                                    ⚠ {txn.financial_nature === "transfer"
                                      ? "Transfer — excluded from reports. Assign a label (e.g. CC payment) for your records."
                                      : `${txn.financial_nature} — not counted in spend or income reports`}
                                  </span>
                                </td>
                              </tr>
                            )}

                            {/* Main transaction row */}
                            <tr style={{
                              borderBottom: "1px solid #F7F5F0",
                              opacity: txn.review_status === "ignored" ? 0.38 : 1,
                              background: txn.is_duplicate ? "#FFFBEB" : "transparent",
                            }}>
                              <td style={{ padding: "11px 14px", whiteSpace: "nowrap", color: "#8A8780", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                                {txn.date}
                              </td>
                              <td style={{ padding: "11px 14px", maxWidth: 260 }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1A1916" }}>
                                  {txn.description}
                                </p>
                                {txn.is_duplicate && (
                                  <span style={{
                                    fontSize: 10, fontWeight: 600, color: "#92400E",
                                    background: "#FEFCE8", padding: "1px 6px", borderRadius: 4,
                                    border: "1px solid #FDE68A",
                                  }}>
                                    duplicate
                                  </span>
                                )}
                                {txn.user_note && (
                                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#A8A5A0", fontStyle: "italic" }}>
                                    {txn.user_note}
                                  </p>
                                )}
                              </td>
                              <td style={{ padding: "11px 14px", whiteSpace: "nowrap", textAlign: "right" }}>
                                <span style={{
                                  fontSize: 13, fontWeight: 700,
                                  fontFamily: "'JetBrains Mono', monospace",
                                  letterSpacing: "-0.02em",
                                  color: isDebit ? "#D94B45" : "#18A96B",
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
                                    background: label.color ? `${label.color}18` : "#F5F4F2",
                                    color: label.color ?? "#5A5855",
                                    border: `1px solid ${label.color ? `${label.color}40` : "#E6E4DC"}`,
                                  }}>
                                    {label.name}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 11, color: "#D0CEC8" }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                                {conf != null ? (
                                  <span style={{
                                    fontSize: 12, fontWeight: 600,
                                    fontFamily: "'JetBrains Mono', monospace",
                                    color: conf >= 0.9 ? "#166534" : conf >= 0.75 ? "#92400E" : "#991B1B",
                                  }}>
                                    {Math.round(conf * 100)}%
                                  </span>
                                ) : <span style={{ fontSize: 11, color: "#D0CEC8" }}>—</span>}
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
                                    <ActionBtn icon="✓" title="Approve" color="#166534" bg="#EDFAF3" border="#A7E9CB" onClick={() => setStatus(txn, "approved")} />
                                  )}
                                  {txn.review_status !== "ignored" && (
                                    <ActionBtn icon="✕" title="Ignore" color="#8A8780" bg="#F5F4F2" border="#E6E4DC" onClick={() => setStatus(txn, "ignored")} />
                                  )}
                                  <ActionBtn
                                    icon="✎" title="Edit" color="#1E40AF" bg="#EFF4FE" border="#BDD0F7"
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
                              <tr style={{ background: "#F5F8FE" }}>
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
                                      <span style={{ fontSize: 12, color: "#A8A5A0", fontStyle: "italic" }}>No labels for {natureValue}</span>
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
                                        padding: "6px 16px", borderRadius: 7, border: "none",
                                        background: "#1A1916", color: "#fff", fontSize: 12,
                                        fontWeight: 600, cursor: "pointer", fontFamily: "'Manrope', sans-serif",
                                      }}
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingId(null)}
                                      style={{
                                        padding: "6px 14px", borderRadius: 7,
                                        border: "1px solid #E6E4DC", background: "#FFFFFF",
                                        fontSize: 12, fontWeight: 500, cursor: "pointer",
                                        color: "#6B6862", fontFamily: "'Manrope', sans-serif",
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
          <p style={{ fontSize: 11, fontWeight: 600, color: "#A8A5A0", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>
            Finalized statements
          </p>
          {finalizedJobs.map(job => (
            <div key={job.job_id} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "13px 20px",
              border: "1px solid #E6E4DC", borderRadius: 10,
              marginBottom: 8, background: "#FAFAF8",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#6B6862", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {job.filename}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#A8A5A0", fontFamily: "'JetBrains Mono', monospace" }}>
                  {job.transaction_count} transactions · finalized{" "}
                  {job.finalized_at
                    ? new Date(job.finalized_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    : ""}
                </p>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 99,
                background: "#F5F3FF", color: "#5B21B6", border: "1px solid #DDD6FE",
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
        border: `1px solid ${hov ? border : "#E6E4DC"}`,
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
