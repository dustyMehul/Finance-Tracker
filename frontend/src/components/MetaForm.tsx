import type { AccountType } from "../types"

export interface MetaValues {
  bank: string
  account_type: AccountType | ""
  account_nickname: string
}

interface Props {
  filename: string
  values: MetaValues
  onChange: (values: MetaValues) => void
}

const BANKS = ["HDFC Bank", "SBI", "ICICI Bank", "Axis Bank", "Kotak", "Other"]
const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "savings", label: "Savings account" },
  { value: "current", label: "Current account" },
  { value: "credit",  label: "Credit card" },
  { value: "wallet",  label: "Wallet" },
]

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 8,
  border: "0.5px solid #d3d1c7",
  fontSize: 13,
  background: "transparent",
  color: "inherit",
  boxSizing: "border-box",
}

export default function MetaForm({ filename, values, onChange }: Props) {
  function set(key: keyof MetaValues, value: string) {
    onChange({ ...values, [key]: value })
  }

  return (
    <div style={{
      background: "var(--bg2, #f5f4f0)",
      borderRadius: 10,
      padding: "14px 16px",
      marginBottom: 10,
    }}>
      <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 500, color: "#888780" }}>
        {filename}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 12, color: "#888780", display: "block", marginBottom: 4 }}>
            Bank
          </label>
          <select
            value={values.bank}
            onChange={(e) => set("bank", e.target.value)}
            style={inputStyle}
          >
            <option value="">— select —</option>
            {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#888780", display: "block", marginBottom: 4 }}>
            Account type
          </label>
          <select
            value={values.account_type}
            onChange={(e) => set("account_type", e.target.value)}
            style={inputStyle}
          >
            <option value="">— select —</option>
            {ACCOUNT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label style={{ fontSize: 12, color: "#888780", display: "block", marginBottom: 4 }}>
          Nickname (optional)
        </label>
        <input
          type="text"
          placeholder="e.g. HDFC credit primary"
          value={values.account_nickname}
          onChange={(e) => set("account_nickname", e.target.value)}
          style={inputStyle}
        />
      </div>
    </div>
  )
}
