import type { LearningStatus, VocabularySense, VocabularyType } from '../../vocabulary/types/vocabulary'

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
  senses: VocabularySense[]
  baseForm: string | null
  state: 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING'
  version: number
  options: RatingOption[]
}

export interface StudiedWord {
  userVocabularyId: number
  term: string
  learningStatus: LearningStatus
}

export interface StudyQueue {
  date: string
  learningCount: number
  reviewCount: number
  newCount: number
  unavailableCount: number
  nextCard: StudyCard | null
  nextDueAt: string | null
  // Every word of this study is in exactly one of these, whether it is new or a review.
  studiedCount: number
  stillLearningCount: number
  notStartedCount: number
  newTargetCount: number
  goalShortfall: number
  finished: boolean
  moreNewWords: boolean
  studiedToday: StudiedWord[]
}

export interface ReviewRequest {
  userVocabularyId: number
  rating: Rating
  version: number
  date: string
}
