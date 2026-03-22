import { useRef, useState } from "react"

interface Props {
  onFiles: (files: File[]) => void
}

const ACCEPTED = [".csv", ".xls", ".xlsx", ".pdf", ".ofx", ".qif"]

export default function DropZone({ onFiles }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    onFiles(files)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    onFiles(files)
    // reset so same file can be re-selected
    e.target.value = ""
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${dragging ? "#378ADD" : "#b4b2a9"}`,
        borderRadius: 12,
        padding: "2.5rem",
        textAlign: "center",
        cursor: "pointer",
        background: dragging ? "#E6F1FB" : "transparent",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
      <p style={{ margin: 0, fontWeight: 500, fontSize: 15 }}>
        Drop your statement here
      </p>
      <p style={{ margin: "6px 0 0", fontSize: 13, color: "#888780" }}>
        {ACCEPTED.join(", ")} — multiple files supported
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED.join(",")}
        style={{ display: "none" }}
        onChange={handleChange}
      />
    </div>
  )
}
