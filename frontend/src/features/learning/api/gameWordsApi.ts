import { apiClient } from '../../../shared/api/apiClient'

export interface GameWords {
  date: string
  // Ranked, best first: the words a round should be drawn from.
  wordIds: number[]
}

export function getGameWords(date: string) {
  return apiClient<GameWords>(`/api/v1/learning/game-words?date=${date}`)
}

export function recordGamePlays(wordIds: number[]) {
  return apiClient<void>('/api/v1/learning/game-words/played', { method: 'POST', body: { wordIds } })
}
