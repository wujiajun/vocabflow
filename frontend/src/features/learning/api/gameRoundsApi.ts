import { apiClient } from '../../../shared/api/apiClient'

export type GameId = 'quick-review' | 'fill-blank' | 'listen-choose' | 'spell-it'

export interface FinishedRound {
  game: GameId
  // 0 to 3, the same stars the results screen shows.
  stars: number
  mistakes: number
  wordCount: number
}

export function recordGameRound(round: FinishedRound & { date: string }) {
  return apiClient<{ id: number }>('/api/v1/learning/game-rounds', { method: 'POST', body: round })
}
