import { useState, type ReactNode } from 'react'
import { authErrorMessage } from '../../auth/components/AuthError'
import { useVocabularyDetails } from '../../vocabulary/hooks/useVocabulary'
import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'
import { pickGameWordIds } from '../gameWords'
import { useGameWords } from '../hooks/useGameWords'

// Asks the server which words this round should draw from, fetches their meanings, and starts the game
// once they are in. The words are fixed at that point, so words studied or refreshed meanwhile do not
// reshuffle them. Mounted again for each round, so every round asks for a fresh ranking.
export function GameLoader({ date, render }: { date: string; render: (entries: VocabularyEntry[]) => ReactNode }) {
  const ranked = useGameWords(date)

  if (ranked.isPending) {
    return <Status>Getting your words ready…</Status>
  }
  if (ranked.isError) {
    return <Failure message={authErrorMessage(ranked.error, 'Unable to load your words.')} />
  }
  return <Details ids={pickGameWordIds(ranked.data.wordIds)} render={render} />
}

function Details({ ids: initial, render }: { ids: number[]; render: (entries: VocabularyEntry[]) => ReactNode }) {
  const [ids] = useState(initial)
  const details = useVocabularyDetails(ids)

  if (details.some((detail) => detail.isPending)) {
    return <Status>Getting your words ready…</Status>
  }

  const entries = details.flatMap((detail) => (detail.data ? [detail.data] : []))
  if (entries.length === 0) {
    const failure = details.find((detail) => detail.isError)
    return <Failure message={authErrorMessage(failure?.error, 'Unable to load your words.')} />
  }

  return <>{render(entries)}</>
}

function Status({ children }: { children: string }) {
  return (
    <p className="text-sm text-slate-600" role="status">
      {children}
    </p>
  )
}

function Failure({ message }: { message: string }) {
  return (
    <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
      {message}
    </p>
  )
}
