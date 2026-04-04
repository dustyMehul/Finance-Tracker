import { useRef, useState } from "react"

interface Props {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

const ACCEPTED = [".csv", ".xls", ".xlsx", ".pdf", ".ofx", ".qif"]

const UploadCloudIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/>
    <line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
)

export default function DropZone({ onFiles, disabled = false }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const files = Array.from(e.dataTransfer.files)
    onFiles(files)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    onFiles(files)
    e.target.value = ""
  }

  return (
    <div
      onClick={() => { if (!disabled) inputRef.current?.click() }}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        border: `1.5px dashed ${disabled ? "#D0CEC8" : dragging ? "#2A6DD9" : "#C8C5BE"}`,
        borderRadius: 12,
        padding: "40px 32px",
        textAlign: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "#FAF9F7" : dragging ? "#EFF4FE" : "#FAFAF8",
        opacity: disabled ? 0.6 : 1,
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <div style={{
        color: disabled ? "#A8A5A0" : dragging ? "#2A6DD9" : "#A8A5A0",
        marginBottom: 12, transition: "color 0.15s",
        display: "flex", justifyContent: "center",
      }}>
        <UploadCloudIcon />
      </div>
      <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: disabled ? "#A8A5A0" : "#1A1916" }}>
        {disabled ? "Select an account first" : dragging ? "Drop to import" : "Drop your statement here"}
      </p>
      <p style={{ margin: "6px 0 0", fontSize: 12, color: "#A8A5A0" }}>
        or <span style={{ color: disabled ? "#A8A5A0" : "#2A6DD9", fontWeight: 500 }}>click to browse</span>
        {" "}· {ACCEPTED.join(", ")}
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED.join(",")}
        style={{ display: "none" }}
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  )
}
