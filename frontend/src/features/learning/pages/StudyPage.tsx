import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { usePageTitle } from '../../../shared/usePageTitle'
import { useToday } from '../../../shared/useToday'
import { authErrorMessage } from '../../auth/components/AuthError'
import { StudyCardView } from '../components/StudyCardView'
import { useStudyQueue } from '../hooks/useStudy'
import type { StudyQueue } from '../types/study'

export function StudyPage() {
  usePageTitle('Study')
  const date = useToday()
  const queue = useStudyQueue(date)
  const [reviewedAny, setReviewedAny] = useState(false)

  return (
    <div>
      <Link className="text-sm font-semibold text-indigo-700 underline underline-offset-4" to="/app/today">
        ← Back to today’s plan
      </Link>
      <h1 className="mt-5 text-3xl font-bold tracking-tight">Study</h1>
      {queue.isPending ? (
        <p className="mt-6 text-sm text-slate-600" role="status">
          Loading your cards…
        </p>
      ) : queue.isError ? (
        <div className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          <p>{authErrorMessage(queue.error, 'Unable to load your cards.')}</p>
          <button
            className="mt-2 font-semibold underline underline-offset-4"
            disabled={queue.isFetching}
            onClick={() => void queue.refetch()}
            type="button"
          >
            {queue.isFetching ? 'Trying again…' : 'Try again'}
          </button>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-600">
            {queue.data.learningCount} learning · {queue.data.reviewCount} to review · {queue.data.newCount} new
          </p>
          {queue.data.unavailableCount > 0 ? (
            <p className="mt-1 text-sm text-slate-600">
              {queue.data.unavailableCount === 1
                ? '1 word is waiting for its details.'
                : `${queue.data.unavailableCount} words are waiting for their details.`}
            </p>
          ) : null}
          <div className="mt-6">
            {queue.data.nextCard ? (
              <StudyCardView
                card={queue.data.nextCard}
                date={date}
                key={`${queue.data.nextCard.userVocabularyId}-${queue.data.nextCard.version}`}
                onRate={() => setReviewedAny(true)}
                takeFocus={reviewedAny}
              />
            ) : (
              <Finished queue={queue.data} reviewedAny={reviewedAny} />
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Finished({ queue, reviewedAny }: { queue: StudyQueue; reviewedAny: boolean }) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (reviewedAny) {
      headingRef.current?.focus()
    }
  }, [reviewedAny])

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-600">
      <h2 className="text-base font-semibold text-slate-900 outline-none" ref={headingRef} tabIndex={-1}>
        {reviewedAny ? 'You’re done for now' : 'Nothing to study right now'}
      </h2>
      {queue.nextDueAt ? (
        <p className="mt-1">
          The next card comes back at{' '}
          {new Date(queue.nextDueAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.
        </p>
      ) : (
        <p className="mt-1">
          Reviews come back when they are due.{' '}
          <Link className="font-semibold text-indigo-700 underline underline-offset-4" to="/app/vocabulary">
            Go to your vocabulary
          </Link>
        </p>
      )}
    </div>
  )
}
