import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getLedger, getTasksToday } from '../api/tasksApi'

export const taskKeys = {
  all: ['tasks'] as const,
  today: (date: string) => [...taskKeys.all, 'today', date] as const,
  ledger: (page: number) => [...taskKeys.all, 'ledger', page] as const,
}

// Always read on opening and when the app comes back into view: what counts is done elsewhere (a game,
// a video, an article) and the server grades it when the tasks are read.
export function useTodayTasks(date: string) {
  const queryClient = useQueryClient()

  // Any finished save (a rating, a game round, a watched video, a read article, an added word) can
  // complete a task, so ask again after it.
  useEffect(() => {
    return queryClient.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'success') {
        void queryClient.invalidateQueries({ queryKey: taskKeys.all })
      }
    })
  }, [queryClient])

  return useQuery({
    queryKey: taskKeys.today(date),
    queryFn: () => getTasksToday(date),
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
}

export function useLedger(page: number) {
  return useQuery({
    queryKey: taskKeys.ledger(page),
    queryFn: () => getLedger(page),
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
}
