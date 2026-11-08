// The shape of GET /api/v1/progress/summary.
export interface ProgressDay {
  date: string
  cards: number
  reviews: number
  newWords: number
  rounds: number
  points: number
}

export interface ProgressWeek {
  reviews: number
  newWords: number
  rounds: number
}

export interface ProgressSummary {
  date: string
  started: number
  mastered: number
  learning: number
  streak: number
  bestStreak: number
  milestone: { previous: number; next: number | null }
  days: ProgressDay[]
  thisWeek: ProgressWeek
  lastWeek: ProgressWeek
}
