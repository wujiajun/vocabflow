import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createVocabulary, getVocabulary, listVocabulary } from '../api/vocabularyApi'
import type { CreateVocabularyRequest } from '../types/vocabulary'

export const vocabularyPageSize = 20

const vocabularyKeys = {
  all: ['vocabulary'] as const,
  lists: () => [...vocabularyKeys.all, 'list'] as const,
  list: (page: number) => [...vocabularyKeys.lists(), page, vocabularyPageSize] as const,
  detail: (id: number) => [...vocabularyKeys.all, 'detail', id] as const,
}

export function useVocabularyList(page: number) {
  return useQuery({
    queryKey: vocabularyKeys.list(page),
    queryFn: () => listVocabulary(page, vocabularyPageSize),
    placeholderData: keepPreviousData,
  })
}

export function useVocabularyDetail(id: number | undefined) {
  return useQuery({
    queryKey: vocabularyKeys.detail(id ?? -1),
    queryFn: () => getVocabulary(id as number),
    enabled: id !== undefined,
    retry: false,
  })
}

export function useAddVocabulary() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: CreateVocabularyRequest) => createVocabulary(request),
    onSuccess: (entry) => {
      queryClient.setQueryData(vocabularyKeys.detail(entry.id), entry)
      return queryClient.invalidateQueries({ queryKey: vocabularyKeys.lists() })
    },
  })
}
