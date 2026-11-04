import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { createVocabulary, getVocabulary, listVocabulary, removeVocabulary, retryEnrichment } from '../api/vocabularyApi'
import { ApiClientError } from '../../../shared/api/apiClient'
import type { CreateVocabularyRequest, VocabularyEntry } from '../types/vocabulary'
import { entryIsUnfinished, pageHasUnfinished, useEnrichmentRefetchInterval } from './enrichmentPolling'

export const vocabularyPageSize = 20

const vocabularyKeys = {
  all: ['vocabulary'] as const,
  lists: () => [...vocabularyKeys.all, 'list'] as const,
  list: (page: number, filter: string) => [...vocabularyKeys.lists(), page, vocabularyPageSize, filter] as const,
  detail: (id: number) => [...vocabularyKeys.all, 'detail', id] as const,
  // What the user typed when they added the entry, kept in the cache so that it goes with the
  // session. The server may save the word under another name once its details arrive.
  typed: (id: number) => [...vocabularyKeys.all, 'typed', id] as const,
}

export function useVocabularyList(page: number, filter = '') {
  const refetchInterval = useEnrichmentRefetchInterval(pageHasUnfinished)

  return useQuery({
    queryKey: vocabularyKeys.list(page, filter),
    queryFn: () => listVocabulary(page, vocabularyPageSize, filter),
    placeholderData: keepPreviousData,
    refetchInterval,
  })
}

export function useVocabularyDetail(id: number | undefined) {
  const refetchInterval = useEnrichmentRefetchInterval(entryIsUnfinished)

  return useQuery({
    queryKey: vocabularyKeys.detail(id ?? -1),
    queryFn: () => getVocabulary(id as number),
    enabled: id !== undefined,
    retry: false,
    refetchInterval,
  })
}

// Several entries at once, under the same keys as the single one, so a page that opens one finds it cached.
export function useVocabularyDetails(ids: number[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: vocabularyKeys.detail(id),
      queryFn: () => getVocabulary(id),
      retry: false,
    })),
  })
}

export function useAddVocabulary() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: CreateVocabularyRequest) => createVocabulary(request),
    onSuccess: (entry, request) => {
      queryClient.setQueryData(vocabularyKeys.typed(entry.id), request.term)
      // An unfinished entry is seeded as already stale, so opening its page reads the server again
      // instead of showing this snapshot for the whole stale time.
      queryClient.setQueryData(vocabularyKeys.detail(entry.id), entry, entryIsUnfinished(entry) ? { updatedAt: 0 } : undefined)
      return queryClient.invalidateQueries({ queryKey: vocabularyKeys.lists() })
    },
  })
}

/**
 * What the user typed, when the entry ended up under another name (typed "walked", saved as
 * "walk"), so the list and the page can say so. Only for an entry added in this session, and not
 * when the entry already says it is a form of another word.
 */
export function useTypedAs(entry: Pick<VocabularyEntry, 'id' | 'term' | 'baseForm'>): string | null {
  const queryClient = useQueryClient()
  const typed = queryClient.getQueryData<string>(vocabularyKeys.typed(entry.id))
  if (!typed || entry.baseForm || sameWord(typed, entry.term)) {
    return null
  }
  return typed
}

function sameWord(first: string, second: string) {
  const normal = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase()
  return normal(first) === normal(second)
}

export function useRetryEnrichment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => retryEnrichment(id),
    onSuccess: (entry) => {
      queryClient.setQueryData(vocabularyKeys.detail(entry.id), entry)
      return queryClient.invalidateQueries({ queryKey: vocabularyKeys.lists() })
    },
    // The entry changed under us (already retried, or finished): show where it really stands.
    onError: (_error, id) => queryClient.invalidateQueries({ queryKey: vocabularyKeys.detail(id) }),
  })
}

export function useRemoveVocabulary() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => removeVocabulary(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: vocabularyKeys.detail(id) })
      // The word may also have been in today's study queue.
      void queryClient.invalidateQueries({ queryKey: ['learning'] })
      return queryClient.invalidateQueries({ queryKey: vocabularyKeys.lists() })
    },
    // Already gone, or finished in the meantime: show where it really stands.
    onError: (_error, id) => queryClient.invalidateQueries({ queryKey: vocabularyKeys.detail(id) }),
  })
}

// Adds the correct spelling and then removes the misspelled word. A word already in the list is
// not an obstacle: the misspelled one goes either way.
export function useCorrectSpelling() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, suggestion }: { id: number; suggestion: string }) => {
      let added: VocabularyEntry | undefined
      try {
        added = await createVocabulary({ term: suggestion })
      } catch (error) {
        if (!(error instanceof ApiClientError && error.status === 409)) {
          throw error
        }
      }
      await removeVocabulary(id)
      return added
    },
    onSuccess: (added, { id }) => {
      if (added) {
        queryClient.setQueryData(vocabularyKeys.detail(added.id), added)
      }
      queryClient.removeQueries({ queryKey: vocabularyKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: ['learning'] })
      return queryClient.invalidateQueries({ queryKey: vocabularyKeys.lists() })
    },
    onError: (_error, { id }) => queryClient.invalidateQueries({ queryKey: vocabularyKeys.detail(id) }),
  })
}
