import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getTransferSuggestions, confirmTransfer, unlinkTransfer, getTransactions } from "../api/client"
import type { Transaction } from "../types"

const NATURE_COLORS: Record<string, { bg: string; color: string }> = {
  expense:        { bg: "#FCEBEB", color: "#791F1F" },
  income:         { bg: "#EAF3DE", color: "#27500A" },
  transfer:       { bg: "#EEEDFE", color: "#3C3489" },
  investment:     { bg: "#E6F1FB", color: "#0C447C" },
  lending:        { bg: "#FAEEDA", color: "#633806" },
  lending_return: { bg: "#EAF3DE", color: "#27500A" },
  unknown:        { bg: "#F1EFE8", color: "#444441" },
}

function NatureBadge({ nature }: { nature: string | null }) {
  const s = NATURE_COLORS[nature ?? "unknown"] ?? NATURE_COLORS.unknown
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 99, background: s.bg, color: s.color }}>
      {nature ?? "unknown"}
    </span>
  )
}

function TxnMini({ txn }: { txn: Transaction }) {
  return (
    <div style={{ fontSize: 13 }}>
      <p style={{ margin: "0 0 2px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>
        {txn.description}
      </p>
      <p style={{ margin: 0, fontSize: 12, color: "#888780" }}>
        {txn.date} · {txn.bank ?? "unknown bank"} · {txn.account_nickname ?? txn.account_type ?? ""}
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
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "2rem 2rem" }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px" }}>Transfers</h1>
      <p style={{ fontSize: 14, color: "#888780", margin: "0 0 28px" }}>
        Match transactions that are internal moves — CC payments, account transfers, investments.
        Confirmed transfers are excluded from spend and income reports.
      </p>

      {/* suggested matches */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: "#888780", margin: "0 0 12px" }}>
          Suggested matches {suggestions.length > 0 ? `(${suggestions.length})` : ""}
        </p>

        {loadingSuggestions && <p style={{ fontSize: 13, color: "#888780" }}>Looking for matches…</p>}
        {!loadingSuggestions && suggestions.length === 0 && (
          <p style={{ fontSize: 13, color: "#b4b2a9" }}>No unmatched transfer candidates found.</p>
        )}

        {suggestions.map((s, i) => (
          <div key={i} style={{
            border: "0.5px solid #d3d1c7", borderRadius: 12,
            marginBottom: 10, overflow: "hidden", background: "#fff",
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto", gap: 0, alignItems: "stretch" }}>
              {/* txn A */}
              <div style={{ padding: "14px 18px", borderRight: "0.5px solid #f1efe8" }}>
                <p style={{ margin: "0 0 6px", fontSize: 11, color: "#888780" }}>Outflow (debit)</p>
                <TxnMini txn={s.txn_a} />
                <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#E24B4A" }}>
                    −₹{s.txn_a.amount.toLocaleString("en-IN")}
                  </span>
                  <NatureBadge nature={s.txn_a.financial_nature} />
                </div>
              </div>

              {/* arrow */}
              <div style={{ padding: "14px 12px", display: "flex", alignItems: "center", color: "#888780", fontSize: 18 }}>
                ↔
              </div>

              {/* txn B */}
              <div style={{ padding: "14px 18px", borderRight: "0.5px solid #f1efe8" }}>
                <p style={{ margin: "0 0 6px", fontSize: 11, color: "#888780" }}>Inflow (credit)</p>
                <TxnMini txn={s.txn_b} />
                <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#1D9E75" }}>
                    +₹{s.txn_b.amount.toLocaleString("en-IN")}
                  </span>
                  <NatureBadge nature={s.txn_b.financial_nature} />
                </div>
              </div>

              {/* actions */}
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                  <ConfidenceDot confidence={s.confidence} />
                  <span style={{ fontSize: 11, color: "#888780" }}>
                    {Math.round(s.confidence * 100)}% match · {s.days_apart === 0 ? "same day" : `${s.days_apart}d apart`}
                  </span>
                </div>
                <button
                  onClick={() => confirmMutation.mutate({ a: s.txn_a.id, b: s.txn_b.id })}
                  disabled={confirmMutation.isPending}
                  style={{
                    padding: "6px 14px", borderRadius: 8, border: "none",
                    background: "#1a1a18", color: "#fff", fontSize: 12,
                    fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  ✓ Confirm transfer
                </button>
                <button
                  style={{
                    padding: "5px 14px", borderRadius: 8, fontSize: 12,
                    border: "0.5px solid #d3d1c7", background: "transparent",
                    color: "#888780", cursor: "pointer",
                  }}
                >
                  Not a transfer
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* confirmed transfers */}
      {confirmedTransfers.length > 0 && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#888780", margin: "0 0 12px" }}>
            Confirmed transfers ({confirmedTransfers.length})
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "0.5px solid #d3d1c7" }}>
                  {["Date", "Description", "Amount", "Account", "Nature", ""].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500, color: "#888780" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {confirmedTransfers.map(t => (
                  <tr key={t.id} style={{ borderBottom: "0.5px solid #f1efe8" }}>
                    <td style={{ padding: "10px 12px", color: "#888780", whiteSpace: "nowrap" }}>{t.date}</td>
                    <td style={{ padding: "10px 12px", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 500,
                      color: t.transaction_type === "credit" ? "#1D9E75" : "#E24B4A", whiteSpace: "nowrap" }}>
                      {t.transaction_type === "credit" ? "+" : "−"}₹{t.amount.toLocaleString("en-IN")}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#888780", fontSize: 12 }}>
                      {t.bank ?? ""} {t.account_nickname ? `· ${t.account_nickname}` : ""}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <NatureBadge nature={t.financial_nature} />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <button
                        onClick={() => unlinkMutation.mutate(t.id)}
                        style={{ fontSize: 11, color: "#888780", background: "none", border: "none", cursor: "pointer" }}
                      >
                        unlink
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

function ConfidenceDot({ confidence }: { confidence: number }) {
  const color = confidence >= 0.9 ? "#1D9E75" : confidence >= 0.6 ? "#BA7517" : "#E24B4A"
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
}
