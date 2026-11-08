import { apiClient } from '../../../shared/api/apiClient'
import type { ProgressSummary } from '../types/progress'

export function getProgressSummary(date: string) {
  // The device's zone only matters to a learner who has not chosen one in Settings.
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const query = `date=${encodeURIComponent(date)}${zone ? `&zone=${encodeURIComponent(zone)}` : ''}`
  return apiClient<ProgressSummary>(`/api/v1/progress/summary?${query}`)
}
