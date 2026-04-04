import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import DropZone from "../components/DropZone"
import { uploadStatement, getTransferSuggestions, getAccounts } from "../api/client"
import type { Account } from "../types"

interface FileEntry {
  file: File
  account_id: string
  status: "pending" | "uploading" | "done" | "error"
  error?: string
  jobId?: string
  transactionCount?: number
}

interface Props {
  onOpenAccounts: () => void
}

// ── Status badge config ────────────────────────────────────────────────────
const STATUS_MAP = {
  pending:   { label: "Ready",       bg: "#EDFAF3", color: "#166534", border: "#A7E9CB" },
  uploading: { label: "Processing…", bg: "#EFF4FE", color: "#1E40AF", border: "#BDD0F7" },
  done:      { label: "Imported",    bg: "#EDFAF3", color: "#166534", border: "#A7E9CB" },
  error:     { label: "Error",       bg: "#FEF0EF", color: "#991B1B", border: "#F9C8C6" },
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function Upload({ onOpenAccounts }: Props) {
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [processing, setProcessing] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState("")
  const navigate = useNavigate()

  const { data: transferSuggestions = [] } = useQuery({
    queryKey: ["transfer-suggestions"],
    queryFn: getTransferSuggestions,
    refetchInterval: 10000,
  })

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: getAccounts,
  })

  function addFiles(files: File[]) {
    const newEntries: FileEntry[] = files.map(f => ({
      file: f,
      account_id: selectedAccountId,
      status: "pending",
    }))
    setEntries(prev => [...prev, ...newEntries])
  }

  function updateEntryAccount(index: number, account_id: string) {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, account_id } : e))
  }

  function removeEntry(index: number) {
    setEntries(prev => prev.filter((_, i) => i !== index))
  }

  async function processAll() {
    const missing = entries.filter(e => e.status === "pending" && !e.account_id)
    if (missing.length > 0) {
      alert("Please select an account for every file before processing.")
      return
    }

    setProcessing(true)

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      if (entry.status === "done") continue

      setEntries(prev => prev.map((e, idx) =>
        idx === i ? { ...e, status: "uploading" } : e
      ))

      try {
        const result = await uploadStatement(entry.file, {
          account_id: entry.account_id || undefined,
        })

        setEntries(prev => prev.map((e, idx) =>
          idx === i ? {
            ...e,
            status: result.status === "done" ? "done" : "error",
            error: result.error_message ?? undefined,
            jobId: result.job_id,
            transactionCount: result.transaction_count ?? undefined,
          } : e
        ))
      } catch (err: any) {
        const msg = err?.response?.data?.detail ?? "Upload failed"
        setEntries(prev => prev.map((e, idx) =>
          idx === i ? { ...e, status: "error", error: msg } : e
        ))
      }
    }

    setProcessing(false)
  }

  const allDone   = entries.length > 0 && entries.every(e => e.status === "done")
  const hasPending = entries.some(e => e.status === "pending")
  const pendingTransfers = transferSuggestions.length

  return (
    <div style={{ padding: "36px 40px", maxWidth: 760 }}>

      {/* Page header */}
      <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
        Import Statements
      </h1>
      <p style={{ fontSize: 13, color: "#6B6862", marginBottom: 28 }}>
        Upload bank or credit card statements to begin processing.
      </p>

      {/* Transfer awareness banner */}
      {pendingTransfers > 0 && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 14,
          padding: "14px 18px", borderRadius: 10, marginBottom: 24,
          background: "#EFF4FE",
          border: "1px solid #BDD0F7",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: "#DDEAFB",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2A6DD9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
              <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1E40AF" }}>
              {pendingTransfers} transfer{pendingTransfers > 1 ? "s" : ""} awaiting review
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#3B5EA8", lineHeight: 1.5 }}>
              Some transactions may be internal moves — CC payments, refunds, account transfers.
              Review before reconciling to avoid double-counting.
            </p>
          </div>
          <button
            onClick={() => navigate("/transfers")}
            style={{
              padding: "6px 14px", borderRadius: 7, border: "none",
              background: "#2A6DD9", color: "#fff", fontSize: 12,
              fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            Review →
          </button>
        </div>
      )}

      {/* Account selector */}
      {accounts.length === 0 ? (
        <div style={{
          padding: "14px 18px", borderRadius: 10,
          border: "1px dashed #D0CEC8",
          background: "#FAF9F7",
          marginBottom: 20, fontSize: 13, color: "#6B6862",
        }}>
          No accounts yet.{" "}
          <button
            onClick={onOpenAccounts}
            style={{
              background: "none", border: "none", color: "#2A6DD9",
              cursor: "pointer", fontSize: 13, padding: 0,
              fontWeight: 600, textDecoration: "underline", fontFamily: "'Manrope', sans-serif",
            }}
          >
            Create an account
          </button>
          {" "}to get started.
        </div>
      ) : (
        <div style={{ marginBottom: 22 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#A8A5A0", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
            Default account
          </label>
          <select
            value={selectedAccountId}
            onChange={e => setSelectedAccountId(e.target.value)}
            style={{
              padding: "8px 12px", border: "1px solid #E6E4DC",
              borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: "#FFFFFF", color: "#1A1916",
              minWidth: 260, cursor: "pointer",
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            <option value="">— select account —</option>
            {accounts.map((a: Account) => (
              <option key={a.id} value={a.id}>{a.display_name}</option>
            ))}
          </select>
        </div>
      )}

      <DropZone onFiles={addFiles} disabled={accounts.length > 0 && !selectedAccountId} />

      {entries.length > 0 && (
        <div style={{ marginTop: 20 }}>

          {/* File list */}
          <div style={{ marginBottom: 16 }}>
            {entries.map((entry, i) => {
              const s = STATUS_MAP[entry.status]
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px", borderRadius: 10,
                  border: "1px solid #E6E4DC",
                  marginBottom: 8, background: "#FFFFFF",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}>
                  {/* File icon */}
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: "#F5F4F2", border: "1px solid #E6E4DC",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A8780" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1A1916" }}>
                      {entry.file.name}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#A8A5A0", fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmtSize(entry.file.size)}
                    </p>
                  </div>

                  {entry.status === "pending" && accounts.length > 0 && (
                    <select
                      value={entry.account_id}
                      onChange={e => updateEntryAccount(i, e.target.value)}
                      style={{
                        padding: "5px 10px", border: "1px solid #E6E4DC",
                        borderRadius: 7, fontSize: 12, fontWeight: 500,
                        background: "#FAF9F7", color: "#1A1916",
                        fontFamily: "'Manrope', sans-serif",
                      }}
                    >
                      <option value="">— account —</option>
                      {accounts.map((a: Account) => (
                        <option key={a.id} value={a.id}>{a.display_name}</option>
                      ))}
                    </select>
                  )}

                  {/* Status badge */}
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 9px",
                    borderRadius: 99, background: s.bg, color: s.color,
                    border: `1px solid ${s.border}`, whiteSpace: "nowrap",
                    letterSpacing: "0.02em",
                  }}>
                    {entry.status === "done" && entry.transactionCount != null
                      ? `${entry.transactionCount} txns`
                      : s.label}
                  </span>

                  {entry.status === "pending" && (
                    <button
                      onClick={() => removeEntry(i)}
                      style={{
                        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                        border: "1px solid #E6E4DC", background: "transparent",
                        cursor: "pointer", color: "#A8A5A0", fontSize: 16,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        lineHeight: 1,
                      }}
                    >×</button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            {allDone && (
              <button
                onClick={() => navigate("/reconcile")}
                style={{
                  padding: "9px 22px", borderRadius: 8,
                  background: "#18A96B", color: "#fff",
                  border: "none", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", letterSpacing: "0.01em",
                }}
              >
                Review transactions →
              </button>
            )}
            {hasPending && (
              <button
                onClick={processAll}
                disabled={processing}
                style={{
                  padding: "9px 22px", borderRadius: 8,
                  background: processing ? "#D0CEC8" : "#1A1916",
                  color: "#fff", border: "none", fontSize: 13,
                  fontWeight: 600, cursor: processing ? "not-allowed" : "pointer",
                  letterSpacing: "0.01em", transition: "background 0.15s",
                }}
              >
                {processing ? "Processing…" : "Process files"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
