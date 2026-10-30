import { apiClient } from '../../../shared/api/apiClient'
import type { DailyPlan } from '../types/dailyPlan'

export function getDailyPlan(date: string) {
  return apiClient<DailyPlan>(`/api/v1/learning/daily-plan?date=${date}`)
}
