// The server's task types. The card writes the title of each from these.
export type TaskType =
  | 'STUDY_PLAN'
  | 'RATE_CARDS'
  | 'CLEAR_REVIEWS'
  | 'ADD_WORDS'
  | 'ADD_WORD_FROM_ARTICLE'
  | 'READ_ARTICLE'
  | 'WATCH_VIDEO'
  | 'PLAY_ROUND'
  | 'PLAY_GAME'
  | 'STARS_ROUND'
  | 'READ_LONG_ARTICLE'
  | 'WATCH_GRAMMAR_VIDEO'
  | 'SPELL_STARS'
  | 'PERFECT_ROUND'
  | 'DIFFERENT_GAMES'
  | 'CHALLENGE_GAMES'
  | 'CHALLENGE_PERFECT'
  | 'CHALLENGE_READ'

export interface DailyTask {
  key: string
  type: TaskType
  category: string
  // The practice game of a PLAY_GAME task, else null.
  game: string | null
  target: number
  current: number
  points: number
  completed: boolean
  completedAt: string | null
  // The challenge of the day: harder than the others, worth more points.
  challenge: boolean
}

export interface TaskDay {
  date: string
  tasks: DailyTask[]
  allDone: boolean
  earnedToday: number
  balance: number
  streak: number
  bestStreak: number
}

export interface LedgerLine {
  date: string
  key: string
  amount: number
  reason: string
  createdAt: string
}

export interface LedgerPage {
  entries: LedgerLine[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
