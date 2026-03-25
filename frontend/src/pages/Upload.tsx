import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import DropZone from "../components/DropZone"
import MetaForm, { type MetaValues } from "../components/MetaForm"
import { uploadStatement, getTransferSuggestions } from "../api/client"

interface FileEntry {
  file: File
  meta: MetaValues
  status: "pending" | "uploading" | "done" | "error"
  error?: string
  jobId?: string
  transactionCount?: number
}

const defaultMeta = (): MetaValues => ({
  bank: "",
  account_type: "",
  account_nickname: "",
})

export default function Upload() {
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [processing, setProcessing] = useState(false)
  const navigate = useNavigate()

  const { data: transferSuggestions = [] } = useQuery({
    queryKey: ["transfer-suggestions"],
    queryFn: getTransferSuggestions,
    refetchInterval: 10000,  // refresh every 10s after upload
  })

  function addFiles(files: File[]) {
    const newEntries: FileEntry[] = files.map(f => ({
      file: f,
      meta: defaultMeta(),
      status: "pending",
    }))
    setEntries(prev => [...prev, ...newEntries])
  }

  function updateMeta(index: number, meta: MetaValues) {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, meta } : e))
  }

  function removeEntry(index: number) {
    setEntries(prev => prev.filter((_, i) => i !== index))
  }

  async function processAll() {
    setProcessing(true)

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      if (entry.status === "done") continue

      // mark uploading
      setEntries(prev => prev.map((e, idx) =>
        idx === i ? { ...e, status: "uploading" } : e
      ))

      try {
        const result = await uploadStatement(entry.file, {
          bank: entry.meta.bank || undefined,
          account_type: entry.meta.account_type || undefined,
          account_nickname: entry.meta.account_nickname || undefined,
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

      <DropZone onFiles={addFiles} />

      {entries.length > 0 && (
        <div style={{ marginTop: 24 }}>
          {/* file list */}
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

          {/* metadata forms for pending files */}
          {entries.some(e => e.status === "pending") && (
            <>
              <p style={{ fontSize: 12, fontWeight: 500, color: "#888780", margin: "0 0 8px" }}>
                Statement details
              </p>
              {entries.map((entry, i) =>
                entry.status === "pending" ? (
                  <MetaForm
                    key={i}
                    filename={entry.file.name}
                    values={entry.meta}
                    onChange={(meta) => updateMeta(i, meta)}
                  />
                ) : null
              )}
            </>
          )}

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
