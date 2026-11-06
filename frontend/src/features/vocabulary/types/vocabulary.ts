export type VocabularyType = 'WORD' | 'PHRASE' | 'PHRASAL_VERB' | 'IDIOM' | 'EXPRESSION'

export type EnrichmentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export type LearningStatus = 'NEW' | 'LEARNING' | 'FAMILIAR' | 'MASTERED'

export interface VocabularySense {
  partOfSpeech: string | null
  label: string | null
  phonetic: string | null
  definition: string
  examples: string[] | null
  collocations: string[] | null
  // Words that mean about the same, and the opposite, in this meaning. Empty for a word saved before
  // they existed, so older test data may leave them out.
  synonyms?: string[] | null
  antonyms?: string[] | null
  // The memory hook: a scene in one sentence, emoji that show it, and how the word is built (written
  // on the first meaning only). Empty when there is none.
  scene?: string | null
  emoji?: string | null
  parts?: string | null
  // This meaning in simple Chinese; empty for a word saved before it existed.
  chinese?: string | null
}

export interface VocabularyEntry {
  id: number
  term: string
  type: VocabularyType | null
  phonetic: string | null
  partOfSpeech: string | null
  definition: string | null
  examples: string[] | null
  collocations: string[] | null
  senses: VocabularySense[]
  baseForm: string | null
  // For a failed word that is a misspelling: the word it should have been.
  spellingSuggestion: string | null
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
