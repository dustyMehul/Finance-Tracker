import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getTransactions, getLabels, updateTransaction } from "../api/client"
import type { Transaction, ReviewStatus } from "../types"

const STATUS_COLORS: Record<ReviewStatus, { bg: string; color: string }> = {
  pending:  { bg: "#FAEEDA", color: "#633806" },
  approved: { bg: "#EAF3DE", color: "#27500A" },
  edited:   { bg: "#E6F1FB", color: "#0C447C" },
  ignored:  { bg: "#F1EFE8", color: "#444441" },
}

export default function Reconcile() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<ReviewStatus | "all">("pending")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [noteValue, setNoteValue] = useState("")

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", filter],
    queryFn: () => getTransactions(
      filter === "all" ? undefined : { review_status: filter }
    ),
  })

  const { data: labels = [] } = useQuery({
    queryKey: ["labels"],
    queryFn: getLabels,
  })

  // build a quick id→label map
  const labelMap = Object.fromEntries(labels.map(l => [l.id, l]))

  const mutation = useMutation({
    mutationFn: ({ id, update }: { id: string; update: Parameters<typeof updateTransaction>[1] }) =>
      updateTransaction(id, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      setEditingId(null)
    },
  })

  function setStatus(txn: Transaction, status: ReviewStatus) {
    mutation.mutate({ id: txn.id, update: { review_status: status } })
  }

  function saveNote(txn: Transaction) {
    mutation.mutate({ id: txn.id, update: { user_note: noteValue, review_status: "edited" } })
  }

  // bulk actions — operate on currently visible transactions
  function approveAll() {
    transactions
      .filter(t => t.review_status === "pending")
      .forEach(t => mutation.mutate({ id: t.id, update: { review_status: "approved" } }))
  }

  function ignoreAll() {
    transactions
      .filter(t => t.review_status === "pending")
      .forEach(t => mutation.mutate({ id: t.id, update: { review_status: "ignored" } }))
  }

  const pending = transactions.filter(t => t.review_status === "pending").length
  const total   = transactions.length

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem 1rem" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>Reconcile</h1>
        {pending > 0 && (
          <span style={{ fontSize: 13, color: "#888780" }}>
            {pending} of {total} pending review
          </span>
        )}
      </div>

      {/* filter tabs + bulk actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {(["all", "pending", "approved", "edited", "ignored"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "5px 14px", borderRadius: 99,
              border: "0.5px solid",
              borderColor: filter === f ? "#1a1a18" : "#d3d1c7",
              background: filter === f ? "#1a1a18" : "transparent",
              color: filter === f ? "#fff" : "#888780",
              fontSize: 12, cursor: "pointer",
              fontWeight: filter === f ? 500 : 400,
            }}
          >{f}</button>
        ))}

        {/* bulk actions — only show when there are pending transactions visible */}
        {pending > 0 && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={approveAll} style={{
              padding: "5px 14px", borderRadius: 99, fontSize: 12, cursor: "pointer",
              border: "0.5px solid #085041", background: "#E1F5EE", color: "#085041", fontWeight: 500,
            }}>
              ✓ Approve all ({pending})
            </button>
            <button onClick={ignoreAll} style={{
              padding: "5px 14px", borderRadius: 99, fontSize: 12, cursor: "pointer",
              border: "0.5px solid #d3d1c7", background: "transparent", color: "#888780",
            }}>
              ✕ Ignore all
            </button>
          </div>
        )}
      </div>

      {isLoading && <p style={{ color: "#888780", fontSize: 13 }}>Loading…</p>}

      {!isLoading && transactions.length === 0 && (
        <p style={{ color: "#888780", fontSize: 13 }}>
          No transactions with status "{filter}".
        </p>
      )}

      {transactions.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid #d3d1c7" }}>
                {["Date", "Description", "Amount", "Category", "Confidence", "Status", "Actions"].map(h => (
                  <th key={h} style={{
                    padding: "8px 10px", textAlign: "left",
                    fontWeight: 500, color: "#888780", whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map(txn => {
                const s        = STATUS_COLORS[txn.review_status]
                const isEditing = editingId === txn.id
                const label    = txn.label_id ? labelMap[txn.label_id] : null
                const conf     = txn.category_confidence

                return (
                  <React.Fragment key={txn.id}>
                    <tr style={{
                      borderBottom: "0.5px solid #f1efe8",
                      opacity: txn.review_status === "ignored" ? 0.45 : 1,
                      background: txn.is_duplicate ? "#FAEEDA22" : "transparent",
                    }}>
                      <td style={{ padding: "10px 10px", whiteSpace: "nowrap", color: "#888780" }}>
                        {txn.date}
                      </td>
                      <td style={{ padding: "10px 10px", maxWidth: 260 }}>
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
                        padding: "10px 10px", whiteSpace: "nowrap", fontWeight: 500,
                        color: txn.transaction_type === "credit" ? "#085041" : "#1a1a18",
                      }}>
                        {txn.transaction_type === "credit" ? "+" : "−"} ₹{txn.amount.toLocaleString("en-IN")}
                      </td>

                      {/* category */}
                      <td style={{ padding: "10px 10px", whiteSpace: "nowrap" }}>
                        {label ? (
                          <span style={{
                            fontSize: 11, fontWeight: 500, padding: "2px 8px",
                            borderRadius: 99, background: label.color ? `${label.color}22` : "#f1efe8",
                            color: label.color ?? "#444441",
                            border: `0.5px solid ${label.color ?? "#d3d1c7"}`,
                          }}>
                            {label.name}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: "#d3d1c7" }}>—</span>
                        )}
                      </td>

                      {/* confidence */}
                      <td style={{ padding: "10px 10px", whiteSpace: "nowrap" }}>
                        {conf != null ? (
                          <span style={{
                            fontSize: 11,
                            color: conf >= 0.9 ? "#085041" : conf >= 0.75 ? "#633806" : "#791F1F",
                          }}>
                            {Math.round(conf * 100)}%
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: "#d3d1c7" }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: "10px 10px" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 500, padding: "2px 8px",
                          borderRadius: 99, background: s.bg, color: s.color,
                        }}>
                          {txn.review_status}
                        </span>
                      </td>

                      <td style={{ padding: "10px 10px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {txn.review_status !== "approved" && (
                            <ActionBtn label="✓" color="#085041" onClick={() => setStatus(txn, "approved")} />
                          )}
                          {txn.review_status !== "ignored" && (
                            <ActionBtn label="✕" color="#888780" onClick={() => setStatus(txn, "ignored")} />
                          )}
                          <ActionBtn
                            label="✎"
                            color="#0C447C"
                            onClick={() => {
                              setEditingId(isEditing ? null : txn.id)
                              setNoteValue(txn.user_note ?? "")
                            }}
                          />
                        </div>
                      </td>
                    </tr>

                    {isEditing && (
                      <tr style={{ background: "#E6F1FB22" }}>
                        <td colSpan={7} style={{ padding: "10px 10px" }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                              autoFocus
                              type="text"
                              placeholder="Add a note…"
                              value={noteValue}
                              onChange={e => setNoteValue(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && saveNote(txn)}
                              style={{
                                flex: 1, padding: "6px 10px", borderRadius: 6,
                                border: "0.5px solid #d3d1c7", fontSize: 13,
                                background: "transparent", color: "inherit",
                              }}
                            />
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
      )}
    </div>
  )
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: 28, height: 28, borderRadius: 6,
      border: "0.5px solid #d3d1c7",
      background: "transparent", cursor: "pointer",
      color, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {label}
    </button>
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
