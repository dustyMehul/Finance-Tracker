import axios from "axios"
import type {
  UploadJobResponse,
  Transaction,
  TransactionUpdate,
  Label,
  LabelCreate,
} from "../types"

const api = axios.create({
  baseURL: "http://localhost:8000",
})

// --- Upload ---
export async function uploadStatement(
  file: File,
  meta: { bank?: string; account_type?: string; account_nickname?: string }
): Promise<UploadJobResponse> {
  const form = new FormData()
  form.append("file", file)
  if (meta.bank) form.append("bank", meta.bank)
  if (meta.account_type) form.append("account_type", meta.account_type)
  if (meta.account_nickname) form.append("account_nickname", meta.account_nickname)
  const { data } = await api.post<UploadJobResponse>("/upload", form)
  return data
}

export async function getJobs(): Promise<UploadJobResponse[]> {
  const { data } = await api.get<UploadJobResponse[]>("/upload/jobs")
  return data
}

export async function getJobStatus(jobId: string): Promise<UploadJobResponse> {
  const { data } = await api.get<UploadJobResponse>(`/upload/${jobId}`)
  return data
}

export async function finalizeJob(jobId: string): Promise<UploadJobResponse> {
  const { data } = await api.post<UploadJobResponse>(`/upload/${jobId}/finalize`)
  return data
}

// --- Transactions ---
export async function getTransactions(params?: {
  review_status?: string
  upload_job_id?: string
  include_finalized?: boolean
  skip?: number
  limit?: number
}): Promise<Transaction[]> {
  const { data } = await api.get<Transaction[]>("/transactions", { params })
  return data
}

export async function updateTransaction(
  id: string,
  update: TransactionUpdate
): Promise<Transaction> {
  const { data } = await api.patch<Transaction>(`/transactions/${id}`, update)
  return data
}

// --- Labels ---
export async function getLabels(): Promise<Label[]> {
  const { data } = await api.get<Label[]>("/labels")
  return data
}

export async function createLabel(label: LabelCreate): Promise<Label> {
  const { data } = await api.post<Label>("/labels", label)
  return data
}