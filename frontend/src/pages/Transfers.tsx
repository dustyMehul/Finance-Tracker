import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getTransferSuggestions, confirmTransfer, unlinkTransfer, getTransactions } from "../api/client"
import type { Transaction } from "../types"

// ── Badge configs ──────────────────────────────────────────────────────────
const NATURE_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  expense:    { bg: "#FEF0EF", color: "#991B1B", border: "#F9C8C6" },
  income:     { bg: "#EDFAF3", color: "#166534", border: "#A7E9CB" },
  transfer:   { bg: "#F5F4F2", color: "#5A5855", border: "#E6E4DC" },
  investment: { bg: "#EFF4FE", color: "#1E40AF", border: "#BDD0F7" },
  lending:    { bg: "#FEFCE8", color: "#92400E", border: "#FDE68A" },
  unknown:    { bg: "#F5F4F2", color: "#8A8780", border: "#E6E4DC" },
}

function NatureBadge({ nature }: { nature: string | null }) {
  const s = NATURE_BADGE[nature ?? "unknown"] ?? NATURE_BADGE.unknown
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      textTransform: "capitalize", letterSpacing: "0.02em",
    }}>
      {nature ?? "unknown"}
    </span>
  )
}

function TxnMini({ txn }: { txn: Transaction }) {
  return (
    <div>
      <p style={{ margin: "0 0 3px", fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240, color: "#1A1916" }}>
        {txn.description}
      </p>
      <p style={{ margin: 0, fontSize: 11, color: "#A8A5A0", fontFamily: "'JetBrains Mono', monospace" }}>
        {txn.date}
        {txn.bank ? ` · ${txn.bank}` : ""}
        {txn.account_nickname ? ` · ${txn.account_nickname}` : (txn.account_type ? ` · ${txn.account_type}` : "")}
      </p>
    </div>
  )
}

export default function Transfers() {
  const queryClient = useQueryClient()

  const { data: suggestions = [], isLoading: loadingSuggestions } = useQuery({
    queryKey: ["transfer-suggestions"],
    queryFn: getTransferSuggestions,
  })

  const { data: allTxns = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => getTransactions(),
  })

  const confirmedTransfers = allTxns.filter(t => t.transfer_confirmed)

  const confirmMutation = useMutation({
    mutationFn: ({ a, b }: { a: string; b: string }) => confirmTransfer(a, b),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfer-suggestions"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
  })

  const unlinkMutation = useMutation({
    mutationFn: (id: string) => unlinkTransfer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfer-suggestions"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
  })

  return (
    <div style={{ padding: "36px 40px", maxWidth: 1000 }}>

      {/* Header */}
      <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
        Transfers
      </h1>
      <p style={{ fontSize: 13, color: "#6B6862", marginBottom: 32 }}>
        Match internal moves — CC payments, account transfers, refunds.
        Confirmed transfers are excluded from spend and income reports.
      </p>

      {/* ── Suggestions ── */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#A8A5A0", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Suggested matches
          </span>
          {suggestions.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
              background: "#FEFCE8", color: "#92400E", border: "1px solid #FDE68A",
            }}>
              {suggestions.length}
            </span>
          )}
        </div>

        {loadingSuggestions && (
          <p style={{ fontSize: 13, color: "#A8A5A0" }}>Looking for matches…</p>
        )}
        {!loadingSuggestions && suggestions.length === 0 && (
          <div style={{
            padding: "32px 24px", borderRadius: 12,
            border: "1px solid #E6E4DC", background: "#FAFAF8",
            textAlign: "center", fontSize: 13, color: "#A8A5A0",
          }}>
            No unmatched transfer candidates found.
          </div>
        )}

        {suggestions.map((s, i) => (
          <div key={i} style={{
            border: "1px solid #E6E4DC", borderRadius: 12,
            marginBottom: 10, overflow: "hidden", background: "#FFFFFF",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 48px 1fr auto", alignItems: "stretch" }}>

              {/* Txn A — Outflow */}
              <div style={{ padding: "18px 20px", borderRight: "1px solid #F0EEE8" }}>
                <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 600, color: "#D94B45", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Outflow · Debit
                </p>
                <TxnMini txn={s.txn_a} />
                <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{
                    fontSize: 14, fontWeight: 700, color: "#D94B45",
                    fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.02em",
                  }}>
                    −₹{s.txn_a.amount.toLocaleString("en-IN")}
                  </span>
                  <NatureBadge nature={s.txn_a.financial_nature} />
                </div>
              </div>

              {/* Arrow connector */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#D0CEC8", background: "#FAFAF8" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </div>

              {/* Txn B — Inflow */}
              <div style={{ padding: "18px 20px", borderRight: "1px solid #F0EEE8" }}>
                <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 600, color: "#18A96B", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Inflow · Credit
                </p>
                <TxnMini txn={s.txn_b} />
                <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{
                    fontSize: 14, fontWeight: 700, color: "#18A96B",
                    fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.02em",
                  }}>
                    +₹{s.txn_b.amount.toLocaleString("en-IN")}
                  </span>
                  <NatureBadge nature={s.txn_b.financial_nature} />
                </div>
              </div>

              {/* Actions */}
              <div style={{ padding: "18px 18px", display: "flex", flexDirection: "column", gap: 8, justifyContent: "center", minWidth: 160 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                  <ConfidencePip confidence={s.confidence} />
                  <span style={{ fontSize: 11, color: "#A8A5A0", fontFamily: "'JetBrains Mono', monospace" }}>
                    {Math.round(s.confidence * 100)}% · {s.days_apart === 0 ? "same day" : `${s.days_apart}d apart`}
                  </span>
                </div>
                <button
                  onClick={() => confirmMutation.mutate({ a: s.txn_a.id, b: s.txn_b.id })}
                  disabled={confirmMutation.isPending}
                  style={{
                    padding: "7px 14px", borderRadius: 8, border: "none",
                    background: "#1A1916", color: "#fff", fontSize: 12,
                    fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                    transition: "opacity 0.1s",
                    opacity: confirmMutation.isPending ? 0.6 : 1,
                  }}
                >
                  ✓ Confirm transfer
                </button>
                <button
                  style={{
                    padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                    border: "1px solid #E6E4DC", background: "transparent",
                    color: "#6B6862", cursor: "pointer",
                  }}
                >
                  Not a transfer
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Confirmed transfers ── */}
      {confirmedTransfers.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#A8A5A0", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Confirmed transfers
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
              background: "#F5F4F2", color: "#5A5855", border: "1px solid #E6E4DC",
            }}>
              {confirmedTransfers.length}
            </span>
          </div>

          <div style={{ border: "1px solid #E6E4DC", borderRadius: 12, overflow: "hidden", background: "#FFFFFF" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#FAFAF8", borderBottom: "1px solid #E6E4DC" }}>
                  {["Date", "Description", "Amount", "Account", "Nature", ""].map(h => (
                    <th key={h} style={{
                      padding: "10px 16px", textAlign: "left",
                      fontSize: 11, fontWeight: 600, color: "#A8A5A0",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {confirmedTransfers.map(t => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #F0EEE8" }}>
                    <td style={{ padding: "11px 16px", color: "#8A8780", whiteSpace: "nowrap", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                      {t.date}
                    </td>
                    <td style={{ padding: "11px 16px", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 500 }}>
                      {t.description}
                    </td>
                    <td style={{ padding: "11px 16px", whiteSpace: "nowrap", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 13,
                      color: t.transaction_type === "credit" ? "#18A96B" : "#D94B45" }}>
                      {t.transaction_type === "credit" ? "+" : "−"}₹{t.amount.toLocaleString("en-IN")}
                    </td>
                    <td style={{ padding: "11px 16px", color: "#8A8780", fontSize: 12 }}>
                      {[t.bank, t.account_nickname].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <NatureBadge nature={t.financial_nature} />
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <button
                        onClick={() => unlinkMutation.mutate(t.id)}
                        style={{
                          fontSize: 11, fontWeight: 500, color: "#A8A5A0",
                          background: "none", border: "none", cursor: "pointer",
                          padding: "3px 8px", borderRadius: 6,
                          transition: "background 0.1s, color 0.1s",
                        }}
                      >
                        Unlink
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function ConfidencePip({ confidence }: { confidence: number }) {
  const color = confidence >= 0.9 ? "#18A96B" : confidence >= 0.6 ? "#A16207" : "#D94B45"
  return (
    <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
  )
}
