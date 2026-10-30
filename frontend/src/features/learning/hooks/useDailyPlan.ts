import { useQuery } from '@tanstack/react-query'
import { getDailyPlan } from '../api/dailyPlanApi'

export function useDailyPlan(date: string) {
  return useQuery({
    queryKey: ['learning', 'daily-plan', date],
    queryFn: () => getDailyPlan(date),
  })
}
