import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useUserToday } from '../../auth/hooks/useUserToday'
import { type FinishedRound, recordGameRound } from '../api/gameRoundsApi'

// Tells the server a round has been finished, once, when its results screen is shown (that screen exists
// once per round: "Play again" mounts a new game). A failure is retried once, quietly, and then ignored:
// the game never waits for this and never shows an error for it.
export function useRecordRound(round: FinishedRound) {
  const date = useUserToday()
  const sent = useRef(false)
  const { mutate } = useMutation({
    mutationFn: recordGameRound,
    retry: 1,
    retryDelay: 3000,
  })

  useEffect(() => {
    if (!sent.current) {
      sent.current = true
      mutate({ ...round, date })
    }
  }, [mutate, round, date])
}
