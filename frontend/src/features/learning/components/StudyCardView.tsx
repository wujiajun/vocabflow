import { useEffect, useRef, useState } from 'react'
import { PronounceButton } from '../../../shared/speech/PronounceButton'
import { authErrorMessage } from '../../auth/components/AuthError'
import { describeKind } from '../../vocabulary/components/formatVocabulary'
import { BaseFormNote } from '../../vocabulary/components/BaseFormNote'
import { SenseTabs } from '../../vocabulary/components/SenseTabs'
import { useSubmitReview } from '../hooks/useStudy'
import type { Rating, StudyCard } from '../types/study'
import { formatInterval } from './formatInterval'

const ratingLabels: Record<Rating, string> = { AGAIN: 'Again', HARD: 'Hard', GOOD: 'Good', EASY: 'Easy' }

const ratingStyles: Record<Rating, string> = {
  AGAIN: 'border-rose-300 text-rose-800 hover:bg-rose-50',
  HARD: 'border-amber-300 text-amber-900 hover:bg-amber-50',
  GOOD: 'border-emerald-300 text-emerald-800 hover:bg-emerald-50',
  EASY: 'border-indigo-300 text-indigo-800 hover:bg-indigo-50',
}

// Remounted for every card and version, so a returning card starts hidden again. Focus follows the
// flow, because the button just pressed disappears: to the answer on revealing it, and to the term
// when the next card arrives.
export function StudyCardView({
  card,
  date,
  takeFocus,
  onRate,
}: {
  card: StudyCard
  date: string
  takeFocus: boolean
  onRate: () => void
}) {
  const [revealed, setRevealed] = useState(false)
  const review = useSubmitReview()
  const termRef = useRef<HTMLHeadingElement>(null)
  const answerRef = useRef<HTMLDivElement>(null)
  const kind = describeKind(card.type, card.senses.length > 1 ? null : card.partOfSpeech)

  // Only on mount: a card kept after a failed save must leave focus on the button pressed.
  useEffect(() => {
    if (takeFocus) {
      termRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (revealed) {
      answerRef.current?.focus()
    }
  }, [revealed])

  function rate(rating: Rating) {
    if (review.isPending) {
      return
    }
    // Not a callback on the mutation: this card may be gone by the time the request settles.
    onRate()
    review.mutate({ userVocabularyId: card.userVocabularyId, rating, version: card.version, date })
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="min-w-0 text-3xl font-bold tracking-tight outline-none [overflow-wrap:anywhere]" ref={termRef} tabIndex={-1}>
          {card.term}
        </h2>
        <PronounceButton term={card.term} />
      </div>

      {revealed ? (
        <>
          <div className="mt-4 outline-none" ref={answerRef} tabIndex={-1}>
            <BaseFormNote baseForm={card.baseForm} className="mb-1" />
            {kind ? <p className="mb-2 text-sm text-slate-600">{kind}</p> : null}
            <SenseTabs headingLevel="h3" senses={card.senses} />
          </div>

          {review.isError ? (
            <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
              {authErrorMessage(review.error, 'Unable to save your answer. Please try again.')}
            </p>
          ) : null}

          <div aria-label="How well did you remember it?" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group">
            {card.options.map((option) => (
              <button
                aria-disabled={review.isPending}
                className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 ${ratingStyles[option.rating]}`}
                key={option.rating}
                onClick={() => rate(option.rating)}
                type="button"
              >
                {ratingLabels[option.rating]}
                <span className="block text-xs font-normal">{formatInterval(option)}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <button
          className="mt-6 w-full rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
          onClick={() => setRevealed(true)}
          type="button"
        >
          Show answer
        </button>
      )}
    </article>
  )
}
