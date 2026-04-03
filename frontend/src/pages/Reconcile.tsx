import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getTransactions, getLabels, getJobs, updateTransaction, finalizeJob } from "../api/client"
import type { Transaction, ReviewStatus } from "../types"

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:   { bg: "#FAEEDA", color: "#633806" },
  approved:  { bg: "#EAF3DE", color: "#27500A" },
  edited:    { bg: "#E6F1FB", color: "#0C447C" },
  ignored:   { bg: "#F1EFE8", color: "#444441" },
  finalized: { bg: "#EEEDFE", color: "#3C3489" },
}

// natures that are excluded from reports — rows get dimmed warning
const EXCLUDED_NATURES = new Set(["transfer", "lending", "unknown"])

const NATURE_COLORS: Record<string, { bg: string; color: string }> = {
  expense:    { bg: "#FCEBEB", color: "#791F1F" },
  income:     { bg: "#EAF3DE", color: "#27500A" },
  transfer:   { bg: "#F1EFE8", color: "#5F5E5A" },
  investment: { bg: "#E6F1FB", color: "#0C447C" },
  lending:    { bg: "#FAEEDA", color: "#633806" },
  unknown:    { bg: "#F1EFE8", color: "#444441" },
}

// which natures have labels
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
  const s = NATURE_COLORS[nature ?? "unknown"] ?? NATURE_COLORS.unknown
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 99, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
      {nature ?? "unknown"}
    </span>
  )
}

export default function Reconcile() {
  const queryClient = useQueryClient()
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [noteValue, setNoteValue]   = useState("")
  const [labelValue, setLabelValue] = useState<string>("")
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

  // only show jobs that are done (not finalized, not failed)
  const activeJobs = jobs.filter(j => j.status === "done")
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

  const NO_LABEL_NATURES = new Set(["unknown"])  // transfer CAN have labels (cc_payment, self_transfer, returns)

  function saveNote(txn: Transaction) {
    const resolvedNature = natureValue || txn.financial_nature || ""
    const update: Parameters<typeof updateTransaction>[1] = {
      user_note: noteValue,
      review_status: "edited",
    }
    if (natureValue && natureValue !== txn.financial_nature) {
      update.financial_nature = natureValue as any
    }
    // clear label if nature doesn't support labels, or if user explicitly cleared it
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

  if (jobsLoading) return <div style={{ padding: "2rem", color: "#888780" }}>Loading…</div>

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "2rem 2rem" }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, margin: "0 0 6px" }}>Reconcile</h1>
      <p style={{ fontSize: 14, color: "#888780", margin: "0 0 28px" }}>
        Review and finalize each imported statement.
        Finalized statements are locked and used in reports.
      </p>

      {/* active jobs — need review */}
      {activeJobs.length === 0 && finalizedJobs.length === 0 && (
        <p style={{ fontSize: 13, color: "#888780" }}>
          No statements imported yet. Go to Import to upload one.
        </p>
      )}

      {activeJobs.map(job => {
        const txns    = txnsForJob(job.job_id)
        const pending = pendingCount(job.job_id)
        const isOpen  = expandedJob === job.job_id
        const canFinalize = pending === 0 && txns.length > 0

        return (
          <div key={job.job_id} style={{
            border: "0.5px solid #d3d1c7",
            borderRadius: 12,
            marginBottom: 16,
            overflow: "hidden",
          }}>
            {/* job header */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 18px",
              background: "#fff",
              cursor: "pointer",
            }} onClick={() => setExpandedJob(isOpen ? null : job.job_id)}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 500, fontSize: 14 }}>{job.filename}</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#888780" }}>
                  {job.transaction_count} transactions
                  {job.duplicate_count ? ` · ${job.duplicate_count} duplicates` : ""}
                  {" · "}
                  {new Date(job.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>

              {/* pending badge */}
              {pending > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: "2px 10px",
                  borderRadius: 99, background: "#FAEEDA", color: "#633806",
                }}>
                  {pending} pending
                </span>
              )}

              {/* finalize button */}
              {canFinalize && (
                <button
                  onClick={(e) => { e.stopPropagation(); finalizeMutation.mutate(job.job_id) }}
                  disabled={finalizeMutation.isPending}
                  style={{
                    padding: "6px 16px", borderRadius: 8, fontSize: 12,
                    fontWeight: 500, cursor: "pointer", border: "none",
                    background: "#1a1a18", color: "#fff",
                    opacity: finalizeMutation.isPending ? 0.6 : 1,
                  }}
                >
                  {finalizeMutation.isPending ? "Finalizing…" : "Finalize statement"}
                </button>
              )}

              <span style={{ color: "#888780", fontSize: 14 }}>{isOpen ? "▲" : "▼"}</span>
            </div>

            {/* transaction table */}
            {isOpen && (
              <div style={{ borderTop: "0.5px solid #f1efe8" }}>
                {/* bulk actions */}
                {pending > 0 && (
                  <div style={{
                    padding: "10px 18px", background: "#f9f8f5",
                    display: "flex", gap: 8, alignItems: "center",
                    borderBottom: "0.5px solid #f1efe8",
                  }}>
                    <span style={{ fontSize: 12, color: "#888780", flex: 1 }}>
                      {pending} transactions pending review
                    </span>
                    <button onClick={() => approveAll(job.job_id)} style={{
                      padding: "4px 12px", borderRadius: 99, fontSize: 12,
                      border: "0.5px solid #085041", background: "#E1F5EE",
                      color: "#085041", cursor: "pointer", fontWeight: 500,
                    }}>✓ Approve all</button>
                    <button onClick={() => txnsForJob(job.job_id)
                      .filter(t => t.review_status === "pending")
                      .forEach(t => updateMutation.mutate({ id: t.id, update: { review_status: "ignored" } }))
                    } style={{
                      padding: "4px 12px", borderRadius: 99, fontSize: 12,
                      border: "0.5px solid #d3d1c7", background: "transparent",
                      color: "#888780", cursor: "pointer",
                    }}>✕ Ignore all</button>
                  </div>
                )}

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ borderBottom: "0.5px solid #d3d1c7" }}>
                        {["Date", "Description", "Amount", "Nature", "Category", "Conf.", "Status", "Actions"].map(h => (
                          <th key={h} style={{
                            padding: "10px 12px", textAlign: "left",
                            fontWeight: 500, color: "#888780", whiteSpace: "nowrap",
                            fontSize: 13,
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {txns.map(txn => {
                        const s         = STATUS_COLORS[txn.review_status] ?? STATUS_COLORS.pending
                        const isEditing = editingId === txn.id
                        const label     = txn.label_id ? labelMap[txn.label_id] : null
                        const conf      = txn.category_confidence

                        return (
                          <React.Fragment key={txn.id}>
                            {/* highlight rows whose nature is excluded from reports */}
                            {txn.financial_nature && EXCLUDED_NATURES.has(txn.financial_nature) && txn.review_status !== "ignored" && (
                              <tr>
                                <td colSpan={8} style={{ padding: "2px 12px", background: "#F1EFE8", borderBottom: "0.5px solid #d3d1c7" }}>
                                  <span style={{ fontSize: 11, color: "#5F5E5A" }}>
                                    ⚠ {txn.financial_nature === "transfer"
                                      ? "Transfer — excluded from spend/income reports. Assign a label (e.g. Credit card bill payment) for your records."
                                      : `This transaction (${txn.financial_nature}) will not be counted in spend or income reports`}
                                  </span>
                                </td>
                              </tr>
                            )}
                            <tr style={{
                              borderBottom: "0.5px solid #f1efe8",
                              opacity: txn.review_status === "ignored" ? 0.45 : 1,
                              background: txn.is_duplicate ? "#FAEEDA11" : "transparent",
                            }}>
                              <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#888780" }}>
                                {txn.date}
                              </td>
                              <td style={{ padding: "10px 12px", maxWidth: 260 }}>
                                <p style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {txn.description}
                                </p>
                                {txn.is_duplicate && (
                                  <span style={{ fontSize: 10, color: "#854F0B", background: "#FAEEDA", padding: "1px 5px", borderRadius: 4 }}>
                                    duplicate
                                  </span>
                                )}
                                {txn.user_note && (
                                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#888780", fontStyle: "italic" }}>
                                    {txn.user_note}
                                  </p>
                                )}
                              </td>
                              <td style={{
                                padding: "10px 12px", whiteSpace: "nowrap", fontWeight: 500,
                                color: txn.transaction_type === "credit" ? "#085041" : "#1a1a18",
                              }}>
                                {txn.transaction_type === "credit" ? "+" : "−"} ₹{txn.amount.toLocaleString("en-IN")}
                              </td>
                              <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                                <NatureBadge nature={txn.financial_nature} />
                              </td>
                              <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                                {label ? (
                                  <span style={{
                                    fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 99,
                                    background: label.color ? `${label.color}22` : "#f1efe8",
                                    color: label.color ?? "#444441",
                                    border: `0.5px solid ${label.color ?? "#d3d1c7"}`,
                                  }}>{label.name}</span>
                                ) : <span style={{ fontSize: 11, color: "#d3d1c7" }}>—</span>}
                              </td>
                              <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                                {conf != null ? (
                                  <span style={{
                                    fontSize: 11,
                                    color: conf >= 0.9 ? "#085041" : conf >= 0.75 ? "#633806" : "#791F1F",
                                  }}>{Math.round(conf * 100)}%</span>
                                ) : <span style={{ fontSize: 11, color: "#d3d1c7" }}>—</span>}
                              </td>
                              <td style={{ padding: "10px 12px" }}>
                                <span style={{
                                  fontSize: 11, fontWeight: 500, padding: "2px 8px",
                                  borderRadius: 99, background: s.bg, color: s.color,
                                }}>{txn.review_status}</span>
                              </td>
                              <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                                <div style={{ display: "flex", gap: 6 }}>
                                  {txn.review_status !== "approved" && (
                                    <ActionBtn label="✓" color="#085041" onClick={() => setStatus(txn, "approved")} />
                                  )}
                                  {txn.review_status !== "ignored" && (
                                    <ActionBtn label="✕" color="#888780" onClick={() => setStatus(txn, "ignored")} />
                                  )}
                                  <ActionBtn label="✎" color="#0C447C" onClick={() => {
                                    setEditingId(isEditing ? null : txn.id)
                                    setNoteValue(txn.user_note ?? "")
                                    setLabelValue(txn.label_id ?? "")
                                    setNatureValue(txn.financial_nature ?? "")
                                  }} />
                                </div>
                              </td>
                            </tr>
                            {isEditing && (
                              <tr style={{ background: "#E6F1FB11" }}>
                                <td colSpan={8} style={{ padding: "10px 12px" }}>
                                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                    {/* nature dropdown */}
                                    <select value={natureValue} onChange={e => {
                                      setNatureValue(e.target.value)
                                      setLabelValue("")
                                    }}
                                      style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid #d3d1c7", fontSize: 13, background: "transparent", color: "inherit", minWidth: 140 }}>
                                      <option value="">— nature —</option>
                                      {NATURE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                    {/* category dropdown — only shown when nature supports labels */}
                                    {(!natureValue || NATURE_HAS_LABELS.has(natureValue)) && (
                                      <select value={labelValue} onChange={e => setLabelValue(e.target.value)}
                                        style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid #d3d1c7", fontSize: 13, background: "transparent", color: "inherit", minWidth: 160 }}>
                                        <option value="">— category —</option>
                                        {labels
                                          .filter(l => !natureValue || l.nature === natureValue)
                                          .map(l => <option key={l.id} value={l.id}>{l.name}</option>)
                                        }
                                      </select>
                                    )}
                                    {natureValue && !NATURE_HAS_LABELS.has(natureValue) && (
                                      <span style={{ fontSize: 12, color: "#b4b2a9", fontStyle: "italic" }}>No labels for {natureValue}</span>
                                    )}
                                    {/* note input */}
                                    <input autoFocus type="text" placeholder="Add a note… (optional)"
                                      value={noteValue} onChange={e => setNoteValue(e.target.value)}
                                      onKeyDown={e => e.key === "Enter" && saveNote(txn)}
                                      style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "0.5px solid #d3d1c7", fontSize: 13, background: "transparent", color: "inherit", minWidth: 160 }} />
                                    <button onClick={() => saveNote(txn)} style={saveBtnStyle}>Save</button>
                                    <button onClick={() => setEditingId(null)} style={cancelBtnStyle}>Cancel</button>
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

      {/* finalized jobs — collapsed, read-only */}
      {finalizedJobs.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "#888780", margin: "0 0 10px" }}>
            Finalized statements
          </p>
          {finalizedJobs.map(job => (
            <div key={job.job_id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 18px",
              border: "0.5px solid #d3d1c7", borderRadius: 10,
              marginBottom: 8, background: "#fafaf8",
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#888780" }}>
                  {job.filename}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#b4b2a9" }}>
                  {job.transaction_count} transactions · finalized{" "}
                  {job.finalized_at
                    ? new Date(job.finalized_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    : ""}
                </p>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 500, padding: "2px 10px",
                borderRadius: 99, background: "#EEEDFE", color: "#3C3489",
              }}>finalized</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: 28, height: 28, borderRadius: 6,
      border: "0.5px solid #d3d1c7", background: "transparent",
      cursor: "pointer", color, fontSize: 14,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>{label}</button>
  )
}

const saveBtnStyle: React.CSSProperties = {
  padding: "6px 14px", borderRadius: 6, border: "none",
  background: "#1a1a18", color: "#fff", fontSize: 12, cursor: "pointer",
}
const cancelBtnStyle: React.CSSProperties = {
  padding: "6px 14px", borderRadius: 6,
  border: "0.5px solid #d3d1c7", background: "transparent",
  fontSize: 12, cursor: "pointer", color: "inherit",
}
