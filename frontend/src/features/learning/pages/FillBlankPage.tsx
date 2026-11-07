import { useState } from 'react'
import { hasEnoughWords, minGameWords, notEnoughWords,  } from '../gameWords'
import { BackLink } from '../../../shared/BackLink'
import { isSpeechSupported } from '../../../shared/speech/pronunciation'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { useUserToday } from '../../auth/hooks/useUserToday'
import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'
import { buildSoundPairs } from '../components/cloze'
import { PairGame } from '../components/PairGame'
import { GameLoader } from '../components/GameLoader'
import { useRecordPlays } from '../hooks/useGameWords'
import { useStudyQueue } from '../hooks/useStudy'

const studyPage = { path: '/app/study', label: 'Back to study' }

// Sentences with a blank, and sounds that are dragged into them: the words are only heard, never shown
// (until the sound is placed), so nothing here asks for spelling. Practice only, like the other games:
// nothing is sent, so it never changes the review schedule.
export function FillBlankPage() {
  usePageTitle('Fill in the blank')
  const today = useUserToday()
  const queue = useStudyQueue(today)
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

function Game({ entries, onAgain }: { entries: VocabularyEntry[]; onAgain: () => void }) {
  const [pairs] = useState(() => buildSoundPairs(entries))
  // The words this round really uses, so the next rounds rotate away from them.
  useRecordPlays(pairs.map((pair) => pair.id))

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
