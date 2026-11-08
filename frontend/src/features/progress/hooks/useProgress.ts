import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getProgressSummary } from '../api/progressApi'

export const progressKeys = {
  all: ['progress'] as const,
  summary: (date: string) => [...progressKeys.all, 'summary', date] as const,
}

// Ratings, game rounds and added words all change the numbers, so any finished save marks the
// summary stale (the same idea as the daily tasks); opening the page always asks again.
export function useProgress(date: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    return queryClient.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'success') {
        void queryClient.invalidateQueries({ queryKey: progressKeys.all })
      }
    })
  }, [queryClient])

  return useQuery({
    queryKey: progressKeys.summary(date),
    queryFn: () => getProgressSummary(date),
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
}
