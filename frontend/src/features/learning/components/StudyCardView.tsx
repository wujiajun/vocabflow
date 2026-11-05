import { useEffect, useRef, useState } from 'react'
import { getCardStart } from '../../../shared/cardStart'
import { getSpeakOnAnswer, getSpeakOnCard } from '../../../shared/speech/autoSpeak'
import { PronounceButton } from '../../../shared/speech/PronounceButton'
import { isSpeechSupported, speakText } from '../../../shared/speech/pronunciation'
import { authErrorMessage } from '../../auth/components/AuthError'
import { describeKind } from '../../vocabulary/components/formatVocabulary'
import { BaseFormNote } from '../../vocabulary/components/BaseFormNote'
import { SenseTabs } from '../../vocabulary/components/SenseTabs'
import { useSubmitReview } from '../hooks/useStudy'
import type { Rating, StudyCard } from '../types/study'
import { formatInterval } from './formatInterval'
import { maskTerm } from './matching'

// The two small actions on a card that is asked from a picture or a sound sit in one row, the same
// height and width, so they line up on a phone.
const actionButton =
  'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700'
const tintedAction = `${actionButton} border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100`
const plainAction = `${actionButton} border-slate-300 bg-white text-slate-800 hover:bg-slate-50 aria-disabled:cursor-default aria-disabled:border-slate-200 aria-disabled:text-slate-400 aria-disabled:hover:bg-white`

const ratingLabels: Record<Rating, string> = { AGAIN: 'Again', HARD: 'Hard', GOOD: 'Good', EASY: 'Easy' }

const ratingStyles: Record<Rating, string> = {
  AGAIN: 'border-rose-300 text-rose-800 hover:bg-rose-50 active:bg-rose-100',
  HARD: 'border-amber-300 text-amber-900 hover:bg-amber-50 active:bg-amber-100',
  GOOD: 'border-emerald-300 text-emerald-800 hover:bg-emerald-50 active:bg-emerald-100',
  EASY: 'border-indigo-300 text-indigo-800 hover:bg-indigo-50 active:bg-indigo-100',
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
  const [hintShown, setHintShown] = useState(false)
  // A word with a memory hook can be asked as a picture first (which word is this?), or the word can
  // be only heard (what does it mean?), as chosen in Settings. Without a hook, or on a device that
  // cannot speak, the card shows the word as before.
  const [start] = useState(getCardStart)
  // Each review asks a different meaning of a word that has several, in turn, so that the second and
  // third are practised too: the card's version counts its ratings.
  const hooked = card.senses.flatMap((sense, index) => (sense.emoji || sense.scene ? [index] : []))
  const cueIndex = hooked.length > 0 ? hooked[card.version % hooked.length] : undefined
  const cue = cueIndex === undefined ? undefined : card.senses[cueIndex]
  const cueing = start === 'picture' && cue !== undefined && !revealed
  const listening = start === 'sound' && isSpeechSupported() && !revealed
  const hintRef = useRef<HTMLParagraphElement>(null)
  // On a card that starts with the sound, the hints come one at a time: the picture, then the scene.
  const [soundHints, setSoundHints] = useState(0)
  const soundHintRef = useRef<HTMLDivElement>(null)
  const hintSteps = (cue?.emoji ? 1 : 0) + (cue?.scene ? 1 : 0)
  const review = useSubmitReview()
  const termRef = useRef<HTMLHeadingElement>(null)
  const answerRef = useRef<HTMLDivElement>(null)
  // A word can be said differently in different meanings ("lead"), so every distinct one is shown.
  const phonetics =
    [...new Set((card.senses.length > 0 ? card.senses.map((sense) => sense.phonetic) : [card.phonetic]).filter(Boolean))].join(' · ') ||
    null
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

  useEffect(() => {
    if (soundHints > 0) {
      soundHintRef.current?.focus()
    }
  }, [soundHints])

  useEffect(() => {
    if (hintShown) {
      hintRef.current?.focus()
    }
  }, [hintShown])

  // Browsers let speech start only once the page has been pressed, and the learner has by the time a
  // card is up (a link or a rating got them here). A page opened straight on this card may stay silent
  // until the first press; the button beside the word says it again.
  useEffect(() => {
    // Not when the word is the answer to be recalled: it is said with the answer. When only heard it
    // is always said, whatever the choice about reading the word aloud.
    if (listening || (!cueing && isSpeechSupported() && getSpeakOnCard())) {
      speakText(card.term, { onStart: () => {}, onEnd: () => {} })
    }
    // Only on mount: a card kept after a failed save must not be read again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Showing the answer is a press, which is where speech is always allowed to start.
  function showAnswer() {
    setRevealed(true)
    if (isSpeechSupported() && getSpeakOnAnswer()) {
      speakText(card.term, { onStart: () => {}, onEnd: () => {} })
    }
  }

  function rate(rating: Rating) {
    if (review.isPending) {
      return
    }
    // Not a callback on the mutation: this card may be gone by the time the request settles.
    onRate()
    review.mutate({ userVocabularyId: card.userVocabularyId, rating, version: card.version, date })
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
      {listening ? (
        <div>
          <h2 className="text-xl font-bold tracking-tight outline-none" ref={termRef} tabIndex={-1}>
            Listen: what does this word mean?
          </h2>
          {cueIndex !== undefined && card.senses.length > 1 ? (
            <p className="mt-1 text-sm text-slate-600">
              This time: meaning {cueIndex + 1} of {card.senses.length}
            </p>
          ) : null}
          <div className={`mt-4 grid gap-3 ${hintSteps > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <button className={tintedAction} onClick={() => speakText(card.term, { onStart: () => {}, onEnd: () => {} })} type="button">
              <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
                <path d="M11 5 6 9H3v6h3l5 4V5Z" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                <path d="M18.5 5.5a9 9 0 0 1 0 13" />
              </svg>
              Hear it again
            </button>
            {hintSteps > 0 ? (
              <button
                aria-disabled={soundHints >= hintSteps}
                className={plainAction}
                onClick={() => {
                  if (soundHints < hintSteps) {
                    setSoundHints((current) => current + 1)
                  }
                }}
                type="button"
              >
                <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
                  <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                </svg>
                {soundHints === 0 ? 'Show a hint' : soundHints < hintSteps ? 'Another hint' : 'No hints left'}
              </button>
            ) : null}
          </div>
          {soundHints > 0 && cue ? (
            <div className="mt-4 rounded-xl bg-indigo-50 px-4 py-3 outline-none" ref={soundHintRef} tabIndex={-1}>
              {cue.emoji ? <p className="text-4xl leading-none">{cue.emoji}</p> : null}
              {cue.scene && soundHints >= (cue.emoji ? 2 : 1) ? (
                <p className={`${cue.emoji ? 'mt-3 ' : ''}text-lg leading-7 font-medium text-indigo-950`}>
                  {maskTerm(cue.scene, [card.term, card.baseForm])}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : cueing ? (
        <div>
          <h2 className="text-xl font-bold tracking-tight outline-none" ref={termRef} tabIndex={-1}>
            Which word is this?
          </h2>
          {cue.emoji ? <p className="mt-3 text-5xl leading-none">{cue.emoji}</p> : null}
          {cue.scene && (hintShown || !cue.emoji) ? (
            <p className="mt-3 rounded-xl bg-indigo-50 px-4 py-3 text-lg leading-7 font-medium text-indigo-950 outline-none" ref={hintRef} tabIndex={-1}>
              {maskTerm(cue.scene, [card.term, card.baseForm])}
            </p>
          ) : null}
          {cue.scene && cue.emoji && !hintShown ? (
            <button className={`mt-4 ${tintedAction}`} onClick={() => setHintShown(true)} type="button">
              Show a hint
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="min-w-0 text-3xl font-bold tracking-tight outline-none [overflow-wrap:anywhere]" ref={termRef} tabIndex={-1}>
            {card.term}
          </h2>
          <PronounceButton term={card.term} />
        </div>
      )}
      {/* Before the answer, so it can be said aloud with the word; after it, each meaning shows its own. */}
      {!revealed && !cueing && !listening && phonetics ? (
        <p className="mt-1 text-base text-slate-600">
          <span className="sr-only">Pronunciation: </span>
          {phonetics}
        </p>
      ) : null}

      {revealed ? (
        <>
          <div className="mt-4 outline-none" ref={answerRef} tabIndex={-1}>
            <BaseFormNote baseForm={card.baseForm} className="mb-1" />
            {kind ? <p className="mb-2 text-sm text-slate-600">{kind}</p> : null}
            <SenseTabs headingLevel="h3" initial={start === 'word' ? undefined : cueIndex} senses={card.senses} speakExamples />
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
          className="mt-6 min-h-11 w-full rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 active:bg-indigo-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
          onClick={showAnswer}
          type="button"
        >
          Show answer
        </button>
      )}
    </article>
  )
}
