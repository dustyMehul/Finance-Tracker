import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getLabels, createLabel, getAccounts, createAccount } from "../api/client"
import type { Account, AccountCreate, AccountType } from "../types"

// ── shared styles ──────────────────────────────────────────────────────────
const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
}
const modal: React.CSSProperties = {
  background: "#fff", borderRadius: 12, padding: "28px 32px",
  width: 540, maxHeight: "85vh", overflowY: "auto",
  boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
}
const inp: React.CSSProperties = {
  width: "100%", padding: "7px 10px", border: "0.5px solid #d3d1c7",
  borderRadius: 6, fontSize: 13, boxSizing: "border-box", background: "transparent", color: "inherit",
}
const btnPrimary: React.CSSProperties = {
  padding: "7px 18px", borderRadius: 6, fontSize: 14, cursor: "pointer",
  border: "none", background: "#1a1a18", color: "#fff",
}
const btnGhost: React.CSSProperties = {
  padding: "7px 18px", borderRadius: 6, fontSize: 14, cursor: "pointer",
  border: "1px solid #d1d5db", background: "#fff", color: "#374151",
}

// ── Label tab ──────────────────────────────────────────────────────────────
const PRESET_COLORS = [
  "#E85D24", "#639922", "#378ADD", "#BA7517", "#7F77DD",
  "#1D9E75", "#D85A30", "#D4537E", "#E24B4A", "#0F6E56",
  "#534AB7", "#185FA5", "#27500A", "#444441", "#888780",
]

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "_")
}

function LabelTab() {
  const qc = useQueryClient()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [error, setError] = useState("")

  const { data: labels = [] } = useQuery({ queryKey: ["labels"], queryFn: getLabels })

  const mutation = useMutation({
    mutationFn: createLabel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["labels"] })
      setName(""); setSlug(""); setColor(PRESET_COLORS[0]); setError("")
    },
    onError: (err: any) => setError(err?.response?.data?.detail ?? "Failed to create label."),
  })

  function handleSubmit() {
    if (!name.trim()) { setError("Name is required."); return }
    if (!slug.trim()) { setError("Slug is required."); return }
    setError("")
    mutation.mutate({ name: name.trim(), slug: slug.trim(), color })
  }

  return (
    <div>
      {/* Form */}
      <div style={{ border: "0.5px solid #d3d1c7", borderRadius: 10, padding: 18, marginBottom: 24 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "#888780", display: "block", marginBottom: 4 }}>Name</label>
          <input style={inp} placeholder="e.g. Home & rent" value={name}
            onChange={e => { setName(e.target.value); setSlug(slugify(e.target.value)) }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: "#888780", display: "block", marginBottom: 4 }}>
            Slug <span style={{ fontWeight: 400 }}>(auto-generated, must be unique)</span>
          </label>
          <input style={inp} placeholder="e.g. home_rent" value={slug}
            onChange={e => setSlug(e.target.value)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: "#888780", display: "block", marginBottom: 8 }}>Color</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: 24, height: 24, borderRadius: "50%", background: c, border: "none", cursor: "pointer",
                outline: color === c ? `3px solid ${c}` : "none", outlineOffset: 2,
                transform: color === c ? "scale(1.15)" : "scale(1)", transition: "transform 0.1s",
              }} />
            ))}
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              style={{ width: 24, height: 24, borderRadius: "50%", border: "0.5px solid #d3d1c7", cursor: "pointer", padding: 0, background: "none" }}
              title="Custom color" />
          </div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#888780" }}>Preview:</span>
            <span style={{ fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 99, background: `${color}22`, color, border: `0.5px solid ${color}` }}>
              {name || "Label name"}
            </span>
          </div>
        </div>
        {error && <p style={{ fontSize: 12, color: "#791F1F", margin: "0 0 10px" }}>{error}</p>}
        <button onClick={handleSubmit} disabled={mutation.isPending} style={{
          padding: "7px 18px", borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: mutation.isPending ? "not-allowed" : "pointer",
          border: "none", background: mutation.isPending ? "#d3d1c7" : "#1a1a18", color: "#fff",
        }}>
          {mutation.isPending ? "Adding…" : "Add label"}
        </button>
      </div>

      {/* Existing labels */}
      {labels.length > 0 && (
        <>
          <p style={{ fontSize: 12, fontWeight: 500, color: "#888780", margin: "0 0 10px" }}>{labels.length} labels</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {labels.map((l: any) => (
              <span key={l.id} style={{
                fontSize: 12, fontWeight: 500, padding: "4px 12px", borderRadius: 99,
                background: l.color ? `${l.color}22` : "#f1efe8",
                color: l.color ?? "#444441", border: `0.5px solid ${l.color ?? "#d3d1c7"}`,
              }}>{l.name}</span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Account tab ────────────────────────────────────────────────────────────
const BANKS = ["HDFC Bank", "SBI", "ICICI Bank", "Axis Bank", "Kotak", "Other"]
const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "savings", label: "Savings" },
  { value: "current", label: "Current" },
  { value: "credit",  label: "Credit Card" },
  { value: "wallet",  label: "Wallet" },
]
const ACCOUNT_COLORS = [
  "#4f9cf9", "#22c55e", "#f59e0b", "#ef4444",
  "#a855f7", "#06b6d4", "#f97316", "#6b7280",
]
const TYPE_LABEL: Record<string, string> = {
  savings: "Savings", current: "Current", credit: "Credit Card", wallet: "Wallet",
}

interface Staged extends AccountCreate { _key: number }
const EMPTY_FORM: AccountCreate = { display_name: "", bank: undefined, account_type: undefined, last_4: undefined, color: undefined }

function AccountTab({ open }: { open: boolean }) {
  const qc = useQueryClient()
  const [staged, setStaged] = useState<Staged[]>([])
  const [form, setForm] = useState<AccountCreate>(EMPTY_FORM)
  const [formError, setFormError] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [nextKey, setNextKey] = useState(0)

  const { data: saved = [] } = useQuery<Account[]>({ queryKey: ["accounts"], queryFn: getAccounts, enabled: open })

  const save = useMutation({
    mutationFn: (data: AccountCreate) => createAccount(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.display_name.trim()) { setFormError("Display name is required."); return }
    if (staged.some(s => s.display_name.trim() === form.display_name.trim()) ||
        saved.some((a: Account) => a.display_name === form.display_name.trim())) {
      setFormError("An account with this name already exists."); return
    }
    setStaged(prev => [...prev, { ...form, display_name: form.display_name.trim(), _key: nextKey }])
    setNextKey(k => k + 1); setForm(EMPTY_FORM); setFormError("")
  }

  async function handleSubmit() {
    if (staged.length === 0) return
    setSubmitError("")
    let failed = 0
    for (const s of staged) {
      try { await save.mutateAsync({ display_name: s.display_name, bank: s.bank, account_type: s.account_type, last_4: s.last_4, color: s.color }) }
      catch { failed++ }
    }
    if (failed > 0) setSubmitError(`${failed} account(s) could not be saved.`)
    else setStaged([])
  }

  return (
    <div>
      {saved.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "#888780", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Saved accounts</p>
          {saved.map((a: Account) => <AccountRow key={a.id} name={a.display_name} bank={a.bank} type={a.account_type} last4={a.last_4} color={a.color} />)}
        </div>
      )}

      {staged.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "#888780", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>To be added</p>
          {staged.map(s => (
            <AccountRow key={s._key} name={s.display_name} bank={s.bank ?? null} type={s.account_type ?? null}
              last4={s.last_4 ?? null} color={s.color ?? null} onRemove={() => setStaged(prev => prev.filter(x => x._key !== s._key))} />
          ))}
        </div>
      )}

      <div style={{ borderTop: staged.length > 0 || saved.length > 0 ? "0.5px solid #d3d1c7" : "none", paddingTop: staged.length > 0 || saved.length > 0 ? 16 : 0 }}>
        <form onSubmit={handleAdd}>
          <div style={{ display: "grid", gap: 10 }}>
            <input style={inp} placeholder="Display name, e.g. HDFC Savings ···· 4122 *"
              value={form.display_name}
              onChange={e => { setForm(f => ({ ...f, display_name: e.target.value })); setFormError("") }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <select style={inp} value={form.bank ?? ""} onChange={e => setForm(f => ({ ...f, bank: e.target.value || undefined }))}>
                <option value="">Bank (optional)</option>
                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select style={inp} value={form.account_type ?? ""} onChange={e => setForm(f => ({ ...f, account_type: (e.target.value as AccountType) || undefined }))}>
                <option value="">Account type (optional)</option>
                {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input style={{ ...inp, width: 120 }} placeholder="Last 4 digits" maxLength={4}
                value={form.last_4 ?? ""}
                onChange={e => setForm(f => ({ ...f, last_4: e.target.value.replace(/\D/g, "") || undefined }))} />
              <div style={{ display: "flex", gap: 5, flex: 1 }}>
                {ACCOUNT_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: f.color === c ? undefined : c }))}
                    style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: "none", cursor: "pointer",
                      outline: form.color === c ? `3px solid ${c}` : "none", outlineOffset: 2, flexShrink: 0 }} />
                ))}
              </div>
              <button type="submit" style={{ ...btnGhost, whiteSpace: "nowrap" }}>+ Add</button>
            </div>
          </div>
          {formError && <p style={{ color: "#dc2626", fontSize: 12, margin: "6px 0 0" }}>{formError}</p>}
        </form>
      </div>

      {staged.length > 0 && (
        <div style={{ borderTop: "0.5px solid #d3d1c7", marginTop: 20, paddingTop: 16 }}>
          {submitError && <p style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>{submitError}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button style={btnGhost} onClick={() => { setStaged([]); setSubmitError("") }}>Clear</button>
            <button style={btnPrimary} onClick={handleSubmit} disabled={save.isPending}>
              {save.isPending ? "Saving…" : `Save ${staged.length} account${staged.length > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AccountRow({ name, bank, type, last4, color, onRemove }: {
  name: string; bank: string | null; type: string | null
  last4: string | null; color: string | null; onRemove?: () => void
}) {
  const meta = [bank, type ? TYPE_LABEL[type] ?? type : null, last4 ? `···· ${last4}` : null].filter(Boolean).join(" · ")
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
      border: "0.5px solid #d3d1c7", borderRadius: 8, marginBottom: 6,
      background: onRemove ? "#fffbeb" : "#fafafa",
    }}>
      <div style={{ width: 11, height: 11, borderRadius: "50%", background: color || "#9ca3af", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        {meta && <div style={{ fontSize: 12, color: "#6b7280" }}>{meta}</div>}
      </div>
      {onRemove
        ? <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 18, lineHeight: 1, padding: "0 2px" }}>×</button>
        : <span style={{ fontSize: 11, color: "#9ca3af", padding: "2px 8px", borderRadius: 99, background: "#f3f4f6" }}>saved</span>
      }
    </div>
  )
}

// ── Main modal ─────────────────────────────────────────────────────────────
type Tab = "label" | "account"

interface Props { open: boolean; onClose: () => void; defaultTab?: Tab }

export default function SetupModal({ open, onClose, defaultTab = "label" }: Props) {
  const [tab, setTab] = useState<Tab>(defaultTab)

  if (!open) return null

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 8, padding: 4 }}>
            {(["label", "account"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "5px 16px", borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: "pointer", border: "none",
                background: tab === t ? "#fff" : "transparent",
                color: tab === t ? "#1a1a18" : "#6b7280",
                boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}>
                {t === "label" ? "Add Label" : "Add Account"}
              </button>
            ))}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280", lineHeight: 1 }}>×</button>
        </div>

        {tab === "label"   && <LabelTab />}
        {tab === "account" && <AccountTab open={open} />}
      </div>
    </div>
  )
}
