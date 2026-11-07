import { useEffect, useRef, useState } from 'react'
import { hasEnoughWords, minGameWords, notEnoughWords,  } from '../gameWords'
import { BackLink } from '../../../shared/BackLink'
import { playRight, playWrong } from '../../../shared/sound/effects'
import { isSpeechSupported, speakText } from '../../../shared/speech/pronunciation'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { useUserToday } from '../../auth/hooks/useUserToday'
import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'
import { GameProgress, GameStart, ScorePills, Stars, gamePrimaryButton } from '../components/GameParts'
import { buildListenQuestions, type ListenQuestion } from '../components/listening'
import { GameLoader } from '../components/GameLoader'
import { useRecordPlays } from '../hooks/useGameWords'
import { useStudyQueue } from '../hooks/useStudy'

const studyPage = { path: '/app/study', label: 'Back to study' }

const primaryButton = gamePrimaryButton

// Practice only, like the other games: nothing is sent, so it never changes the review schedule. The
// word is only heard; its spelling is shown after the answer.
export function ListenChoosePage() {
  usePageTitle('Listen and choose')
  const today = useUserToday()
  const queue = useStudyQueue(today)
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
            Loading your words…
          </p>
        ) : queue.isError ? (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            {authErrorMessage(queue.error, 'Unable to load your words.')}
          </p>
        ) : !hasEnoughWords(queue.data) ? (
          <NotEnough />
        ) : (
          <GameLoader
            date={today}
            key={game}
            render={(entries) => <Game entries={entries} onAgain={() => setGame((current) => current + 1)} />}
          />
        )}
      </div>
    </div>
  )
}

function NotEnough() {
  return (
    <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
      {notEnoughWords}
    </p>
  )
}

interface Answered {
  term: string
  right: boolean
  seconds: number
}

const letters = ['A', 'B', 'C', 'D']

function Speaker({ size }: { size: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size}>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  )
}

function Game({ entries, onAgain }: { entries: VocabularyEntry[]; onAgain: () => void }) {
  const [questions] = useState(() => buildListenQuestions(entries))
  // The words this round really uses, so the next rounds rotate away from them.
  useRecordPlays(questions.map((question) => question.id))
  const [started, setStarted] = useState(false)
  const [position, setPosition] = useState(0)
  const [answers, setAnswers] = useState<Answered[]>([])

  if (questions.length < minGameWords) {
    // Words that share a meaning count once, so four words studied can still be too few to choose between.
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
        Your words do not have {minGameWords} different meanings to choose between yet. Study a few more words and try again.
      </p>
    )
  }

  // Speech may start only from a press, so the first word waits for this one.
  if (!started) {
    return (
      <GameStart
        icon="🎧"
        onStart={() => setStarted(true)}
        text={`You will hear ${questions.length} of today’s words, one at a time. Pick the meaning you hear as fast as you can.`}
        title="Ready to listen?"
      />
    )
  }

  if (position >= questions.length) {
    return <Summary answers={answers} onAgain={onAgain} />
  }

  let streak = 0
  for (let index = answers.length - 1; index >= 0 && answers[index].right; index -= 1) {
    streak += 1
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
      score={answers.filter((answer) => answer.right).length}
      streak={streak}
      total={questions.length}
    />
  )
}

function Question({
  question,
  number,
  total,
  last,
  score,
  streak,
  onDone,
}: {
  question: ListenQuestion
  number: number
  total: number
  last: boolean
  score: number
  streak: number
  onDone: (answer: Answered) => void
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const shownAt = useRef(Date.now())
  const seconds = useRef(0)
  const nextRef = useRef<HTMLButtonElement>(null)
  const playTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const answered = picked !== null
  const right = picked === question.correct
  // The score and the streak move the moment an answer is given, not when Next is pressed.
  const shownScore = score + (answered && right ? 1 : 0)
  const shownStreak = answered ? (right ? streak + 1 : 0) : streak

  function play() {
    setPlaying(true)
    // Some browsers never report the end of a word, so the glow does not outlast a few seconds.
    clearTimeout(playTimer.current)
    playTimer.current = setTimeout(() => setPlaying(false), 3000)
    speakText(question.term, {
      onStart: () => setPlaying(true),
      onEnd: () => {
        clearTimeout(playTimer.current)
        setPlaying(false)
      },
    })
  }

  // Mounted by a press (Start or Next), where the browser lets a voice begin.
  useEffect(() => {
    play()
    return () => clearTimeout(playTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (answered) {
      nextRef.current?.focus()
    }
  }, [answered])

  function pick(index: number) {
    if (answered) {
      return
    }
    seconds.current = (Date.now() - shownAt.current) / 1000
    setPicked(index)
    if (index === question.correct) {
      playRight()
    } else {
      playWrong()
    }
  }

  return (
    <section aria-label={`Question ${number} of ${total}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">
          Question {number} of {total}
        </h2>
        <ScorePills score={shownScore} scoreLabel="right so far" streak={shownStreak} />
      </div>
      <GameProgress max={total} value={number - 1 + (answered ? 1 : 0)} />

      <div className="mt-6 flex flex-col items-center">
        <div className="relative">
          {playing ? <span aria-hidden="true" className="absolute inset-0 rounded-full bg-indigo-300 opacity-60 motion-safe:animate-ping" /> : null}
          <button
            aria-label="Hear it again"
            className="relative flex size-24 items-center justify-center rounded-full bg-indigo-700 text-white shadow-lg transition hover:bg-indigo-800 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-700"
            onClick={play}
            type="button"
          >
            <Speaker size={40} />
          </button>
        </div>
        <p aria-hidden="true" className="mt-2 text-sm font-medium text-slate-600">
          Hear it again
        </p>
        <p className="mt-4 text-center text-lg font-semibold text-slate-900">What does the word you heard mean?</p>
      </div>

      <div aria-label="Meanings" className="mt-4 flex flex-col gap-2.5" role="group">
        {question.options.map((option, index) => {
          const isCorrect = index === question.correct
          const isWrongPick = answered && index === picked && !isCorrect
          const state = !answered
            ? 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 active:bg-indigo-100'
            : isCorrect
              ? 'border-emerald-500 bg-emerald-50 text-emerald-950 motion-safe:animate-pop'
              : isWrongPick
                ? 'border-rose-500 bg-rose-50 text-rose-950 motion-safe:animate-shake'
                : 'border-slate-200 bg-white text-slate-400'
          return (
            <button
              aria-disabled={answered}
              className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-3 py-3 text-left text-sm leading-6 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 ${state}`}
              key={index}
              onClick={() => pick(index)}
              type="button"
            >
              <span
                aria-hidden="true"
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  answered && isCorrect ? 'bg-emerald-500 text-white' : isWrongPick ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {answered && isCorrect ? '✓' : isWrongPick ? '✕' : letters[index]}
              </span>
              <span className="min-w-0 flex-1">{option}</span>
            </button>
          )
        })}
      </div>

      {/* Stays at the bottom of the screen, so the result and Next are in reach however tall the options are. */}
      <div
        className={`sticky bottom-0 z-10 -mx-4 mt-5 -mb-4 rounded-b-2xl border-t px-4 py-3 backdrop-blur sm:-mx-7 sm:-mb-7 sm:px-7 ${
          !answered ? 'border-slate-200 bg-white/95' : right ? 'border-emerald-200 bg-emerald-50/95' : 'border-rose-200 bg-rose-50/95'
        }`}
      >
        <p
          className={`text-sm font-semibold ${!answered ? 'font-normal text-slate-600' : right ? 'text-emerald-900' : 'text-rose-900'}`}
          role="status"
        >
          {!answered ? 'Pick the meaning of the word you heard.' : `${right ? 'Correct!' : 'Not quite.'} The word was “${question.term}”.`}
        </p>
        {answered ? (
          <>
            {right ? <p className="text-xs text-emerald-900">⚡ {seconds.current.toFixed(1)} seconds</p> : null}
            <button
              className={`mt-2 w-full ${primaryButton}`}
              onClick={() => onDone({ term: question.term, right, seconds: seconds.current })}
              ref={nextRef}
              type="button"
            >
              {last ? 'See results' : 'Next'}
            </button>
          </>
        ) : null}
      </div>
    </section>
  )
}

function Summary({ answers, onAgain }: { answers: Answered[]; onAgain: () => void }) {
  const right = answers.filter((answer) => answer.right)
  const missed = answers.filter((answer) => !answer.right).map((answer) => answer.term)
  const average = right.length > 0 ? right.reduce((sum, answer) => sum + answer.seconds, 0) / right.length : null
  const slowest = [...right].sort((first, second) => second.seconds - first.seconds)[0]
  const share = answers.length > 0 ? right.length / answers.length : 0

  return (
    <section aria-label="Results" className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-8">
      <Stars share={share} />
      <h2 className="mt-3 text-xl font-bold tracking-tight">
        {right.length === answers.length ? 'Perfect!' : 'Nicely done!'} {right.length} of {answers.length} right
      </h2>
      {average !== null ? (
        <p className="mt-2 text-sm text-slate-700">
          ⚡ The right answers took {average.toFixed(1)} seconds on average
          {slowest && right.length > 1 ? `; the slowest was “${slowest.term}”, ${slowest.seconds.toFixed(1)} seconds` : ''}.
        </p>
      ) : null}
      {missed.length > 0 ? <p className="mt-2 text-sm text-slate-700">Worth another look: {missed.join(', ')}.</p> : null}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
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
