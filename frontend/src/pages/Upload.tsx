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
    // Validate all pending entries have an account
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

  const allDone = entries.length > 0 && entries.every(e => e.status === "done")
  const hasPending = entries.some(e => e.status === "pending")
  const pendingTransfers = transferSuggestions.length

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 2rem" }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>
        Import statements
      </h1>
      <p style={{ fontSize: 14, color: "#888780", marginBottom: 24, marginTop: 0 }}>
        Drop one or more bank statements to get started.
      </p>

      {/* transfer awareness banner */}
      {pendingTransfers > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", borderRadius: 10, marginBottom: 20,
          background: "#EEEDFE", border: "0.5px solid #AFA9EC",
        }}>
          <span style={{ fontSize: 20 }}>🔗</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#3C3489" }}>
              {pendingTransfers} transfer{pendingTransfers > 1 ? "s" : ""} need matching
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#534AB7" }}>
              Some transactions may be internal moves (CC payments, refunds, account transfers).
              Review them before reconciling to avoid double counting.
            </p>
          </div>
          <button
            onClick={() => navigate("/transfers")}
            style={{
              padding: "7px 16px", borderRadius: 8, border: "none",
              background: "#534AB7", color: "#fff", fontSize: 12,
              fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            Review transfers →
          </button>
        </div>
      )}

      {/* Account selector */}
      {accounts.length === 0 ? (
        <div style={{
          padding: "12px 16px", borderRadius: 8, border: "1px dashed #d1d5db",
          background: "#fafafa", marginBottom: 20, fontSize: 13, color: "#6b7280",
        }}>
          No accounts found.{" "}
          <button
            onClick={onOpenAccounts}
            style={{ background: "none", border: "none", color: "#185FA5", cursor: "pointer", fontSize: 13, padding: 0, textDecoration: "underline" }}
          >
            Create an account
          </button>
          {" "}to get started.
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: "#374151", fontWeight: 500, display: "block", marginBottom: 6 }}>
            Default account for new files
          </label>
          <select
            value={selectedAccountId}
            onChange={e => setSelectedAccountId(e.target.value)}
            style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, minWidth: 240 }}
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
        <div style={{ marginTop: 24 }}>
          {/* file list with per-file account selector */}
          <div style={{ marginBottom: 16 }}>
            {entries.map((entry, i) => (
              <div key={i} style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 8,
                border: "0.5px solid #d3d1c7",
                marginBottom: 8,
                background: "#fff",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.file.name}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#888780" }}>
                    {(entry.file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                {entry.status === "pending" && accounts.length > 0 && (
                  <select
                    value={entry.account_id}
                    onChange={e => updateEntryAccount(i, e.target.value)}
                    style={{ padding: "5px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }}
                  >
                    <option value="">— account —</option>
                    {accounts.map((a: Account) => (
                      <option key={a.id} value={a.id}>{a.display_name}</option>
                    ))}
                  </select>
                )}
                <StatusBadge entry={entry} />
                {entry.status === "pending" && (
                  <button
                    onClick={() => removeEntry(i)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#888780", fontSize: 18, lineHeight: 1, padding: "0 4px" }}
                  >×</button>
                )}
              </div>
            ))}
          </div>

          {/* actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
            {allDone && (
              <button
                onClick={() => navigate("/reconcile")}
                style={{
                  padding: "8px 20px",
                  borderRadius: 8,
                  background: "#185FA5",
                  color: "#fff",
                  border: "none",
                  fontSize: 13,
                  cursor: "pointer",
                  fontWeight: 500,
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
                  padding: "8px 20px",
                  borderRadius: 8,
                  background: processing ? "#d3d1c7" : "#1a1a18",
                  color: "#fff",
                  border: "none",
                  fontSize: 13,
                  cursor: processing ? "not-allowed" : "pointer",
                  fontWeight: 500,
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

function StatusBadge({ entry }: { entry: FileEntry }) {
  const map = {
    pending:   { label: "ready",      bg: "#E1F5EE", color: "#085041" },
    uploading: { label: "processing…", bg: "#E6F1FB", color: "#0C447C" },
    done:      { label: "imported",   bg: "#EAF3DE", color: "#27500A" },
    error:     { label: "error",      bg: "#FCEBEB", color: "#791F1F" },
  }
  const s = map[entry.status]
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: "2px 8px",
      borderRadius: 99, background: s.bg, color: s.color, whiteSpace: "nowrap",
    }}>
      {entry.status === "done" && entry.transactionCount != null
        ? `${entry.transactionCount} transactions`
        : s.label}
    </span>
  )
}
