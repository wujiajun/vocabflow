import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'
import { buildPairs, maxPairs, shuffle } from './matching'

export const optionCount = 4
export const minListenQuestions = optionCount

export interface ListenQuestion {
  id: number
  term: string
  // The meanings to choose from, the right one among them, each with its own word hidden.
  options: string[]
  correct: number
}

// One question per word: the word is heard, and its meaning is picked from the meanings of other
// words studied today. Needs at least four words with a meaning, so that there are four to pick from.
export function buildListenQuestions(entries: readonly VocabularyEntry[], random: () => number = Math.random): ListenQuestion[] {
  const pairs = buildPairs(shuffle(entries, random), random)
  if (pairs.length < optionCount) {
    return []
  }

  return pairs.slice(0, maxPairs).map((pair) => {
    const others = shuffle(
      pairs.filter((other) => other.id !== pair.id),
      random,
    ).slice(0, optionCount - 1)
    const options = shuffle([pair, ...others], random)
    return {
      id: pair.id,
      term: pair.term,
      options: options.map((option) => option.definition),
      correct: options.indexOf(pair),
    }
  })
}
