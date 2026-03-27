import axios from "axios"
import type {
  UploadJobResponse, Transaction, TransactionUpdate,
  Label, LabelCreate, TransferSuggestion,
} from "../types"

const api = axios.create({ baseURL: "http://localhost:8000" })

// --- Upload ---
export async function uploadStatement(file: File, meta: { bank?: string; account_type?: string; account_nickname?: string }): Promise<UploadJobResponse> {
  const form = new FormData()
  form.append("file", file)
  if (meta.bank)             form.append("bank", meta.bank)
  if (meta.account_type)     form.append("account_type", meta.account_type)
  if (meta.account_nickname) form.append("account_nickname", meta.account_nickname)
  const { data } = await api.post<UploadJobResponse>("/upload", form)
  return data
}
export async function getJobs(): Promise<UploadJobResponse[]>          { return (await api.get("/upload/jobs")).data }
export async function getJobStatus(id: string): Promise<UploadJobResponse> { return (await api.get(`/upload/${id}`)).data }
export async function finalizeJob(id: string): Promise<UploadJobResponse>  { return (await api.post(`/upload/${id}/finalize`)).data }

// --- Transactions ---
export async function getTransactions(params?: { review_status?: string; upload_job_id?: string; include_finalized?: boolean; skip?: number; limit?: number }): Promise<Transaction[]> {
  return (await api.get("/transactions", { params })).data
}
export async function updateTransaction(id: string, update: TransactionUpdate): Promise<Transaction> {
  return (await api.patch(`/transactions/${id}`, update)).data
}

// --- Transfers ---
export async function getTransferSuggestions(): Promise<TransferSuggestion[]> {
  return (await api.get("/transfers/suggestions")).data
}
export async function confirmTransfer(txnAId: string, txnBId: string): Promise<void> {
  await api.post("/transfers/confirm", { txn_a_id: txnAId, txn_b_id: txnBId })
}
export async function unlinkTransfer(txnId: string): Promise<void> {
  await api.post(`/transfers/unlink/${txnId}`)
}

// --- Labels ---
export async function getLabels(): Promise<Label[]>                   { return (await api.get("/labels")).data }
export async function createLabel(label: LabelCreate): Promise<Label> { return (await api.post("/labels", label)).data }

// --- Reports ---
export async function getReportSummary(period: string)    { return (await api.get(`/reports/summary?period=${period}`)).data }
export async function getReportCategories(period: string) { return (await api.get(`/reports/categories?period=${period}`)).data }
export async function getReportMonthly(period: string)    { return (await api.get(`/reports/monthly?period=${period}`)).data }
export async function getReportMerchants(period: string)  { return (await api.get(`/reports/merchants?period=${period}&limit=15`)).data }
export async function getReportLending()                  { return (await api.get(`/reports/lending?period=all`)).data }