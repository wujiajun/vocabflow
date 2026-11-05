import { expect, test } from 'vitest'
import type { VocabularyEntry, VocabularySense } from '../../vocabulary/types/vocabulary'
import { buildSoundPairs } from './cloze'

function sense(definition: string, examples: string[], emoji?: string): VocabularySense {
  return { partOfSpeech: null, label: null, phonetic: null, definition, examples, collocations: null, emoji }
}

function entry(id: number, term: string, senses: VocabularySense[], baseForm: string | null = null): VocabularyEntry {
  return {
    id,
    term,
    type: 'WORD',
    phonetic: null,
    partOfSpeech: null,
    definition: null,
    examples: null,
    collocations: null,
    senses,
    baseForm,
    spellingSuggestion: null,
    enrichmentStatus: 'COMPLETED',
    failureReason: null,
    learningStatus: 'LEARNING',
    createdAt: '2026-11-01T00:00:00Z',
  } as VocabularyEntry
}

test('blanks the word as written in an example, hides it in the rest of the sentence and the clue, and keeps the full sentence', () => {
  const [pair] = buildSoundPairs([entry(1, 'lease', [sense('To rent with a lease.', ['We leased the flat, a lease for a year.'], '🏠')])])

  expect(pair.term).toBe('lease')
  expect(pair.definition).toBe('We _____ the flat, a _____ for a year.')
  expect(pair.hint).toBe('🏠 To rent with a _____.')
  expect(pair.filled).toBe('We leased the flat, a lease for a year.')
})

test('leaves out a word with no example that shows it, and one with no examples at all', () => {
  const pairs = buildSoundPairs([
    entry(1, 'lease', [sense('To rent.', ['Nothing here.'])]),
    entry(2, 'budget', [sense('A plan.', [])]),
    entry(3, 'cope', [sense('To deal with it.', ['I can cope.'])]),
  ])

  expect(pairs.map((pair) => pair.term)).toEqual(['cope'])
})

test('a form of the base word counts, and two words with the same sentence leave one', () => {
  const pairs = buildSoundPairs([
    entry(1, 'walked', [sense('To go on foot.', ['She walks to work.'])], 'walk'),
    entry(2, 'walk', [sense('To go on foot.', ['She walks to work.'])]),
  ])

  expect(pairs).toHaveLength(1)
  expect(pairs[0].definition).toBe('She _____ to work.')
})

test('takes at most ten sentences', () => {
  const entries = Array.from({ length: 14 }, (_, index) => entry(index, `word${index}`, [sense('Meaning.', [`Sentence number ${index} has word${index} in it.`])]))

  expect(buildSoundPairs(entries)).toHaveLength(10)
})
