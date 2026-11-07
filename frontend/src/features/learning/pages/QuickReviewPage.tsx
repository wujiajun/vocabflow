import { useState } from 'react'
import { hasEnoughWords, wordsPerRound, minGameWords, notEnoughWords, pickGameWordIds } from '../gameWords'
import { BackLink } from '../../../shared/BackLink'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { useUserToday } from '../../auth/hooks/useUserToday'
import { useVocabularyDetails } from '../../vocabulary/hooks/useVocabulary'
import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'
import { PairGame } from '../components/PairGame'
import { buildPairs, shuffle } from '../components/matching'
import { useStudyQueue } from '../hooks/useStudy'
import type { StudyQueue } from '../types/study'

const studyPage = { path: '/app/study', label: 'Back to study' }

// Practice only: nothing here is sent to the server, so it never changes what comes back for review.
export function QuickReviewPage() {
  usePageTitle('Quick review')
  const queue = useStudyQueue(useUserToday())
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
          <Loaded key={game} onAgain={() => setGame((current) => current + 1)} queue={queue.data} />
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

// Fetches the meanings of a sample of the words (today's first, see `pickGameWordIds`), and starts the game once they are in. The sample
// and the game are fixed at that point, so words studied or refreshed meanwhile do not reshuffle them.
function Loaded({ queue, onAgain }: { queue: StudyQueue; onAgain: () => void }) {
  const [ids] = useState(() => pickGameWordIds(queue))
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
        {authErrorMessage(failure?.error, 'Unable to load your words.')}
      </p>
    )
  }

  return <Game entries={entries} onAgain={onAgain} />
}

function Game({ entries, onAgain }: { entries: VocabularyEntry[]; onAgain: () => void }) {
  const [pairs] = useState(() => shuffle(buildPairs(entries).slice(0, wordsPerRound)))

  return <PairGame
      intro={{
        icon: '🧩',
        title: 'Ready to match?',
        text: ({ words, rounds }) =>
          `Drag each of these ${words} words onto its meaning, in ${rounds === 1 ? 'one round' : `${rounds} rounds`}. A word that goes right the first time keeps your streak going.`,
      }}
      minimum={minGameWords}
      notEnough={<NoDistinctMeanings />}
      onAgain={onAgain}
      pairs={pairs}
    />
}
