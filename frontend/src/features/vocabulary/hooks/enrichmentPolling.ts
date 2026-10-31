import { useCallback, useRef } from 'react'
import type { EnrichmentStatus, VocabularyEntry, VocabularyPage } from '../types/vocabulary'
import { enrichmentPollIntervalMs, enrichmentPollWindowMs } from './pollingConfig'

export function isEnriching(status: EnrichmentStatus) {
  return status === 'PENDING' || status === 'PROCESSING'
}

export function pageHasUnfinished(page: VocabularyPage) {
  return page.content.some((entry) => isEnriching(entry.enrichmentStatus))
}

export function entryIsUnfinished(entry: VocabularyEntry) {
  return isEnriching(entry.enrichmentStatus)
}

// A TanStack Query `refetchInterval`: polls while the data still holds unfinished entries, and gives
// up after a fixed window so a stranded entry cannot keep a tab polling forever.
export function useEnrichmentRefetchInterval<TData>(hasUnfinished: (data: TData) => boolean) {
  const unfinishedSince = useRef<number | null>(null)

  return useCallback(
    (query: { state: { data: TData | undefined } }) => {
      const data = query.state.data
      if (data === undefined || !hasUnfinished(data)) {
        unfinishedSince.current = null
        return false
      }

      unfinishedSince.current ??= Date.now()
      return Date.now() - unfinishedSince.current < enrichmentPollWindowMs ? enrichmentPollIntervalMs : false
    },
    [hasUnfinished],
  )
}
