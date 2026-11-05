import { useState } from 'react'
import { BackLink } from '../../../shared/BackLink'
import { isSpeechSupported } from '../../../shared/speech/pronunciation'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { useUserToday } from '../../auth/hooks/useUserToday'
import { useVocabularyDetails } from '../../vocabulary/hooks/useVocabulary'
import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'
import { buildSoundPairs, minQuestions } from '../components/cloze'
import { PairGame } from '../components/PairGame'
import { shuffle } from '../components/matching'
import { useStudyQueue } from '../hooks/useStudy'
import type { StudiedWord } from '../types/study'

// More than the exercise needs, because a word without a usable example is left out.
const wordsToFetch = 15

const studyPage = { path: '/app/study', label: 'Back to study' }

// Sentences with a blank, and sounds that are dragged into them: the words are only heard, never shown
// (until the sound is placed), so nothing here asks for spelling. Practice only, like the other games:
// nothing is sent, so it never changes the review schedule.
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
  const [pairs] = useState(() => buildSoundPairs(entries))

  return <PairGame minimum={minQuestions} notEnough={<NotEnough />} onAgain={onAgain} pairs={pairs} sounds />
}
