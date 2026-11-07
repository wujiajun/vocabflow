import { useEffect, useMemo, useRef, useState } from 'react'
import { BackLink } from '../../../shared/BackLink'
import { playRight, playWrong } from '../../../shared/sound/effects'
import { isSpeechSupported, speakText } from '../../../shared/speech/pronunciation'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { useUserToday } from '../../auth/hooks/useUserToday'
import { useVocabularyDetails } from '../../vocabulary/hooks/useVocabulary'
import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'
import { GameProgress, GameStart, ScorePills, Stars, gamePrimaryButton } from '../components/GameParts'
import { shuffle } from '../components/matching'
import { SpellSlots } from '../components/SpellSlots'
import {
  applyInput,
  buildSpellItems,
  check,
  isComplete,
  lettersOf,
  minSpellWords,
  slotsFor,
  starsFor,
  type SpellItem,
} from '../components/spelling'
import { useStudyQueue } from '../hooks/useStudy'
import type { StudiedWord } from '../types/study'

// A few words may turn out to have no usable meaning, so a little more than the game needs is fetched.
const wordsToFetch = 10

const studyPage = { path: '/app/study', label: 'Back to study' }

// Practice only, like the other games: nothing is sent, so it never changes the review schedule. The word is
// never shown: it is heard, its meaning is read, and its memory hook can be opened.
export function SpellItPage() {
  usePageTitle('Spell it')
  const queue = useStudyQueue(useUserToday())
  const [game, setGame] = useState(0)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Spell it</h1>
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
        ) : queue.data.studiedToday.length < minSpellWords ? (
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
      Study at least {minSpellWords} words today to practise this.
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

interface Result {
  term: string
  stars: number
  skipped: boolean
}

function Game({ entries, onAgain }: { entries: VocabularyEntry[]; onAgain: () => void }) {
  const [items] = useState(() => buildSpellItems(entries))
  const [started, setStarted] = useState(false)
  const [position, setPosition] = useState(0)
  const [results, setResults] = useState<Result[]>([])

  if (items.length < minSpellWords) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
        Today’s words do not have {minSpellWords} that can be spelled with a meaning yet. Study a few more words and try again.
      </p>
    )
  }

  if (!started) {
    return (
      <GameStart
        icon="✍️"
        onStart={() => setStarted(true)}
        text={`${items.length} of today’s words, one at a time. Hear the word, read what it means, and spell it letter by letter. A wrong letter turns red until you fix it.`}
        title="Ready to spell?"
      />
    )
  }

  if (position >= items.length) {
    return <Summary onAgain={onAgain} results={results} />
  }

  return (
    <Word
      item={items[position]}
      key={position}
      last={position + 1 === items.length}
      number={position + 1}
      onDone={(result) => {
        setResults((current) => [...current, result])
        setPosition((current) => current + 1)
      }}
      stars={results.reduce((sum, result) => sum + result.stars, 0)}
      total={items.length}
    />
  )
}

function Speaker() {
  return (
    <svg aria-hidden="true" fill="none" height="28" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="28">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  )
}

const secondaryButton =
  'min-h-11 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 aria-disabled:opacity-50'

function Word({
  item,
  number,
  total,
  last,
  stars,
  onDone,
}: {
  item: SpellItem
  number: number
  total: number
  last: boolean
  stars: number
  onDone: (result: Result) => void
}) {
  const slots = useMemo(() => slotsFor(item.term), [item.term])
  const answer = useMemo(() => lettersOf(item.term), [item.term])
  const [typed, setTyped] = useState<string[]>([])
  const [mistakes, setMistakes] = useState(0)
  const [hints, setHints] = useState(0)
  const [skipped, setSkipped] = useState(false)
  const [hookOpen, setHookOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const playTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const done = isComplete(answer, typed)
  const finished = done || skipped
  const wrongNow = check(answer, typed).filter((right) => !right).length
  const hasHook = Boolean(item.emoji || item.scene || item.parts)
  const earned = done ? starsFor({ mistakes, hints, skipped: false }) : 0

  function play() {
    setPlaying(true)
    clearTimeout(playTimer.current)
    playTimer.current = setTimeout(() => setPlaying(false), 3000)
    speakText(item.term, {
      onStart: () => setPlaying(true),
      onEnd: () => {
        clearTimeout(playTimer.current)
        setPlaying(false)
      },
    })
  }

  // Mounted by a press (Start or Next), where the browser lets a voice begin and the keyboard open.
  useEffect(() => {
    if (isSpeechSupported()) {
      play()
    }
    inputRef.current?.focus()
    return () => clearTimeout(playTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(next: string[]) {
    setTyped(next)
    if (isComplete(answer, next)) {
      playRight()
      // The keyboard goes, so the button that moves on is not behind it.
      inputRef.current?.blur()
    }
  }

  function type(value: string) {
    if (finished) {
      return
    }
    const next = applyInput(typed, value, answer.length)
    if (next.length > typed.length) {
      const added = check(answer, next).slice(typed.length)
      const wrong = added.filter((right) => !right).length
      if (wrong > 0) {
        setMistakes((current) => current + wrong)
        playWrong()
      }
    }
    finish(next)
  }

  // Keeps what is right, drops the first wrong letter and what follows, and writes the next letter.
  function showLetter() {
    if (finished) {
      return
    }
    const right = check(answer, typed)
    const firstWrong = right.indexOf(false)
    const keep = firstWrong === -1 ? typed : typed.slice(0, firstWrong)
    setHints((current) => current + 1)
    finish([...keep, answer[keep.length]])
    inputRef.current?.focus()
  }

  function skip() {
    setSkipped(true)
    inputRef.current?.blur()
  }

  const status = done
    ? `Correct! ${earned === 3 ? 'No mistakes.' : mistakes > 0 ? `${mistakes} wrong ${mistakes === 1 ? 'letter' : 'letters'}.` : ''} The word is “${item.term}”.`
    : skipped
      ? `Skipped. The word was “${item.term}”.`
      : wrongNow > 0
        ? 'A red letter is wrong. Delete it and try again.'
        : 'Type the word you heard.'

  return (
    <section aria-label={`Word ${number} of ${total}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">
          Word {number} of {total}
        </h2>
        <ScorePills score={stars + earned} scoreLabel="stars so far" streak={0} />
      </div>
      <GameProgress max={total} value={number - 1 + (finished ? 1 : 0)} />

      <div className="mt-5 flex items-start gap-3">
        {isSpeechSupported() ? (
          <div className="relative shrink-0">
            {playing ? <span aria-hidden="true" className="absolute inset-0 rounded-full bg-indigo-300 opacity-60 motion-safe:animate-ping" /> : null}
            <button
              aria-label="Hear it again"
              className="relative flex size-14 items-center justify-center rounded-full bg-indigo-700 text-white shadow-md transition hover:bg-indigo-800 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-700"
              onClick={play}
              type="button"
            >
              <Speaker />
            </button>
          </div>
        ) : null}
        <p className="min-w-0 flex-1 text-base leading-6 font-medium text-slate-900">{item.definition}</p>
      </div>

      {hasHook ? (
        hookOpen ? (
          <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-3" role="region" aria-label="Memory hook">
            {item.emoji ? <p className="text-3xl leading-none">{item.emoji}</p> : null}
            {item.scene ? <p className="mt-2 text-sm leading-6 font-medium text-indigo-950">{item.scene}</p> : null}
            {item.parts ? (
              <p className="mt-2 text-sm leading-6 text-indigo-900">
                <span className="font-semibold">Word parts: </span>
                {item.parts}
              </p>
            ) : null}
          </div>
        ) : (
          <button className={`mt-3 ${secondaryButton}`} onClick={() => setHookOpen(true)} type="button">
            💡 Memory hook
          </button>
        )
      ) : null}

      <div className="mt-6">
        <SpellSlots
          answer={answer}
          done={done}
          inputRef={inputRef}
          label="Type the word"
          onType={type}
          revealed={skipped}
          slots={slots}
          typed={typed}
        />
      </div>

      {!finished ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          <button className={secondaryButton} onClick={showLetter} onMouseDown={(event) => event.preventDefault()} type="button">
            Show a letter (−1 ⭐)
          </button>
          <button className={secondaryButton} onClick={skip} onMouseDown={(event) => event.preventDefault()} type="button">
            Skip
          </button>
        </div>
      ) : null}

      {/* Stays at the bottom of the screen, so the result and Next are in reach. */}
      <div
        className={`sticky bottom-0 z-10 -mx-4 mt-5 -mb-4 rounded-b-2xl border-t px-4 py-3 backdrop-blur sm:-mx-7 sm:-mb-7 sm:px-7 ${
          done ? 'border-emerald-200 bg-emerald-50/95' : skipped ? 'border-amber-200 bg-amber-50/95' : wrongNow > 0 ? 'border-rose-200 bg-rose-50/95' : 'border-slate-200 bg-white/95'
        }`}
      >
        <p
          className={`text-sm ${done ? 'font-semibold text-emerald-900' : skipped ? 'font-semibold text-amber-900' : wrongNow > 0 ? 'font-semibold text-rose-900' : 'text-slate-600'}`}
          role="status"
        >
          {status}
        </p>
        {done ? <p aria-hidden="true" className="text-lg">{'⭐'.repeat(earned)}</p> : null}
        {finished ? (
          <button
            className={`mt-2 w-full ${gamePrimaryButton}`}
            onClick={() => onDone({ term: item.term, stars: earned, skipped })}
            type="button"
          >
            {last ? 'See results' : 'Next'}
          </button>
        ) : null}
      </div>
    </section>
  )
}

function Summary({ results, onAgain }: { results: Result[]; onAgain: () => void }) {
  const earned = results.reduce((sum, result) => sum + result.stars, 0)
  const skipped = results.filter((result) => result.skipped).map((result) => result.term)
  const shaky = results.filter((result) => !result.skipped && result.stars < 3).map((result) => result.term)
  const share = results.length > 0 ? earned / (results.length * 3) : 0

  return (
    <section aria-label="Results" className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-8">
      <Stars share={share} />
      <h2 className="mt-3 text-xl font-bold tracking-tight">
        {earned === results.length * 3 ? 'Perfect!' : 'Nicely done!'} {earned} of {results.length * 3} stars
      </h2>
      {shaky.length > 0 ? <p className="mt-2 text-sm text-slate-700">Worth another look: {shaky.join(', ')}.</p> : null}
      {skipped.length > 0 ? <p className="mt-2 text-sm text-slate-700">Skipped: {skipped.join(', ')}.</p> : null}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button className={gamePrimaryButton} onClick={onAgain} type="button">
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
