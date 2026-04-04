import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getLabels, createLabel, getAccounts, createAccount } from "../api/client"
import type { Account, AccountCreate, AccountType } from "../types"

// ── Shared input/button styles ─────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: "100%", padding: "8px 12px",
  border: "1px solid #E6E4DC", borderRadius: 8,
  fontSize: 13, fontWeight: 500,
  boxSizing: "border-box", background: "#FFFFFF",
  color: "#1A1916", fontFamily: "'Manrope', sans-serif",
  outline: "none", transition: "border-color 0.15s",
}

const btnPrimary: React.CSSProperties = {
  padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: "pointer", border: "none", background: "#1A1916", color: "#FFFFFF",
  letterSpacing: "0.01em", fontFamily: "'Manrope', sans-serif",
}

const btnGhost: React.CSSProperties = {
  padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500,
  cursor: "pointer", border: "1px solid #E6E4DC", background: "#FFFFFF",
  color: "#6B6862", fontFamily: "'Manrope', sans-serif",
}

// ── Label Tab ──────────────────────────────────────────────────────────────
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
      <div style={{ border: "1px solid #E6E4DC", borderRadius: 10, padding: "20px", marginBottom: 24, background: "#FAFAF8" }}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#A8A5A0", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Name
          </label>
          <input
            style={inp} placeholder="e.g. Home & Rent"
            value={name}
            onChange={e => { setName(e.target.value); setSlug(slugify(e.target.value)) }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#A8A5A0", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Slug <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(auto-generated, must be unique)</span>
          </label>
          <input
            style={inp} placeholder="e.g. home_rent"
            value={slug}
            onChange={e => setSlug(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#A8A5A0", display: "block", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Color
          </label>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: 22, height: 22, borderRadius: "50%", background: c, border: "none",
                cursor: "pointer", flexShrink: 0, transition: "transform 0.1s",
                outline: color === c ? `2.5px solid ${c}` : "none",
                outlineOffset: 2,
                transform: color === c ? "scale(1.2)" : "scale(1)",
              }} />
            ))}
            <input
              type="color" value={color} onChange={e => setColor(e.target.value)}
              style={{ width: 22, height: 22, borderRadius: "50%", border: "1px solid #E6E4DC", cursor: "pointer", padding: 0, background: "none" }}
              title="Custom color"
            />
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#A8A5A0" }}>Preview:</span>
            <span style={{
              fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
              background: `${color}18`, color,
              border: `1px solid ${color}40`,
            }}>
              {name || "Label name"}
            </span>
          </div>
        </div>

        {error && <p style={{ fontSize: 12, color: "#991B1B", margin: "0 0 12px", fontWeight: 500 }}>{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={mutation.isPending}
          style={{ ...btnPrimary, opacity: mutation.isPending ? 0.6 : 1, cursor: mutation.isPending ? "not-allowed" : "pointer" }}
        >
          {mutation.isPending ? "Adding…" : "Add label"}
        </button>
      </div>

      {/* Existing labels */}
      {labels.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#A8A5A0", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
            {labels.length} labels
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {labels.map((l: any) => (
              <span key={l.id} style={{
                fontSize: 12, fontWeight: 600, padding: "4px 11px", borderRadius: 99,
                background: l.color ? `${l.color}18` : "#F5F4F2",
                color: l.color ?? "#5A5855",
                border: `1px solid ${l.color ? `${l.color}40` : "#E6E4DC"}`,
              }}>
                {l.name}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Account Tab ────────────────────────────────────────────────────────────
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

  const { data: saved = [] } = useQuery<Account[]>({
    queryKey: ["accounts"], queryFn: getAccounts, enabled: open,
  })

  const save = useMutation({
    mutationFn: (data: AccountCreate) => createAccount(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.display_name.trim()) { setFormError("Display name is required."); return }
    if (
      staged.some(s => s.display_name.trim() === form.display_name.trim()) ||
      saved.some((a: Account) => a.display_name === form.display_name.trim())
    ) {
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
      try {
        await save.mutateAsync({ display_name: s.display_name, bank: s.bank, account_type: s.account_type, last_4: s.last_4, color: s.color })
      } catch { failed++ }
    }
    if (failed > 0) setSubmitError(`${failed} account(s) could not be saved.`)
    else setStaged([])
  }

  const hasList = staged.length > 0 || saved.length > 0

  return (
    <div>
      {/* Saved accounts */}
      {saved.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#A8A5A0", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
            Saved accounts
          </p>
          {saved.map((a: Account) => (
            <AccountRow key={a.id} name={a.display_name} bank={a.bank} type={a.account_type} last4={a.last_4} color={a.color} />
          ))}
        </div>
      )}

      {/* Staged (to be added) */}
      {staged.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#A8A5A0", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
            To be added
          </p>
          {staged.map(s => (
            <AccountRow
              key={s._key} name={s.display_name} bank={s.bank ?? null}
              type={s.account_type ?? null} last4={s.last_4 ?? null} color={s.color ?? null}
              onRemove={() => setStaged(prev => prev.filter(x => x._key !== s._key))}
            />
          ))}
        </div>
      )}

      {/* Add form */}
      <div style={{ borderTop: hasList ? "1px solid #E6E4DC" : "none", paddingTop: hasList ? 20 : 0 }}>
        <form onSubmit={handleAdd}>
          <div style={{ display: "grid", gap: 10 }}>
            <input
              style={inp} placeholder="Display name, e.g. HDFC Savings ···· 4122 *"
              value={form.display_name}
              onChange={e => { setForm(f => ({ ...f, display_name: e.target.value })); setFormError("") }}
            />
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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                style={{ ...inp, width: 130 }} placeholder="Last 4 digits" maxLength={4}
                value={form.last_4 ?? ""}
                onChange={e => setForm(f => ({ ...f, last_4: e.target.value.replace(/\D/g, "") || undefined }))}
              />
              <div style={{ display: "flex", gap: 6, flex: 1 }}>
                {ACCOUNT_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: f.color === c ? undefined : c }))}
                    style={{
                      width: 20, height: 20, borderRadius: "50%", background: c, border: "none",
                      cursor: "pointer", outline: form.color === c ? `2.5px solid ${c}` : "none",
                      outlineOffset: 2, flexShrink: 0,
                      transform: form.color === c ? "scale(1.2)" : "scale(1)",
                      transition: "transform 0.1s",
                    }}
                  />
                ))}
              </div>
              <button type="submit" style={{ ...btnGhost, whiteSpace: "nowrap", padding: "8px 16px" }}>
                + Add
              </button>
            </div>
          </div>
          {formError && <p style={{ color: "#991B1B", fontSize: 12, margin: "8px 0 0", fontWeight: 500 }}>{formError}</p>}
        </form>
      </div>

      {/* Save batch */}
      {staged.length > 0 && (
        <div style={{ borderTop: "1px solid #E6E4DC", marginTop: 20, paddingTop: 16 }}>
          {submitError && <p style={{ color: "#991B1B", fontSize: 12, marginBottom: 10, fontWeight: 500 }}>{submitError}</p>}
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
  const meta = [
    bank,
    type ? TYPE_LABEL[type] ?? type : null,
    last4 ? `···· ${last4}` : null,
  ].filter(Boolean).join(" · ")

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 14px", border: "1px solid #E6E4DC", borderRadius: 9,
      marginBottom: 7,
      background: onRemove ? "#FFFBF0" : "#FAFAF8",
      boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: "50%",
        background: color || "#A8A5A0", flexShrink: 0,
        boxShadow: color ? `0 0 0 3px ${color}22` : "none",
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1A1916" }}>
          {name}
        </div>
        {meta && (
          <div style={{ fontSize: 11, color: "#A8A5A0", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
            {meta}
          </div>
        )}
      </div>
      {onRemove ? (
        <button onClick={onRemove} style={{
          width: 24, height: 24, borderRadius: 6, border: "1px solid #E6E4DC",
          background: "transparent", cursor: "pointer", color: "#A8A5A0",
          fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
          lineHeight: 1,
        }}>×</button>
      ) : (
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
          background: "#EDFAF3", color: "#166534", border: "1px solid #A7E9CB",
          textTransform: "uppercase", letterSpacing: "0.04em",
        }}>saved</span>
      )}
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
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(17,17,16,0.4)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: "#FFFFFF", borderRadius: 16,
        padding: "28px 32px",
        width: 560, maxHeight: "88vh", overflowY: "auto",
        boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.06)",
        border: "1px solid #E6E4DC",
      }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{
            display: "flex", gap: 3, background: "#F5F4F2",
            borderRadius: 9, padding: 3,
          }}>
            {(["label", "account"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "6px 18px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                cursor: "pointer", border: "none",
                background: tab === t ? "#FFFFFF" : "transparent",
                color: tab === t ? "#1A1916" : "#8A8780",
                boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s", fontFamily: "'Manrope', sans-serif",
                letterSpacing: "0.01em",
              }}>
                {t === "label" ? "Add Label" : "Add Account"}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: "1px solid #E6E4DC", background: "#FAFAF8",
              fontSize: 18, cursor: "pointer", color: "#6B6862",
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1, transition: "background 0.1s",
            }}
          >×</button>
        </div>

        {tab === "label"   && <LabelTab />}
        {tab === "account" && <AccountTab open={open} />}
      </div>
    </div>
  )
}
