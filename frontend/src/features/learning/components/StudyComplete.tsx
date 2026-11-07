import { useContext, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { backState } from '../../../shared/navigation'
import { isSpeechSupported } from '../../../shared/speech/pronunciation'
import { authErrorMessage } from '../../auth/components/AuthError'
import { WriteReading } from '../../reading/components/WriteReading'
import { formatLearningStatus } from '../../vocabulary/components/formatVocabulary'
import { WordTapContext } from '../../vocabulary/components/wordTapContext'
import { useStudyMore } from '../hooks/useStudy'
import type { StudyQueue } from '../types/study'
import { minQuestions } from './cloze'
import { minListenQuestions } from './listening'
import { minPairs } from './matching'
import { minSpellWords } from './spelling'

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
  const [listOpen, setListOpen] = useState(false)
  const listId = useId()
  const addWord = useContext(WordTapContext)

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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
      <h2 className="text-xl font-bold tracking-tight outline-none" ref={headingRef} tabIndex={-1}>
        {heading(queue)}
      </h2>
      {queue.nextDueAt ? (
        <p className="mt-2 text-sm text-slate-600">
          The next card comes back at{' '}
          {new Date(queue.nextDueAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.
        </p>
      ) : null}

      {queue.goalShortfall > 0 && !queue.moreNewWords ? (
        <p className="mt-2 text-sm text-slate-600">
          {queue.goalShortfall === 1
            ? 'Add 1 more word to reach today’s goal.'
            : `Add ${queue.goalShortfall} more words to reach today’s goal.`}
        </p>
      ) : null}

      {queue.studiedToday.length > 0 ? (
        // Folded by default: a long list would push the buttons below it off the first screen.
        <section aria-label="Studied today" className="mt-5">
          <h3 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">
            <button
              aria-controls={listId}
              aria-expanded={listOpen}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left tracking-wide uppercase transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
              onClick={() => setListOpen((open) => !open)}
              type="button"
            >
              <span>Studied today · {queue.studiedToday.length}</span>
              <span className="text-xs font-semibold tracking-normal text-indigo-700 normal-case">
                {listOpen ? 'Hide' : 'Show'}
              </span>
            </button>
          </h3>
          <ul className="mt-2 divide-y divide-slate-100" hidden={!listOpen} id={listId}>
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

      {queue.finished ? <WriteReading date={date} /> : null}

      {more.isError ? (
        <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {authErrorMessage(more.error, 'Unable to add more words. Please try again.')}
        </p>
      ) : null}

      <GameMenu
        games={[
          { show: queue.studiedToday.length >= minPairs, to: '/app/study/review', icon: '🧩', title: 'Quick review game', about: 'Drag words onto their meanings', tone: 'indigo' },
          { show: queue.studiedToday.length >= minQuestions && isSpeechSupported(), to: '/app/study/fill', icon: '🎯', title: 'Fill in the blank', about: 'Drop the right sound into the blank', tone: 'amber' },
          { show: queue.studiedToday.length >= minListenQuestions && isSpeechSupported(), to: '/app/study/listen', icon: '🎧', title: 'Listen and choose', about: 'Hear a word, pick its meaning', tone: 'emerald' },
          { show: queue.studiedToday.length >= minSpellWords, to: '/app/study/spell', icon: '✍️', title: 'Spell it', about: 'Hear it, read its meaning, type the letters', tone: 'rose' },
        ]}
      />

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
        {/* Only when there is nothing more to study: with words waiting, "Study more" is the way on. The
            panel is the same as the "+ Add" in the tabs, so the learner stays on this page. */}
        {addWord && !queue.moreNewWords ? (
          <button
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
            data-opens-word-sheet=""
            onClick={() => addWord.open()}
            type="button"
          >
            Add new words
          </button>
        ) : null}
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

const tones = {
  indigo: 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200',
  amber: 'border-amber-200 bg-amber-50 hover:bg-amber-100 active:bg-amber-200',
  emerald: 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200',
  rose: 'border-rose-200 bg-rose-50 hover:bg-rose-100 active:bg-rose-200',
} as const

interface Game {
  show: boolean
  to: string
  icon: string
  title: string
  about: string
  tone: keyof typeof tones
}

// The practice games as a small menu: each is a tile with its own icon and colour, so they read as
// games to play and not as three more buttons. A game that cannot be played now (too few words, or no
// voice on this device) is left out, and so is the whole menu when none can.
function GameMenu({ games }: { games: Game[] }) {
  const id = useId()
  const available = games.filter((game) => game.show)
  if (available.length === 0) {
    return null
  }

  return (
    <section aria-label="Games" className="mt-6">
      <h3 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">Play a game</h3>
      <ul className="mt-2 grid gap-2 sm:grid-cols-3">
        {available.map((game, index) => (
          <li key={game.to}>
            <Link
              aria-describedby={`${id}-${index}-about`}
              aria-labelledby={`${id}-${index}-title`}
              className={`flex min-h-16 items-center gap-3 rounded-2xl border p-3 transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 sm:h-full sm:flex-col sm:items-start ${tones[game.tone]}`}
              state={backState('/app/study', 'Back to study')}
              to={game.to}
            >
              <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
                {game.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-base font-bold tracking-tight text-slate-900" id={`${id}-${index}-title`}>
                  {game.title}
                </span>
                <span className="block text-sm leading-5 text-slate-700" id={`${id}-${index}-about`}>
                  {game.about}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
