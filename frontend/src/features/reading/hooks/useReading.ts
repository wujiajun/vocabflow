import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { generatePassage, getPassage, getToday, listPassages, setPassageRead } from '../api/readingApi'

export const readingPageSize = 20

const readingKeys = {
  all: ['reading'] as const,
  lists: () => [...readingKeys.all, 'list'] as const,
  list: (page: number, filter: string) => [...readingKeys.lists(), page, readingPageSize, filter] as const,
  detail: (id: number) => [...readingKeys.all, 'detail', id] as const,
  today: (date: string) => [...readingKeys.all, 'today', date] as const,
}

export function useReadingToday(date: string, enabled: boolean) {
  return useQuery({ queryKey: readingKeys.today(date), queryFn: () => getToday(date), enabled })
}

export function useReadingList(page: number, filter = '') {
  return useQuery({
    queryKey: readingKeys.list(page, filter),
    queryFn: () => listPassages(page, readingPageSize, filter),
    placeholderData: keepPreviousData,
  })
}

export function useReadingPassage(id: number | undefined) {
  return useQuery({
    queryKey: readingKeys.detail(id ?? -1),
    queryFn: () => getPassage(id as number),
    enabled: id !== undefined,
  })
}

export function useGeneratePassage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (date: string) => generatePassage(date),
    // Runs even if the user has left the page while it was being written.
    onSuccess: (passage, date) => {
      queryClient.setQueryData(readingKeys.detail(passage.id), passage)
      queryClient.setQueryData(readingKeys.today(date), { passageId: passage.id })
      return queryClient.invalidateQueries({ queryKey: readingKeys.lists() })
    },
  })
}

export function useSetRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, read }: { id: number; read: boolean }) => setPassageRead(id, read),
    onSuccess: (passage) => {
      queryClient.setQueryData(readingKeys.detail(passage.id), passage)
      return queryClient.invalidateQueries({ queryKey: readingKeys.lists() })
    },
  })
}
