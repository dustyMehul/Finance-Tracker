export type AccountType = "savings" | "current" | "credit" | "wallet"
export type JobStatus = "pending" | "processing" | "done" | "failed" | "finalized"
export type ReviewStatus = "pending" | "approved" | "edited" | "ignored" | "finalized"
export type TransactionType = "debit" | "credit"

export interface UploadJobResponse {
  job_id: string
  filename: string
  status: JobStatus
  transaction_count: number | null
  duplicate_count: number | null
  pending_count: number | null
  error_message: string | null
  finalized_at: string | null
  created_at: string
}

export interface Transaction {
  id: string
  upload_job_id: string
  date: string
  description_raw: string
  description: string
  amount: number
  currency: string
  transaction_type: TransactionType
  balance: number | null
  bank: string | null
  account_type: AccountType | null
  account_nickname: string | null
  label_id: string | null
  category_confidence: number | null
  is_duplicate: boolean
  is_return: boolean
  review_status: ReviewStatus
  user_note: string | null
  created_at: string
}

export interface TransactionUpdate {
  label_id?: string
  review_status?: ReviewStatus
  user_note?: string
  description?: string
}

export interface Label {
  id: string
  name: string
  slug: string
  color: string | null
  is_active: boolean
  created_at: string
}

export interface LabelCreate {
  name: string
  slug: string
  color?: string
}