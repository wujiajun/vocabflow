import { expect, test } from 'vitest'
import type { VocabularyEntry, VocabularySense } from '../../vocabulary/types/vocabulary'
import { buildBlanks, isRight } from './cloze'

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

test('blanks the word as it is written in an example, and hides it in the rest of the sentence and the meaning', () => {
  const [question] = buildBlanks([entry(1, 'lease', [sense('To rent with a lease.', ['We leased the flat, a lease for a year.'], '🏠')])])

  expect(question.before).toBe('We ')
  expect(question.form).toBe('leased')
  expect(question.after).toBe(' the flat, a _____ for a year.')
  expect(question.meaning).toBe('To rent with a _____.')
  expect(question.emoji).toBe('🏠')
})

test('leaves out a word with no example that shows it, and one with no examples at all', () => {
  const questions = buildBlanks([
    entry(1, 'lease', [sense('To rent.', ['Nothing here.'])]),
    entry(2, 'budget', [sense('A plan.', [])]),
    entry(3, 'cope', [sense('To deal with it.', ['I can cope.'])]),
  ])

  expect(questions.map((question) => question.term)).toEqual(['cope'])
})

test('a form of the base word counts, and the answer may be the form or the word as listed, in any case', () => {
  const [question] = buildBlanks([entry(1, 'walked', [sense('To go on foot.', ['She walks to work.'])], 'walk')])

  expect(question.form).toBe('walks')
  expect(isRight('  Walks ', question)).toBe(true)
  expect(isRight('walked', question)).toBe(true)
  expect(isRight('talks', question)).toBe(false)
  expect(isRight('   ', question)).toBe(false)
})

test('asks at most ten questions', () => {
  const entries = Array.from({ length: 14 }, (_, index) => entry(index, `word${index}`, [sense('Meaning.', [`A sentence with word${index} in it.`])]))

  expect(buildBlanks(entries)).toHaveLength(10)
})
