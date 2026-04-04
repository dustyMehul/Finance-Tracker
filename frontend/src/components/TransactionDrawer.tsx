import { useQuery } from "@tanstack/react-query"
import { getTransactions } from "../api/client"
import type { Transaction } from "../types"

interface Props {
  open: boolean
  onClose: () => void
  title: string
  color?: string
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
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(17,17,16,0.35)",
          backdropFilter: "blur(2px)",
          zIndex: 200,
        }}
      />

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 460, background: "#FFFFFF",
        zIndex: 201,
        boxShadow: "-8px 0 32px rgba(0,0,0,0.10), -1px 0 0 #E6E4DC",
        display: "flex", flexDirection: "column",
      }}>

        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid #E6E4DC",
          display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
          background: "#FAFAF8",
        }}>
          {color && (
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: color, flexShrink: 0,
              boxShadow: `0 0 0 3px ${color}22`,
            }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1916", letterSpacing: "-0.01em" }}>
              {title}
            </div>
            {!isLoading && (
              <div style={{ fontSize: 12, color: "#A8A5A0", marginTop: 2 }}>
                {txns.length} transaction{txns.length !== 1 ? "s" : ""}
                {txns.length > 0 && (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", marginLeft: 6 }}>
                    · {total >= 0 ? "+" : "−"}{fmt(Math.abs(total))}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: "1px solid #E6E4DC", background: "#FFFFFF",
              fontSize: 18, cursor: "pointer", color: "#6B6862",
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1, flexShrink: 0, transition: "background 0.1s",
            }}
          >×</button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {isLoading ? (
            <div style={{ padding: "48px 24px", fontSize: 13, color: "#A8A5A0", textAlign: "center" }}>
              Loading…
            </div>
          ) : txns.length === 0 ? (
            <div style={{ padding: "48px 24px", fontSize: 13, color: "#A8A5A0", textAlign: "center" }}>
              No transactions found.
            </div>
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
      display: "flex", alignItems: "center", gap: 14,
      padding: "12px 24px", borderBottom: "1px solid #F0EEE8",
    }}>
      {/* Color dot for debit/credit */}
      <div style={{
        width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
        background: isDebit ? "#D94B45" : "#18A96B",
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1916", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {txn.description || txn.description_raw}
        </div>
        <div style={{ fontSize: 11, color: "#A8A5A0", marginTop: 2 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {new Date(txn.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          {txn.account_nickname && <span> · {txn.account_nickname}</span>}
        </div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600,
          fontFamily: "'JetBrains Mono', monospace",
          color: isDebit ? "#D94B45" : "#18A96B",
          letterSpacing: "-0.02em",
        }}>
          {isDebit ? "−" : "+"}{fmt(txn.amount)}
        </div>
        <div style={{ fontSize: 10, color: "#C8C5BE", marginTop: 1, textTransform: "capitalize" }}>
          {txn.review_status}
        </div>
      </div>
    </div>
  )
}
