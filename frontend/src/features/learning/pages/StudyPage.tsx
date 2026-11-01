import { useState } from 'react'
import { usePageTitle } from '../../../shared/usePageTitle'
import { useUserToday } from '../../auth/hooks/useUserToday'
import { authErrorMessage } from '../../auth/components/AuthError'
import { StudyCardView } from '../components/StudyCardView'
import { StudyComplete } from '../components/StudyComplete'
import { StudyProgress } from '../components/StudyProgress'
import { useStudyQueue } from '../hooks/useStudy'

export function StudyPage() {
  usePageTitle('Study')
  const date = useUserToday()
  const queue = useStudyQueue(date)
  const [reviewedAny, setReviewedAny] = useState(false)

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Study</h1>
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
          <StudyProgress queue={queue.data} />
          {queue.data.unavailableCount > 0 ? (
            <p className="mt-1 text-sm text-slate-600">
              {queue.data.unavailableCount === 1
                ? '1 word isn’t ready to study yet.'
                : `${queue.data.unavailableCount} words aren’t ready to study yet.`}
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
              <StudyComplete
                date={date}
                onStudyMore={() => setReviewedAny(true)}
                queue={queue.data}
                takeFocus={reviewedAny}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
