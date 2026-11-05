import { type FormEvent, useEffect, useRef, useState } from 'react'
import { BackLink } from '../../../shared/BackLink'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { useUserToday } from '../../auth/hooks/useUserToday'
import { useVocabularyDetails } from '../../vocabulary/hooks/useVocabulary'
import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'
import { blank, type BlankQuestion, buildBlanks, isRight, minQuestions } from '../components/cloze'
import { shuffle } from '../components/matching'
import { useStudyQueue } from '../hooks/useStudy'
import type { StudiedWord } from '../types/study'

// More than the game needs, because a word without a usable example is left out.
const wordsToFetch = 15

const studyPage = { path: '/app/study', label: 'Back to study' }

// Practice only, like the quick review game: nothing is sent, so it never changes the review schedule.
export function FillBlankPage() {
  usePageTitle('Fill in the blank')
  const queue = useStudyQueue(useUserToday())
  const [game, setGame] = useState(0)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Fill in the blank</h1>
        <BackLink fallback={studyPage} />
      </div>
      <div className="mt-3">
        {queue.isPending ? (
          <p className="text-sm text-slate-600" role="status">
            Loading today’s words…
          </p>
        ) : queue.isError ? (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            {authErrorMessage(queue.error, 'Unable to load today’s words.')}
          </p>
        ) : queue.data.studiedToday.length < minQuestions ? (
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
      Study at least {minQuestions} words today, with example sentences, to practise this.
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

function Game({ entries, onAgain }: { entries: VocabularyEntry[]; onAgain: () => void }) {
  const [questions] = useState(() => buildBlanks(entries))
  const [position, setPosition] = useState(0)
  const [missed, setMissed] = useState<string[]>([])

  if (questions.length < minQuestions) {
    return <NotEnough />
  }

  if (position >= questions.length) {
    return <Summary missed={missed} onAgain={onAgain} total={questions.length} />
  }

  return (
    <Question
      key={position}
      last={position + 1 === questions.length}
      number={position + 1}
      onDone={(right) => {
        if (!right) {
          setMissed((current) => [...current, questions[position].term])
        }
        setPosition((current) => current + 1)
      }}
      question={questions[position]}
      total={questions.length}
    />
  )
}

function Question({
  question,
  number,
  total,
  last,
  onDone,
}: {
  question: BlankQuestion
  number: number
  total: number
  last: boolean
  onDone: (right: boolean) => void
}) {
  const [answer, setAnswer] = useState('')
  const [right, setRight] = useState<boolean | null>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (right !== null) {
      nextRef.current?.focus()
    }
  }, [right])

  function check(event: FormEvent) {
    event.preventDefault()
    if (right === null && answer.trim() !== '') {
      setRight(isRight(answer, question))
    }
  }

  return (
    <section aria-label={`Question ${number} of ${total}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
      <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">
        Question {number} of {total}
      </h2>
      <p className="mt-3 text-xl leading-8 font-medium text-slate-900">
        {question.before}
        {right === null ? (
          <span aria-label="blank">{blank}</span>
        ) : (
          <mark className={`rounded px-1 ${right ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>{question.form}</mark>
        )}
        {question.after}
      </p>
      <p className="mt-3 rounded-xl bg-indigo-50 px-4 py-3 text-sm leading-6 text-indigo-950">
        {question.emoji ? <span className="mr-2 text-2xl align-middle">{question.emoji}</span> : null}
        <span className="font-semibold">Meaning: </span>
        {question.meaning}
      </p>

      <form className="mt-4" onSubmit={check}>
        <label className="block text-sm font-medium text-slate-800" htmlFor="fill-answer">
          Your answer
        </label>
        <div className="mt-2 flex gap-2">
          <input
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
            id="fill-answer"
            onChange={(event) => setAnswer(event.target.value)}
            readOnly={right !== null}
            spellCheck={false}
            type="text"
            value={answer}
          />
          {right === null ? (
            <button
              className="shrink-0 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
              type="submit"
            >
              Check
            </button>
          ) : null}
        </div>
      </form>

      {right !== null ? (
        <div className="mt-4">
          <p className={`text-sm font-semibold ${right ? 'text-emerald-800' : 'text-rose-800'}`} role="status">
            {right ? 'Correct!' : `Not quite. The word is “${question.form}”.`}
          </p>
          <button
            className="mt-3 min-h-11 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
            onClick={() => onDone(right)}
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

function Summary({ missed, total, onAgain }: { missed: string[]; total: number; onAgain: () => void }) {
  const right = total - missed.length

  return (
    <section aria-label="Results" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
      <h2 className="text-xl font-bold tracking-tight">
        {right === total ? 'Perfect!' : 'Nicely done!'} {right} of {total} right
      </h2>
      {missed.length > 0 ? <p className="mt-2 text-sm text-slate-700">Worth another look: {missed.join(', ')}.</p> : null}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          className="min-h-11 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
          onClick={onAgain}
          type="button"
        >
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
