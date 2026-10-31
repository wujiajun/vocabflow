import { useEffect, useRef, useState } from 'react'
import { authErrorMessage } from '../../auth/components/AuthError'
import { isEnriching } from '../hooks/enrichmentPolling'
import { useRetryEnrichment } from '../hooks/useVocabulary'
import type { VocabularyEntry } from '../types/vocabulary'

// Shows where the background enrichment of one entry stands. The status region is always rendered so
// screen readers announce changes; focus moves into it when a retry removes the button that was
// just pressed.
export function EnrichmentPanel({ entry, onCheckAgain }: { entry: VocabularyEntry; onCheckAgain: () => void }) {
  const retry = useRetryEnrichment()
  const statusRef = useRef<HTMLDivElement>(null)
  const previousStatus = useRef(entry.enrichmentStatus)
  const [finished, setFinished] = useState(false)
  const enriching = isEnriching(entry.enrichmentStatus)
  const failed = entry.enrichmentStatus === 'FAILED'
  // Said once: a refused retry often repeats the reason the entry already shows.
  const retryError = retry.isError ? authErrorMessage(retry.error, 'Unable to retry.') : undefined

  useEffect(() => {
    if (isEnriching(previousStatus.current) && entry.enrichmentStatus === 'COMPLETED') {
      setFinished(true)
    }
    previousStatus.current = entry.enrichmentStatus
  }, [entry.enrichmentStatus])

  function retryEnrichment() {
    retry.mutate(entry.id, { onSuccess: () => statusRef.current?.focus() })
  }

  return (
    <div className="mt-4">
      <div className="text-sm text-amber-800 outline-none" ref={statusRef} role="status" tabIndex={-1}>
        {enriching ? (
          <>
            <p>Filling in the details… this usually takes a few seconds.</p>
            <button className="mt-1 font-semibold underline underline-offset-4" onClick={onCheckAgain} type="button">
              Check now
            </button>
          </>
        ) : finished && entry.enrichmentStatus === 'COMPLETED' ? (
          <p className="sr-only">Details are ready.</p>
        ) : null}
      </div>
      {failed ? (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          <p>
            The details couldn’t be filled in. {entry.failureReason ? `${entry.failureReason}.` : null} You can still
            keep this word.
          </p>
          {retryError && retryError !== entry.failureReason ? <p className="mt-1 font-semibold">{retryError}</p> : null}
          <button
            aria-disabled={retry.isPending}
            className="mt-2 font-semibold underline underline-offset-4"
            onClick={() => {
              if (!retry.isPending) {
                retryEnrichment()
              }
            }}
            type="button"
          >
            {retry.isPending ? 'Retrying…' : 'Retry details'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
