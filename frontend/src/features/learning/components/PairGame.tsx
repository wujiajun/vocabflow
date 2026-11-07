import { type ReactNode, useState } from 'react'
import { BackLink } from '../../../shared/BackLink'
import { useRecordRound } from '../hooks/useGameRounds'
import type { GameId } from '../api/gameRoundsApi'
import { GameStart, Stars, gamePrimaryButton } from './GameParts'
import { starsForShare } from '../starsForShare'
import { MatchRound, type RoundResult } from './MatchRound'
import { type MatchPair, planRounds } from './matching'

const studyPage = { path: '/app/study', label: 'Back to study' }

export interface GameIntro {
  icon: string
  title: string
  text: (size: { words: number; rounds: number }) => string
}

// The start screen, the rounds of a matching game and its results, shared by the quick review (words
// onto meanings) and the sound exercise (sounds onto sentences). Score, streak and progress run on from
// round to round. Nothing here is sent anywhere.
export function PairGame({
  pairs,
  minimum,
  notEnough,
  intro,
  sounds = false,
  onAgain,
  game,
}: {
  pairs: MatchPair[]
  minimum: number
  notEnough: ReactNode
  intro: GameIntro
  sounds?: boolean
  onAgain: () => void
  game: GameId
}) {
  const [rounds] = useState(() => planRounds(pairs))
  const [started, setStarted] = useState(false)
  const [round, setRound] = useState(0)
  const [results, setResults] = useState<RoundResult[]>([])

  if (rounds.length === 0 || rounds.flat().length < minimum) {
    return notEnough
  }

  const total = rounds.flat().length

  if (!started) {
    return <GameStart icon={intro.icon} onStart={() => setStarted(true)} text={intro.text({ words: total, rounds: rounds.length })} title={intro.title} />
  }

  if (round >= rounds.length) {
    return <Summary game={game} onAgain={onAgain} results={results} />
  }

  const before = {
    placed: results.reduce((sum, result) => sum + result.total, 0),
    firstTry: results.reduce((sum, result) => sum + result.firstTry, 0),
    streak: results.at(-1)?.streak ?? 0,
    total,
  }

  return (
    <section aria-label={`Round ${round + 1} of ${rounds.length}`} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-7">
      <MatchRound
        before={before}
        continueLabel={round + 1 < rounds.length ? 'Next round' : 'See results'}
        heading={`Round ${round + 1} of ${rounds.length}`}
        key={round}
        onContinue={(result) => {
          setResults((current) => [...current, result])
          setRound((current) => current + 1)
        }}
        pairs={rounds[round]}
        sounds={sounds}
      />
    </section>
  )
}

function Summary({ results, onAgain, game }: { results: RoundResult[]; onAgain: () => void; game: GameId }) {
  const total = results.reduce((sum, result) => sum + result.total, 0)
  const firstTry = results.reduce((sum, result) => sum + result.firstTry, 0)
  const missed = results.flatMap((result) => result.missed)
  const longest = Math.max(0, ...results.map((result) => result.bestStreak))
  useRecordRound(({ game, stars: starsForShare(total > 0 ? firstTry / total : 0), mistakes: total - firstTry, wordCount: total }))

  return (
    <section aria-label="Results" className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-8">
      <Stars share={total > 0 ? firstTry / total : 0} />
      <h2 className="mt-3 text-xl font-bold tracking-tight">
        {firstTry === total ? 'Perfect!' : 'Nicely done!'} {firstTry} of {total} on the first try
      </h2>
      {longest >= 2 ? <p className="mt-2 text-sm text-slate-700">🔥 Longest streak: {longest} in a row.</p> : null}
      {missed.length > 0 ? <p className="mt-2 text-sm text-slate-700">Worth another look: {missed.join(', ')}.</p> : null}
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
