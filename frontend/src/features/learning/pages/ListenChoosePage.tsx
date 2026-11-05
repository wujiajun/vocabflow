import { useEffect, useRef, useState } from 'react'
import { BackLink } from '../../../shared/BackLink'
import { playWrong } from '../../../shared/sound/effects'
import { isSpeechSupported, speakText } from '../../../shared/speech/pronunciation'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { useUserToday } from '../../auth/hooks/useUserToday'
import { useVocabularyDetails } from '../../vocabulary/hooks/useVocabulary'
import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'
import { buildListenQuestions, type ListenQuestion, minListenQuestions } from '../components/listening'
import { shuffle } from '../components/matching'
import { useStudyQueue } from '../hooks/useStudy'
import type { StudiedWord } from '../types/study'

// A few words may turn out to have no usable meaning, so a little more than the game needs is fetched.
const wordsToFetch = 14

const studyPage = { path: '/app/study', label: 'Back to study' }

const primaryButton =
  'min-h-11 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700'

// Practice only, like the other games: nothing is sent, so it never changes the review schedule. The
// word is only heard; its spelling is shown after the answer.
export function ListenChoosePage() {
  usePageTitle('Listen and choose')
  const queue = useStudyQueue(useUserToday())
  const [game, setGame] = useState(0)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Listen and choose</h1>
        <BackLink fallback={studyPage} />
      </div>
      <div className="mt-3">
        {!isSpeechSupported() ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
            This device cannot read words aloud, so this exercise is not available here.
          </p>
        ) : queue.isPending ? (
          <p className="text-sm text-slate-600" role="status">
            Loading today’s words…
          </p>
        ) : queue.isError ? (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            {authErrorMessage(queue.error, 'Unable to load today’s words.')}
          </p>
        ) : queue.data.studiedToday.length < minListenQuestions ? (
          <NotEnough />
        ) : (
          <Loaded key={game} onAgain={() => setGame((current) => current + 1)} studied={queue.data.studiedToday} />
        )}
      </div>
    </div>
  )
}

function NotEnough() {
  return (
    <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
      Study at least {minListenQuestions} words today to practise this.
    </p>
  )
}

function Loaded({ studied, onAgain }: { studied: StudiedWord[]; onAgain: () => void }) {
  const [ids] = useState(() => shuffle(studied).slice(0, wordsToFetch).map((word) => word.userVocabularyId))
  const details = useVocabularyDetails(ids)

  if (details.some((detail) => detail.isPending)) {
    return (
      <p className="text-sm text-slate-600" role="status">
        Getting your words ready…
      </p>
    )
  }

  const entries = details.flatMap((detail) => (detail.data ? [detail.data] : []))
  if (entries.length === 0) {
    const failure = details.find((detail) => detail.isError)
    return (
      <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
        {authErrorMessage(failure?.error, 'Unable to load today’s words.')}
      </p>
    )
  }

  return <Game entries={entries} onAgain={onAgain} />
}

interface Answered {
  term: string
  right: boolean
  seconds: number
}

function Game({ entries, onAgain }: { entries: VocabularyEntry[]; onAgain: () => void }) {
  const [questions] = useState(() => buildListenQuestions(entries))
  const [started, setStarted] = useState(false)
  const [position, setPosition] = useState(0)
  const [answers, setAnswers] = useState<Answered[]>([])

  if (questions.length < minListenQuestions) {
    return <NotEnough />
  }

  // Speech may start only from a press, so the first word waits for this one.
  if (!started) {
    return (
      <section aria-label="Start" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
        <p className="text-sm leading-6 text-slate-700">
          You will hear {questions.length} of today’s words, one at a time. Pick the meaning you hear as fast as you can.
        </p>
        <button className={`mt-4 ${primaryButton}`} onClick={() => setStarted(true)} type="button">
          Start
        </button>
      </section>
    )
  }

  if (position >= questions.length) {
    return <Summary answers={answers} onAgain={onAgain} />
  }

  return (
    <Question
      key={position}
      last={position + 1 === questions.length}
      number={position + 1}
      onDone={(answer) => {
        setAnswers((current) => [...current, answer])
        setPosition((current) => current + 1)
      }}
      question={questions[position]}
      total={questions.length}
    />
  )
}

function say(term: string) {
  speakText(term, { onStart: () => {}, onEnd: () => {} })
}

function Question({
  question,
  number,
  total,
  last,
  onDone,
}: {
  question: ListenQuestion
  number: number
  total: number
  last: boolean
  onDone: (answer: Answered) => void
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const shownAt = useRef(Date.now())
  const seconds = useRef(0)
  const nextRef = useRef<HTMLButtonElement>(null)

  // Mounted by a press (Start or Next), where the browser lets a voice begin.
  useEffect(() => {
    say(question.term)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (picked !== null) {
      nextRef.current?.focus()
    }
  }, [picked])

  function pick(index: number) {
    if (picked !== null) {
      return
    }
    seconds.current = (Date.now() - shownAt.current) / 1000
    setPicked(index)
    if (index !== question.correct) {
      playWrong()
    }
  }

  return (
    <section aria-label={`Question ${number} of ${total}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
      <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">
        Question {number} of {total}
      </h2>
      <p className="mt-3 text-lg font-medium text-slate-900">What does the word you heard mean?</p>
      <button
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-900 transition hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
        onClick={() => say(question.term)}
        type="button"
      >
        Hear it again
      </button>

      <div aria-label="Meanings" className="mt-4 flex flex-col gap-2" role="group">
        {question.options.map((option, index) => {
          const state =
            picked === null
              ? 'border-slate-300 hover:bg-slate-50 active:bg-slate-100'
              : index === question.correct
                ? 'border-emerald-400 bg-emerald-50 text-emerald-950'
                : index === picked
                  ? 'border-rose-400 bg-rose-50 text-rose-950'
                  : 'border-slate-200 text-slate-500'
          return (
            <button
              aria-disabled={picked !== null}
              className={`min-h-11 rounded-lg border px-4 py-3 text-left text-sm leading-6 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 ${state}`}
              key={index}
              onClick={() => pick(index)}
              type="button"
            >
              {option}
            </button>
          )
        })}
      </div>

      {picked !== null ? (
        <div className="mt-4">
          <p className={`text-sm font-semibold ${picked === question.correct ? 'text-emerald-800' : 'text-rose-800'}`} role="status">
            {picked === question.correct ? 'Correct!' : 'Not quite.'} The word was “{question.term}”.
          </p>
          <button
            className={`mt-3 ${primaryButton}`}
            onClick={() => onDone({ term: question.term, right: picked === question.correct, seconds: seconds.current })}
            ref={nextRef}
            type="button"
          >
            {last ? 'See results' : 'Next'}
          </button>
        </div>
      ) : null}
    </section>
  )
}

function Summary({ answers, onAgain }: { answers: Answered[]; onAgain: () => void }) {
  const right = answers.filter((answer) => answer.right)
  const missed = answers.filter((answer) => !answer.right).map((answer) => answer.term)
  const average = right.length > 0 ? right.reduce((sum, answer) => sum + answer.seconds, 0) / right.length : null
  const slowest = [...right].sort((first, second) => second.seconds - first.seconds)[0]

  return (
    <section aria-label="Results" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
      <h2 className="text-xl font-bold tracking-tight">
        {right.length === answers.length ? 'Perfect!' : 'Nicely done!'} {right.length} of {answers.length} right
      </h2>
      {average !== null ? (
        <p className="mt-2 text-sm text-slate-700">
          The right answers took {average.toFixed(1)} seconds on average
          {slowest && right.length > 1 ? `; the slowest was “${slowest.term}”, ${slowest.seconds.toFixed(1)} seconds` : ''}.
        </p>
      ) : null}
      {missed.length > 0 ? <p className="mt-2 text-sm text-slate-700">Worth another look: {missed.join(', ')}.</p> : null}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button className={primaryButton} onClick={onAgain} type="button">
          Play again
        </button>
        <BackLink
          className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
          fallback={studyPage}
        >
          Back to study
        </BackLink>
      </div>
    </section>
  )
}
