import { apiClient } from '../../../shared/api/apiClient'
import type { LedgerPage, TaskDay } from '../types/tasks'

export function getTasksToday(date: string) {
  return apiClient<TaskDay>(`/api/v1/tasks/today?date=${encodeURIComponent(date)}`)
}

export function getLedger(page: number, size = 20) {
  return apiClient<LedgerPage>(`/api/v1/tasks/ledger?page=${page}&size=${size}`)
}
