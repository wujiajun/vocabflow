import { type ReactNode, useState } from 'react'
import { BackLink } from '../../../shared/BackLink'
import { MatchRound, type RoundResult } from './MatchRound'
import { type MatchPair, planRounds } from './matching'

const studyPage = { path: '/app/study', label: 'Back to study' }

// The rounds of a matching game and its results, shared by the quick review (words onto meanings) and
// the sound exercise (sounds onto sentences). Nothing here is sent anywhere.
export function PairGame({
  pairs,
  minimum,
  notEnough,
  sounds = false,
  onAgain,
}: {
  pairs: MatchPair[]
  minimum: number
  notEnough: ReactNode
  sounds?: boolean
  onAgain: () => void
}) {
  const [rounds] = useState(() => planRounds(pairs))
  const [round, setRound] = useState(0)
  const [results, setResults] = useState<RoundResult[]>([])

  if (rounds.length === 0 || rounds.flat().length < minimum) {
    return notEnough
  }

  if (round >= rounds.length) {
    return <Summary onAgain={onAgain} results={results} />
  }

  return (
    <section aria-label={`Round ${round + 1} of ${rounds.length}`} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-7">
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-slate-600 uppercase">
        Round {round + 1} of {rounds.length}
      </h2>
      <MatchRound
        continueLabel={round + 1 < rounds.length ? 'Next round' : 'See results'}
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

function Summary({ results, onAgain }: { results: RoundResult[]; onAgain: () => void }) {
  const total = results.reduce((sum, result) => sum + result.total, 0)
  const firstTry = results.reduce((sum, result) => sum + result.firstTry, 0)
  const missed = results.flatMap((result) => result.missed)

  return (
    <section aria-label="Results" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
      <h2 className="text-xl font-bold tracking-tight">
        {firstTry === total ? 'Perfect!' : 'Nicely done!'} {firstTry} of {total} on the first try
      </h2>
      {missed.length > 0 ? <p className="mt-2 text-sm text-slate-700">Worth another look: {missed.join(', ')}.</p> : null}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
          onClick={onAgain}
          type="button"
        >
          Play again
        </button>
        <BackLink
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
          fallback={studyPage}
        >
          Back to study
        </BackLink>
      </div>
    </section>
  )
}
