import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { backState } from '../../../shared/navigation'
import { authErrorMessage } from '../../auth/components/AuthError'
import { formatLearningStatus } from '../../vocabulary/components/formatVocabulary'
import { useStudyMore } from '../hooks/useStudy'
import type { StudyQueue } from '../types/study'

// Shown when no card is due: the day is complete, a learning step is still to come, or there is
// nothing to study yet.
export function StudyComplete({
  queue,
  date,
  takeFocus,
  onStudyMore,
}: {
  queue: StudyQueue
  date: string
  takeFocus: boolean
  onStudyMore: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const more = useStudyMore()

  // Only on mount: pressing "Study more" must leave focus on the button if the request fails.
  useEffect(() => {
    if (takeFocus) {
      headingRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function studyMore() {
    if (more.isPending) {
      return
    }
    onStudyMore()
    more.mutate(date)
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-xl font-bold tracking-tight outline-none" ref={headingRef} tabIndex={-1}>
        {heading(queue)}
      </h2>
      {queue.nextDueAt ? (
        <p className="mt-2 text-sm text-slate-600">
          The next card comes back at{' '}
          {new Date(queue.nextDueAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.
        </p>
      ) : null}

      {queue.studiedToday.length > 0 ? (
        <section aria-label="Studied today" className="mt-5">
          <h3 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">Studied today</h3>
          <ul className="mt-2 divide-y divide-slate-100">
            {queue.studiedToday.map((word) => (
              <li className="flex items-baseline justify-between gap-4 py-2" key={word.userVocabularyId}>
                <Link
                  className="min-w-0 font-semibold text-slate-900 underline-offset-4 [overflow-wrap:anywhere] hover:underline"
                  state={backState('/app/study', 'Back to study')}
                  to={`/app/vocabulary/${word.userVocabularyId}`}
                >
                  {word.term}
                </Link>
                <span className="shrink-0 text-sm text-slate-600">{formatLearningStatus(word.learningStatus)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {more.isError ? (
        <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {authErrorMessage(more.error, 'Unable to add more words. Please try again.')}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {queue.moreNewWords ? (
          <button
            aria-disabled={more.isPending}
            className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
            onClick={studyMore}
            type="button"
          >
            {more.isPending ? 'Adding words…' : 'Study more new words'}
          </button>
        ) : null}
        <Link
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
          to="/app/vocabulary"
        >
          Add new words
        </Link>
        <Link
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
          to="/app/settings"
        >
          Change daily goal
        </Link>
      </div>
    </div>
  )
}

function heading(queue: StudyQueue) {
  if (queue.finished) {
    return 'Today’s study is complete'
  }
  return queue.nextDueAt ? 'Nothing is due right now' : 'Nothing to study yet'
}
