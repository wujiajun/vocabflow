import { useEffect, useRef, useState } from 'react'
import { authErrorMessage } from '../../auth/components/AuthError'
import { isEnriching } from '../hooks/enrichmentPolling'
import { useRemoveVocabulary, useRetryEnrichment } from '../hooks/useVocabulary'
import type { VocabularyEntry } from '../types/vocabulary'

// Shows where the background enrichment of one entry stands. The status region is always rendered so
// screen readers announce changes; focus moves into it when a retry removes the button that was
// just pressed.
export function EnrichmentPanel({
  entry,
  onCheckAgain,
  onRemoved,
}: {
  entry: VocabularyEntry
  onCheckAgain: () => void
  onRemoved: () => void
}) {
  const retry = useRetryEnrichment()
  const remove = useRemoveVocabulary()
  const statusRef = useRef<HTMLDivElement>(null)
  const previousStatus = useRef(entry.enrichmentStatus)
  const [finished, setFinished] = useState(false)
  const enriching = isEnriching(entry.enrichmentStatus)
  const failed = entry.enrichmentStatus === 'FAILED'
  // Said once: a refused retry often repeats the reason the entry already shows.
  const retryError = retry.isError ? authErrorMessage(retry.error, 'Unable to retry.') : undefined
  const removeError = remove.isError ? authErrorMessage(remove.error, 'Unable to remove this word.') : undefined

  useEffect(() => {
    if (isEnriching(previousStatus.current) && entry.enrichmentStatus === 'COMPLETED') {
      setFinished(true)
    }
    previousStatus.current = entry.enrichmentStatus
  }, [entry.enrichmentStatus])

  function retryEnrichment() {
    retry.mutate(entry.id, { onSuccess: () => statusRef.current?.focus() })
  }

  function removeWord() {
    if (!remove.isPending) {
      remove.mutate(entry.id, { onSuccess: onRemoved })
    }
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
            The details couldn’t be filled in. {entry.failureReason ? `${entry.failureReason}.` : null} You can try again
            or remove this word.
          </p>
          {retryError && retryError !== entry.failureReason ? <p className="mt-1 font-semibold">{retryError}</p> : null}
          {removeError ? <p className="mt-1 font-semibold">{removeError}</p> : null}
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
          <button
            aria-disabled={remove.isPending}
            className="mt-2 ml-5 font-semibold underline underline-offset-4"
            onClick={removeWord}
            type="button"
          >
            {remove.isPending ? 'Removing…' : 'Remove word'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
