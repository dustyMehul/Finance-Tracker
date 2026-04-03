import { useQuery } from "@tanstack/react-query"
import { getTransactions } from "../api/client"
import type { Transaction } from "../types"

interface Props {
  open: boolean
  onClose: () => void
  title: string
  color?: string
  // pass one of these to filter
  labelId?: string
  financialNature?: string
}

function fmt(n: number) {
  return "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN")
}

export default function TransactionDrawer({ open, onClose, title, color, labelId, financialNature }: Props) {
  const { data: txns = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["txns-drawer", labelId, financialNature],
    queryFn: () => getTransactions({
      label_id: labelId,
      financial_nature: financialNature,
      include_finalized: true,
      limit: 500,
    }),
    enabled: open && (!!labelId || !!financialNature),
  })

  if (!open) return null

  const total = txns.reduce((s, t) => {
    return t.transaction_type === "debit" ? s - t.amount : s + t.amount
  }, 0)

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.2)", zIndex: 200 }}
      />

      {/* drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 440, background: "#fff", zIndex: 201,
        boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
        display: "flex", flexDirection: "column",
      }}>
        {/* header */}
        <div style={{
          padding: "18px 20px", borderBottom: "0.5px solid #d3d1c7",
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          {color && <div style={{ width: 12, height: 12, borderRadius: "50%", background: color, flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
            {!isLoading && (
              <div style={{ fontSize: 12, color: "#888780", marginTop: 2 }}>
                {txns.length} transaction{txns.length !== 1 ? "s" : ""}
                {txns.length > 0 && <span> · {total >= 0 ? "+" : "−"}{fmt(Math.abs(total))}</span>}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", fontSize: 22, cursor: "pointer",
            color: "#6b7280", lineHeight: 1, flexShrink: 0,
          }}>×</button>
        </div>

        {/* list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {isLoading ? (
            <div style={{ padding: "2rem", fontSize: 13, color: "#888780", textAlign: "center" }}>Loading…</div>
          ) : txns.length === 0 ? (
            <div style={{ padding: "2rem", fontSize: 13, color: "#888780", textAlign: "center" }}>No transactions found.</div>
          ) : (
            txns.map(t => <TxnRow key={t.id} txn={t} />)
          )}
        </div>
      </div>
    </>
  )
}

function TxnRow({ txn }: { txn: Transaction }) {
  const isDebit = txn.transaction_type === "debit"
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "11px 20px", borderBottom: "0.5px solid #f3f1e9",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {txn.description || txn.description_raw}
        </div>
        <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>
          {new Date(txn.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          {txn.account_nickname && <span> · {txn.account_nickname}</span>}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: isDebit ? "#E24B4A" : "#1D9E75" }}>
          {isDebit ? "−" : "+"}{fmt(txn.amount)}
        </div>
        <div style={{ fontSize: 11, color: "#b4b2a9", marginTop: 1 }}>{txn.review_status}</div>
      </div>
    </div>
  )
}
