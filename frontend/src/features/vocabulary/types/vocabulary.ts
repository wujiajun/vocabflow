export type VocabularyType = 'WORD' | 'PHRASE' | 'PHRASAL_VERB' | 'IDIOM' | 'EXPRESSION'

export type EnrichmentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export type LearningStatus = 'NEW' | 'LEARNING' | 'FAMILIAR' | 'MASTERED'

export interface VocabularyEntry {
  id: number
  term: string
  type: VocabularyType | null
  phonetic: string | null
  partOfSpeech: string | null
  definition: string | null
  examples: string[] | null
  collocations: string[] | null
  enrichmentStatus: EnrichmentStatus
  failureReason: string | null
  learningStatus: LearningStatus
  createdAt: string
}

export interface VocabularyPage {
  content: VocabularyEntry[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface CreateVocabularyRequest {
  term: string
}
