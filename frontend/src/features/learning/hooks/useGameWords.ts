import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { getGameWords, recordGamePlays } from '../api/gameWordsApi'

// Never kept: a round that has just been played changes the ranking, so every new round asks again.
export function useGameWords(date: string) {
  return useQuery({
    queryKey: ['learning', 'game-words', date],
    queryFn: () => getGameWords(date),
    staleTime: 0,
    gcTime: 0,
  })
}

// Tells the server which words a round really used, once, when the round is shown. A failure is retried
// once, quietly, and then ignored: the game never waits for this and never shows an error for it.
export function useRecordPlays(wordIds: number[]) {
  const sent = useRef(false)
  const { mutate } = useMutation({
    mutationFn: (ids: number[]) => recordGamePlays(ids),
    retry: 1,
    retryDelay: 3000,
  })

  useEffect(() => {
    if (!sent.current && wordIds.length > 0) {
      sent.current = true
      mutate(wordIds)
    }
  }, [mutate, wordIds])
}
