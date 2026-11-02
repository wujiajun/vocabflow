import { useState } from 'react'
import { Link } from 'react-router'
import { getGameSound, setGameSound } from '../../../shared/sound/effects'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { useUserToday } from '../../auth/hooks/useUserToday'
import { useVocabularyDetails } from '../../vocabulary/hooks/useVocabulary'
import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'
import { MatchRound, type RoundResult } from '../components/MatchRound'
import { buildPairs, minPairs, planRounds, shuffle } from '../components/matching'
import { useStudyQueue } from '../hooks/useStudy'
import type { StudiedWord } from '../types/study'

// A few words may turn out to have no usable meaning, so a little more than the game needs is fetched.
const wordsToFetch = 12

const backLink = (
  <Link className="text-sm font-semibold text-indigo-700 underline underline-offset-4" to="/app/study">
    ← Back to study
  </Link>
)

// Practice only: nothing here is sent to the server, so it never changes what comes back for review.
export function QuickReviewPage() {
  usePageTitle('Quick review')
  const queue = useStudyQueue(useUserToday())
  const [game, setGame] = useState(0)

  return (
    // The page gives every screen a generous top margin; on a phone this one needs the height.
    <div className="-mt-4 sm:mt-0">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Quick review</h1>
        {backLink}
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
        ) : queue.data.studiedToday.length < minPairs ? (
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
      Study at least {minPairs} words today to play this game.
    </p>
  )
}

// Fetches the meanings of a sample of today's words, and starts the game once they are in. The sample
// and the game are fixed at that point, so words studied or refreshed meanwhile do not reshuffle them.
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
  const [rounds] = useState(() => planRounds(buildPairs(shuffle(entries))))
  const [round, setRound] = useState(0)
  const [results, setResults] = useState<RoundResult[]>([])

  if (rounds.length === 0 || rounds.flat().length < minPairs) {
    return <NotEnough />
  }

  if (round >= rounds.length) {
    return <Summary onAgain={onAgain} results={results} />
  }

  return (
    <section aria-label={`Round ${round + 1} of ${rounds.length}`} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-7">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">
          Round {round + 1} of {rounds.length}
        </h2>
        <SoundSwitch />
      </div>
      <MatchRound
        continueLabel={round + 1 < rounds.length ? 'Next round' : 'See results'}
        key={round}
        onContinue={(result) => {
          setResults((current) => [...current, result])
          setRound((current) => current + 1)
        }}
        pairs={rounds[round]}
      />
    </section>
  )
}

// Wrong answers buzz, which not everyone wants: a choice kept in this browser.
function SoundSwitch() {
  const [on, setOn] = useState(getGameSound)

  return (
    <label className="flex w-fit items-center gap-2 text-sm text-slate-700">
      <input
        checked={on}
        className="size-4 accent-indigo-700"
        onChange={(event) => {
          setOn(event.target.checked)
          setGameSound(event.target.checked)
        }}
        type="checkbox"
      />
      Sound effects
    </label>
  )
}

function Summary({ results, onAgain }: { results: RoundResult[]; onAgain: () => void }) {
  const total = results.reduce((sum, result) => sum + result.total, 0)
  const firstTry = results.reduce((sum, result) => sum + result.firstTry, 0)
  const missed = results.flatMap((result) => result.missed)

  return (
    <section aria-label="Results" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-xl font-bold tracking-tight">
        {firstTry === total ? 'Perfect!' : 'Nicely done!'} {firstTry} of {total} on the first try
      </h2>
      {missed.length > 0 ? (
        <p className="mt-2 text-sm text-slate-700">Worth another look: {missed.join(', ')}.</p>
      ) : null}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
          onClick={onAgain}
          type="button"
        >
          Play again
        </button>
        <Link
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
          to="/app/study"
        >
          Back to study
        </Link>
      </div>
    </section>
  )
}
