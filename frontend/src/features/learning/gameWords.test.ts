import { expect, test } from 'vitest'
import type { VocabularyEntry } from '../vocabulary/types/vocabulary'
import { buildSoundPairs } from './components/cloze'
import { buildListenQuestions } from './components/listening'
import { buildPairs, planRounds } from './components/matching'
import { buildSpellItems, pickSpellWords } from './components/spelling'
import { hasEnoughWords, minGameWords, pickGameWordIds, poolSize, recentDays, wordsPerRound } from './gameWords'
import type { StudiedWord } from './types/study'

function words(from: number, count: number): StudiedWord[] {
  return Array.from({ length: count }, (_, index) => ({ userVocabularyId: from + index, term: `w${from + index}`, learningStatus: 'LEARNING' }))
}

const terms = ['cope', 'budget', 'tenant', 'deposit', 'lease', 'landlord', 'income', 'tax', 'refund', 'permit', 'visa', 'resume', 'salary', 'invoice', 'mortgage']

function entry(id: number): VocabularyEntry {
  const term = terms[id - 1]
  return {
    id,
    term,
    type: 'WORD',
    phonetic: null,
    partOfSpeech: null,
    definition: null,
    examples: null,
    collocations: null,
    senses: [
      { partOfSpeech: null, label: null, phonetic: null, definition: `Meaning number ${id}.`, examples: [`Number ${id}: we talked about the ${term} today.`], collocations: null },
    ],
    baseForm: null,
    spellingSuggestion: null,
    enrichmentStatus: 'COMPLETED',
    failureReason: null,
    learningStatus: 'LEARNING',
    createdAt: '2026-11-01T00:00:00Z',
  } as VocabularyEntry
}

const entries = Array.from({ length: 15 }, (_, index) => entry(index + 1))

test('every game shares one number: ten words a round, five to be offered', () => {
  expect(wordsPerRound).toBe(10)
  expect(minGameWords).toBe(5)
  expect(recentDays).toBe(30)
})

test('all four games take ten words from the same list, the first ones in its order', () => {
  const firstTen = entries.slice(0, 10).map((item) => item.id)
  const ids = (list: { id: number }[]) => list.map((item) => item.id).sort((a, b) => a - b)

  const matching = planRounds(buildPairs(entries))
  expect(matching.flat()).toHaveLength(10)
  expect(ids(matching.flat())).toEqual(firstTen)
  expect(ids(buildSoundPairs(entries))).toEqual(firstTen)
  expect(ids(buildListenQuestions(entries))).toEqual(firstTen)
  expect(buildSpellItems(entries)).toHaveLength(10)
  expect(ids(pickSpellWords(entries))).toEqual(firstTen)
})

test('with fewer than ten words a game takes them all', () => {
  const seven = entries.slice(0, 7)
  expect(planRounds(buildPairs(seven)).flat()).toHaveLength(7)
  expect(buildSoundPairs(seven)).toHaveLength(7)
  expect(buildListenQuestions(seven)).toHaveLength(7)
  expect(buildSpellItems(seven)).toHaveLength(7)
})

test('a game fetches the server’s ranking in order, a round’s worth and spares, without repeats', () => {
  const ranked = Array.from({ length: 20 }, (_, index) => 100 - index)
  expect(pickGameWordIds(ranked)).toEqual(ranked.slice(0, 15))
  expect(pickGameWordIds([5, 3, 5, 1])).toEqual([5, 3, 1])
  expect(pickGameWordIds([])).toEqual([])
})

test('a game needs five words in today and the last 30 days together', () => {
  expect(hasEnoughWords({ studiedToday: words(1, 4), recentlyStudied: [] })).toBe(false)
  expect(hasEnoughWords({ studiedToday: words(1, 3), recentlyStudied: words(10, 2) })).toBe(true)
  expect(hasEnoughWords({ studiedToday: [], recentlyStudied: words(10, 5) })).toBe(true)
  expect(poolSize({ studiedToday: words(1, 3), recentlyStudied: words(10, 2) })).toBe(5)
})
