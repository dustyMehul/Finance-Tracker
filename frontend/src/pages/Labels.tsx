import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getLabels, createLabel } from "../api/client"

const PRESET_COLORS = [
  "#E85D24", "#639922", "#378ADD", "#BA7517", "#7F77DD",
  "#1D9E75", "#D85A30", "#D4537E", "#E24B4A", "#0F6E56",
  "#534AB7", "#185FA5", "#27500A", "#444441", "#888780",
]

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", borderRadius: 8,
  border: "0.5px solid #d3d1c7", fontSize: 13,
  background: "transparent", color: "inherit",
  boxSizing: "border-box",
}

export default function Labels() {
  const queryClient = useQueryClient()
  const [name, setName]   = useState("")
  const [slug, setSlug]   = useState("")
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [error, setError] = useState("")

  const { data: labels = [] } = useQuery({
    queryKey: ["labels"],
    queryFn: getLabels,
  })

  const mutation = useMutation({
    mutationFn: createLabel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] })
      setName("")
      setSlug("")
      setColor(PRESET_COLORS[0])
      setError("")
    },
    onError: (err: any) => {
      setError(err?.response?.data?.detail ?? "Failed to create label.")
    },
  })

  function handleNameChange(val: string) {
    setName(val)
    setSlug(slugify(val))
  }

  function handleSubmit() {
    if (!name.trim()) { setError("Name is required."); return }
    if (!slug.trim()) { setError("Slug is required."); return }
    setError("")
    mutation.mutate({ name: name.trim(), slug: slug.trim(), color })
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: 20, fontWeight: 500, margin: "0 0 4px" }}>Labels</h1>
      <p style={{ fontSize: 13, color: "#888780", margin: "0 0 28px" }}>
        Categories used to classify transactions.
      </p>

      {/* add new label form */}
      <div style={{
        border: "0.5px solid #d3d1c7", borderRadius: 12,
        padding: "20px 20px", marginBottom: 32, background: "#fff",
      }}>
        <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 16px" }}>Add new label</p>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "#888780", display: "block", marginBottom: 4 }}>
            Name
          </label>
          <input
            type="text"
            placeholder="e.g. Home & rent"
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: "#888780", display: "block", marginBottom: 4 }}>
            Slug <span style={{ fontWeight: 400 }}>(auto-generated, must be unique)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. home_rent"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "#888780", display: "block", marginBottom: 8 }}>
            Color
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: c, border: "none", cursor: "pointer",
                  outline: color === c ? `3px solid ${c}` : "none",
                  outlineOffset: 2,
                  transform: color === c ? "scale(1.15)" : "scale(1)",
                  transition: "transform 0.1s",
                }}
              />
            ))}
            {/* custom color input */}
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              style={{
                width: 28, height: 28, borderRadius: "50%",
                border: "0.5px solid #d3d1c7", cursor: "pointer",
                padding: 0, background: "none",
              }}
              title="Custom color"
            />
          </div>

          {/* preview */}
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#888780" }}>Preview:</span>
            <span style={{
              fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 99,
              background: `${color}22`, color: color,
              border: `0.5px solid ${color}`,
            }}>
              {name || "Label name"}
            </span>
          </div>
        </div>

        {error && (
          <p style={{ fontSize: 12, color: "#791F1F", margin: "0 0 12px" }}>{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={mutation.isPending}
          style={{
            padding: "8px 20px", borderRadius: 8, border: "none",
            background: mutation.isPending ? "#d3d1c7" : "#1a1a18",
            color: "#fff", fontSize: 13, fontWeight: 500,
            cursor: mutation.isPending ? "not-allowed" : "pointer",
          }}
        >
          {mutation.isPending ? "Adding…" : "Add label"}
        </button>
      </div>

      {/* existing labels */}
      <p style={{ fontSize: 12, fontWeight: 500, color: "#888780", margin: "0 0 10px" }}>
        {labels.length} labels
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {labels.map(l => (
          <span key={l.id} style={{
            fontSize: 12, fontWeight: 500, padding: "4px 12px", borderRadius: 99,
            background: l.color ? `${l.color}22` : "#f1efe8",
            color: l.color ?? "#444441",
            border: `0.5px solid ${l.color ?? "#d3d1c7"}`,
          }}>
            {l.name}
          </span>
        ))}
      </div>
    </div>
  )
}
