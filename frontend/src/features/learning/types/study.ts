import type { VocabularyType } from '../../vocabulary/types/vocabulary'

export type Rating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY'

export interface RatingOption {
  rating: Rating
  // Exactly one is set: when the card comes back after this rating.
  intervalMinutes: number | null
  intervalDays: number | null
}

export interface StudyCard {
  userVocabularyId: number
  term: string
  type: VocabularyType | null
  phonetic: string | null
  partOfSpeech: string | null
  definition: string | null
  examples: string[] | null
  collocations: string[] | null
  state: 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING'
  version: number
  options: RatingOption[]
}

export interface StudyQueue {
  date: string
  learningCount: number
  reviewCount: number
  newCount: number
  unavailableCount: number
  nextCard: StudyCard | null
  nextDueAt: string | null
}

export interface ReviewRequest {
  userVocabularyId: number
  rating: Rating
  version: number
  date: string
}
