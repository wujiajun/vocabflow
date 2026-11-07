import { useState } from 'react'
import { hasEnoughWords, wordsPerRound, minGameWords, notEnoughWords } from '../gameWords'
import { BackLink } from '../../../shared/BackLink'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { useUserToday } from '../../auth/hooks/useUserToday'
import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'
import { PairGame } from '../components/PairGame'
import { buildPairs, shuffle } from '../components/matching'
import { GameLoader } from '../components/GameLoader'
import { useRecordPlays } from '../hooks/useGameWords'
import { useStudyQueue } from '../hooks/useStudy'

const studyPage = { path: '/app/study', label: 'Back to study' }

// Practice only: nothing here is sent to the server, so it never changes what comes back for review.
export function QuickReviewPage() {
  usePageTitle('Quick review')
  const today = useUserToday()
  const queue = useStudyQueue(today)
  const [game, setGame] = useState(0)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Quick review</h1>
        <BackLink fallback={studyPage} />
      </div>
      <div className="mt-3">
        {queue.isPending ? (
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

// Words that share a meaning count once, so five words studied can still be too few to match.
function NoDistinctMeanings() {
  return (
    <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
      Your words do not have {minGameWords} different meanings to match yet. Study a few more words and try again.
    </p>
  )
}

function NotEnough() {
  return (
    <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
      {notEnoughWords}
    </p>
  )
}

function Game({ entries, onAgain }: { entries: VocabularyEntry[]; onAgain: () => void }) {
  const [pairs] = useState(() => shuffle(buildPairs(entries).slice(0, wordsPerRound)))
  // The words this round really uses, so the next rounds rotate away from them.
  useRecordPlays(pairs.map((pair) => pair.id))

  return <PairGame
      intro={{
        icon: '🧩',
        title: 'Ready to match?',
        text: ({ words, rounds }) =>
          `Drag each of these ${words} words onto its meaning, in ${rounds === 1 ? 'one round' : `${rounds} rounds`}. A word that goes right the first time keeps your streak going.`,
      }}
      minimum={minGameWords}
      notEnough={<NoDistinctMeanings />}
      game="quick-review"
      onAgain={onAgain}
      pairs={pairs}
    />
}
