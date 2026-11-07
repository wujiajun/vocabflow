import { useState } from 'react'
import { hasEnoughWords, minGameWords, notEnoughWords, pickGameWordIds } from '../gameWords'
import { BackLink } from '../../../shared/BackLink'
import { isSpeechSupported } from '../../../shared/speech/pronunciation'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { useUserToday } from '../../auth/hooks/useUserToday'
import { useVocabularyDetails } from '../../vocabulary/hooks/useVocabulary'
import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'
import { buildSoundPairs } from '../components/cloze'
import { PairGame } from '../components/PairGame'
import { useStudyQueue } from '../hooks/useStudy'
import type { StudyQueue } from '../types/study'

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

function NotEnough() {
  return (
    <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
      {notEnoughWords}
    </p>
  )
}

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
  const [pairs] = useState(() => buildSoundPairs(entries))

  return <PairGame
      intro={{
        icon: '🎯',
        title: 'Ready to fill in the blanks?',
        text: ({ words, rounds }) =>
          `Tap a numbered sound to hear a word, then drag it onto the sentence it fits: ${words} sentences in ${rounds === 1 ? 'one round' : `${rounds} rounds`}. No word is shown until you place it.`,
      }}
      minimum={minGameWords}
      notEnough={<NotEnough />}
      onAgain={onAgain}
      pairs={pairs}
      sounds
    />
}
