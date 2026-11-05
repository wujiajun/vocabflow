import { expect, test } from 'vitest'
import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'
import { buildListenQuestions } from './listening'

function entry(id: number, term: string): VocabularyEntry {
  return {
    id,
    term,
    type: 'WORD',
    phonetic: null,
    partOfSpeech: null,
    definition: null,
    examples: null,
    collocations: null,
    senses: [{ partOfSpeech: null, label: null, phonetic: null, definition: `Number ${id} means ${term}.`, examples: null, collocations: null }],
    baseForm: null,
    spellingSuggestion: null,
    enrichmentStatus: 'COMPLETED',
    failureReason: null,
    learningStatus: 'LEARNING',
    createdAt: '2026-11-01T00:00:00Z',
  } as VocabularyEntry
}

const entries = ['cope', 'budget', 'tenant', 'deposit', 'rent'].map((term, index) => entry(index + 1, term))

test('each word gets four different meanings to pick from, with its own meaning (its word hidden) among them', () => {
  const questions = buildListenQuestions(entries)

  expect(questions).toHaveLength(5)
  for (const question of questions) {
    expect(question.options).toHaveLength(4)
    expect(new Set(question.options).size).toBe(4)
    expect(question.options[question.correct]).toBe(`Number ${question.id} means _____.`)
  }
  expect(questions.map((question) => question.term).sort()).toEqual(['budget', 'cope', 'deposit', 'rent', 'tenant'])
})

test('with fewer than four words there is nothing to choose from', () => {
  expect(buildListenQuestions(entries.slice(0, 3))).toEqual([])
})
