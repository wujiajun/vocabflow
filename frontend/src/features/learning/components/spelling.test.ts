import { expect, test } from 'vitest'
import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'
import { applyInput, buildSpellItems, check, isComplete, isFull, lettersOf, pickSpellWords, slotsFor, starsFor } from './spelling'

function entry(id: number, term: string, extra: Partial<VocabularyEntry['senses'][number]> = {}, status = 'COMPLETED'): VocabularyEntry {
  return {
    id,
    term,
    type: 'WORD',
    phonetic: null,
    partOfSpeech: null,
    definition: null,
    examples: null,
    collocations: null,
    senses: [{ partOfSpeech: null, label: null, phonetic: null, definition: `${term} means number ${id}.`, examples: null, collocations: null, ...extra }],
    baseForm: null,
    spellingSuggestion: null,
    enrichmentStatus: status,
    failureReason: null,
    learningStatus: 'LEARNING',
    createdAt: '2026-11-01T00:00:00Z',
  } as VocabularyEntry
}

test('a word has one slot per letter, a phrase a gap, and apostrophes and hyphens are filled in', () => {
  expect(slotsFor('cope').filter((slot) => slot.kind === 'letter')).toHaveLength(4)
  expect(slotsFor('take  off').map((slot) => slot.kind)).toEqual(['letter', 'letter', 'letter', 'letter', 'gap', 'letter', 'letter', 'letter'])
  expect(slotsFor("don't").map((slot) => slot.kind)).toEqual(['letter', 'letter', 'letter', 'fixed', 'letter'])
  expect(lettersOf('well-known')).toEqual([...'wellknown'])
})

test('letters match whatever their case or accent', () => {
  expect(isComplete(lettersOf('Café'), [...'CAFE'])).toBe(true)
  expect(check(lettersOf('cope'), [...'cxp'])).toEqual([true, false, true])
})

test('typing only adds at the end and deleting only takes from the end, and nothing is judged on the way', () => {
  const type = (previous: string, value: string, composing = false) => applyInput([...previous], value, 4, composing).join('')
  expect(type('c', 'co')).toBe('co')
  expect(type('co', 'xco')).toBe('cox')
  expect(type('co', 'c')).toBe('c')
  expect(type('co', 'co!')).toBe('co')
  expect(type('cope', 'copes')).toBe('cope')
  // A wrong letter is simply a letter until the row is full.
  expect(type('c', 'cx')).toBe('cx')
})

test('a keyboard still building a word is read as it stands, letter by letter', () => {
  expect(applyInput([], 'c', 4, true)).toEqual(['c'])
  expect(applyInput(['c'], "c'o", 4, true)).toEqual(['c', 'o'])
  expect(applyInput(['c', 'o'], "c'o'p'e's", 4, true)).toEqual(['c', 'o', 'p', 'e'])
})

test('the word is judged only when every slot is full', () => {
  const answer = [...'cope']
  expect(isFull(answer, [...'cox'])).toBe(false)
  expect(isFull(answer, [...'coxe'])).toBe(true)
  expect(isComplete(answer, [...'coxe'])).toBe(false)
  expect(isComplete(answer, [...'COPE'])).toBe(true)
})

test('stars fall with mistakes and shown letters, never below one for a spelled word, and a skip earns none', () => {
  expect(starsFor({ mistakes: 0, hints: 0, skipped: false })).toBe(3)
  expect(starsFor({ mistakes: 2, hints: 0, skipped: false })).toBe(2)
  expect(starsFor({ mistakes: 3, hints: 0, skipped: false })).toBe(1)
  expect(starsFor({ mistakes: 0, hints: 1, skipped: false })).toBe(2)
  expect(starsFor({ mistakes: 5, hints: 3, skipped: false })).toBe(1)
  expect(starsFor({ mistakes: 0, hints: 0, skipped: true })).toBe(0)
})

test('only completed words with a meaning are played, with the meaning’s hook and the word hidden', () => {
  const entries = [
    entry(1, 'cope', { emoji: '🧗', scene: 'She can cope with it.' }),
    entry(2, 'budget'),
    entry(3, 'tenant'),
    entry(4, 'deposit'),
    entry(5, 'rent', {}, 'PENDING'),
    entry(6, 'a'),
    entry(7, 'lease'),
  ]
  expect(pickSpellWords(entries).map((word) => word.id).sort()).toEqual([1, 2, 3, 4, 7])
  const items = buildSpellItems(entries)
  const cope = items.find((item) => item.id === 1)!
  expect(cope.definition).toBe('_____ means number 1.')
  expect(cope.scene).toBe('She can _____ with it.')
  expect(cope.emoji).toBe('🧗')
  expect(buildSpellItems(entries.slice(0, 4))).toEqual([])
})
