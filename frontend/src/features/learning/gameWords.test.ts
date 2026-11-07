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
  expect(recentDays).toBe(7)
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

test('today’s words come first and are all in when they number ten or fewer', () => {
  const queue = { studiedToday: words(1, 7), recentlyStudied: words(100, 20) }
  const ids = pickGameWordIds(queue)
  expect(ids.slice(0, 7).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7])
  expect(ids.slice(7).every((id) => id >= 100)).toBe(true)
  expect(ids.length).toBeGreaterThanOrEqual(wordsPerRound)
})

test('older words are used only to top up, and are not always the same', () => {
  const queue = { studiedToday: words(1, 15), recentlyStudied: words(100, 20) }
  expect(pickGameWordIds(queue).every((id) => id < 100)).toBe(true)

  const few = { studiedToday: words(1, 2), recentlyStudied: words(100, 30) }
  const picks = new Set(Array.from({ length: 12 }, () => pickGameWordIds(few).join(',')))
  expect(picks.size).toBeGreaterThan(1)
})

test('a word in both lists is chosen once', () => {
  const queue = { studiedToday: words(1, 4), recentlyStudied: words(3, 6) }
  const ids = pickGameWordIds(queue)
  expect(new Set(ids).size).toBe(ids.length)
  expect(ids.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
})

test('a game needs five words in today and the last week together', () => {
  expect(hasEnoughWords({ studiedToday: words(1, 4), recentlyStudied: [] })).toBe(false)
  expect(hasEnoughWords({ studiedToday: words(1, 3), recentlyStudied: words(10, 2) })).toBe(true)
  expect(hasEnoughWords({ studiedToday: [], recentlyStudied: words(10, 5) })).toBe(true)
  expect(poolSize({ studiedToday: words(1, 3), recentlyStudied: words(10, 2) })).toBe(5)
})
