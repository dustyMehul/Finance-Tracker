import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getAccounts, createAccount } from "../api/client"
import type { Account, AccountCreate, AccountType } from "../types"

const BANKS = ["HDFC Bank", "SBI", "ICICI Bank", "Axis Bank", "Kotak", "Other"]
const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "savings", label: "Savings" },
  { value: "current", label: "Current" },
  { value: "credit",  label: "Credit Card" },
  { value: "wallet",  label: "Wallet" },
]
const COLORS = [
  "#4f9cf9", "#22c55e", "#f59e0b", "#ef4444",
  "#a855f7", "#06b6d4", "#f97316", "#6b7280",
]
const NATURE_LABEL: Record<string, string> = {
  savings: "Savings", current: "Current", credit: "Credit Card", wallet: "Wallet",
}

// ── styles ─────────────────────────────────────────────────────────────────
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
  width: "100%", padding: "7px 10px", border: "1px solid #d1d5db",
  borderRadius: 6, fontSize: 13, boxSizing: "border-box",
}
const btnPrimary: React.CSSProperties = {
  padding: "7px 18px", borderRadius: 6, fontSize: 14, cursor: "pointer",
  border: "none", background: "#1a1a18", color: "#fff",
}
const btnGhost: React.CSSProperties = {
  padding: "7px 18px", borderRadius: 6, fontSize: 14, cursor: "pointer",
  border: "1px solid #d1d5db", background: "#fff", color: "#374151",
}

// ── types ──────────────────────────────────────────────────────────────────
interface Staged extends AccountCreate {
  _key: number   // local id for removal
}

const EMPTY_FORM: AccountCreate = {
  display_name: "", bank: undefined, account_type: undefined, last_4: undefined, color: undefined,
}

// ── component ──────────────────────────────────────────────────────────────
interface Props { open: boolean; onClose: () => void }

export default function AccountsModal({ open, onClose }: Props) {
  const qc = useQueryClient()
  const [staged, setStaged] = useState<Staged[]>([])
  const [form, setForm] = useState<AccountCreate>(EMPTY_FORM)
  const [formError, setFormError] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [nextKey, setNextKey] = useState(0)

  const { data: saved = [] } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: getAccounts,
    enabled: open,
  })

  const save = useMutation({
    mutationFn: (data: AccountCreate) => createAccount(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  })

  // Add to staged list (local only)
  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.display_name.trim()) { setFormError("Display name is required."); return }
    const alreadyStaged = staged.some(s => s.display_name.trim() === form.display_name.trim())
    const alreadySaved  = saved.some(a => a.display_name === form.display_name.trim())
    if (alreadyStaged || alreadySaved) { setFormError("An account with this name already exists."); return }
    setStaged(prev => [...prev, { ...form, display_name: form.display_name.trim(), _key: nextKey }])
    setNextKey(k => k + 1)
    setForm(EMPTY_FORM)
    setFormError("")
  }

  function removeStaged(key: number) {
    setStaged(prev => prev.filter(s => s._key !== key))
  }

  // Submit all staged → DB
  async function handleSubmit() {
    if (staged.length === 0) return
    setSubmitError("")
    let failed = 0
    for (const s of staged) {
      try {
        await save.mutateAsync({ display_name: s.display_name, bank: s.bank, account_type: s.account_type, last_4: s.last_4, color: s.color })
      } catch {
        failed++
      }
    }
    if (failed > 0) {
      setSubmitError(`${failed} account(s) could not be saved (duplicate name?).`)
    } else {
      setStaged([])
    }
  }

  if (!open) return null

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Accounts</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280", lineHeight: 1 }}>×</button>
        </div>

        {/* Saved accounts (DB) — read-only */}
        {saved.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Saved accounts
            </p>
            {saved.map((a: Account) => (
              <AccountRow key={a.id} name={a.display_name} bank={a.bank} type={a.account_type} last4={a.last_4} color={a.color} />
            ))}
          </div>
        )}

        {/* Staged accounts (local, not yet in DB) */}
        {staged.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              To be added
            </p>
            {staged.map(s => (
              <AccountRow
                key={s._key}
                name={s.display_name}
                bank={s.bank ?? null}
                type={s.account_type ?? null}
                last4={s.last_4 ?? null}
                color={s.color ?? null}
                onRemove={() => removeStaged(s._key)}
              />
            ))}
          </div>
        )}

        {/* Add form */}
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 18 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Add account
          </p>
          <form onSubmit={handleAdd}>
            <div style={{ display: "grid", gap: 10 }}>
              {/* Display name */}
              <input
                style={inp}
                placeholder="Display name, e.g. HDFC-Saving-4122 *"
                value={form.display_name}
                onChange={e => { setForm(f => ({ ...f, display_name: e.target.value })); setFormError("") }}
              />

              {/* Bank + Type */}
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

              {/* Last 4 + Color + Add button */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  style={{ ...inp, width: 110 }}
                  placeholder="Last 4 digits"
                  maxLength={4}
                  value={form.last_4 ?? ""}
                  onChange={e => setForm(f => ({ ...f, last_4: e.target.value.replace(/\D/g, "") || undefined }))}
                />
                <div style={{ display: "flex", gap: 5, flex: 1 }}>
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: f.color === c ? undefined : c }))}
                      style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: "none", cursor: "pointer",
                        outline: form.color === c ? `3px solid ${c}` : "none", outlineOffset: 2, flexShrink: 0 }}
                    />
                  ))}
                </div>
                <button type="submit" style={{ ...btnGhost, whiteSpace: "nowrap" }}>+ Add</button>
              </div>
            </div>
            {formError && <p style={{ color: "#dc2626", fontSize: 12, margin: "6px 0 0" }}>{formError}</p>}
          </form>
        </div>

        {/* Submit footer */}
        {staged.length > 0 && (
          <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 20, paddingTop: 16 }}>
            {submitError && <p style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>{submitError}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button style={btnGhost} onClick={() => { setStaged([]); setSubmitError("") }}>Clear</button>
              <button style={btnPrimary} onClick={handleSubmit} disabled={save.isPending}>
                {save.isPending ? "Saving…" : `Submit ${staged.length} account${staged.length > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── shared row component ───────────────────────────────────────────────────
function AccountRow({ name, bank, type, last4, color, onRemove }: {
  name: string; bank: string | null; type: string | null
  last4: string | null; color: string | null; onRemove?: () => void
}) {
  const meta = [bank, type ? NATURE_LABEL[type] ?? type : null, last4 ? `···· ${last4}` : null].filter(Boolean).join(" · ")
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 12px", border: "1px solid #e5e7eb",
      borderRadius: 8, marginBottom: 6,
      background: onRemove ? "#fffbeb" : "#fafafa",
    }}>
      <div style={{ width: 11, height: 11, borderRadius: "50%", background: color || "#9ca3af", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        {meta && <div style={{ fontSize: 12, color: "#6b7280" }}>{meta}</div>}
      </div>
      {onRemove ? (
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 18, lineHeight: 1, padding: "0 2px" }}>×</button>
      ) : (
        <span style={{ fontSize: 11, color: "#9ca3af", padding: "2px 8px", borderRadius: 99, background: "#f3f4f6" }}>saved</span>
      )}
    </div>
  )
}
