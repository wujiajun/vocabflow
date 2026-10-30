import type { LearningStatus, VocabularyType } from '../types/vocabulary'

export function formatVocabularyType(type: VocabularyType | null) {
  return type ? capitalize(type.replace('_', ' ')) : null
}

// Phrasal verbs report the same words as both type and part of speech; show them once.
export function describeKind(type: VocabularyType | null, partOfSpeech: string | null) {
  const typeLabel = formatVocabularyType(type)
  const distinctPartOfSpeech = partOfSpeech?.toLowerCase() === typeLabel?.toLowerCase() ? null : partOfSpeech
  return [typeLabel, distinctPartOfSpeech].filter(Boolean).join(' · ')
}

export function formatLearningStatus(status: LearningStatus) {
  return capitalize(status)
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}
