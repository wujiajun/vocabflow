import { expect, test } from 'vitest'
import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'
import { buildPairs, maskTerm, planRounds } from './matching'

function entry(id: number, term: string, definitions: string[], overrides: Partial<VocabularyEntry> = {}): VocabularyEntry {
  return {
    id,
    term,
    type: 'WORD',
    phonetic: null,
    partOfSpeech: null,
    definition: definitions[0] ?? null,
    examples: null,
    collocations: null,
    senses: definitions.map((definition) => ({ partOfSpeech: null, label: null, phonetic: null, definition, examples: null, collocations: null })),
    baseForm: null,
    spellingSuggestion: null,
    enrichmentStatus: 'COMPLETED',
    failureReason: null,
    learningStatus: 'LEARNING',
    createdAt: '2026-11-01T00:00:00Z',
    ...overrides,
  }
}

test('the word is blanked out of its meaning, with its common endings', () => {
  expect(maskTerm('To lease is to rent; a leased flat, leasing, Lease.', ['lease'])).toBe('To _____ is to rent; a _____ flat, _____, _____.')
  expect(maskTerm('He carries it and carried it: to carry.', ['carry'])).toBe('He _____ it and _____ it: to _____.')
  expect(maskTerm('To go ahead with a plan.', ['carry on', null])).toBe('To go ahead with a plan.')
  expect(maskTerm('To carry on is to continue.', ['carry on'])).toBe('To _____ is to continue.')
})

test('a word inside a longer word is left alone', () => {
  expect(maskTerm('A piece of writing in a paper.', ['art'])).toBe('A piece of writing in a paper.')
  expect(maskTerm('Articles are things.', ['art'])).toBe('Articles are things.')
})

test('the base form is blanked out too, and a regex character in a word does no harm', () => {
  expect(maskTerm('To run: he ran.', ['running', 'run'])).toBe('To _____: he ran.')
  expect(maskTerm('Short for c++ code.', ['c++'])).toBe('Short for _____ code.')
})

test('each word gets one of its meanings, and words without one or with a repeated one are left out', () => {
  const entries = [
    entry(1, 'lead', ['To show the way.', 'A heavy metal.']),
    entry(2, 'bare', []),
    entry(3, 'cope', ['To deal with something hard.']),
    entry(4, 'manage', ['To deal with something hard.']),
  ]

  const pairs = buildPairs(entries, () => 0.99)

  expect(pairs).toEqual([
    { id: 1, term: 'lead', definition: 'A heavy metal.' },
    { id: 3, term: 'cope', definition: 'To deal with something hard.' },
  ])
})

test('a word with only the single definition field still plays', () => {
  const plain = entry(1, 'cope', [], { definition: 'To deal with trouble.' })
  expect(buildPairs([plain])).toEqual([{ id: 1, term: 'cope', definition: 'To deal with trouble.' }])
})

test('rounds hold up to five words, are shared out evenly, and stop at ten words', () => {
  const pairs = (count: number) => Array.from({ length: count }, (_, index) => ({ id: index, term: `w${index}`, definition: `d${index}` }))
  const sizes = (count: number) => planRounds(pairs(count)).map((round) => round.length)

  expect(sizes(5)).toEqual([5])
  expect(sizes(6)).toEqual([3, 3])
  expect(sizes(7)).toEqual([4, 3])
  expect(sizes(10)).toEqual([5, 5])
  expect(sizes(12)).toEqual([5, 5])
  expect(sizes(0)).toEqual([])
})
