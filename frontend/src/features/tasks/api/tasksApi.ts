import { apiClient } from '../../../shared/api/apiClient'
import type { LedgerPage, TaskDay } from '../types/tasks'

export function getTasksToday(date: string) {
  // The device's zone only matters to a learner who has not chosen one in Settings.
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const query = `date=${encodeURIComponent(date)}${zone ? `&zone=${encodeURIComponent(zone)}` : ''}`
  return apiClient<TaskDay>(`/api/v1/tasks/today?${query}`)
}

export function getLedger(page: number, size = 20) {
  return apiClient<LedgerPage>(`/api/v1/tasks/ledger?page=${page}&size=${size}`)
}
