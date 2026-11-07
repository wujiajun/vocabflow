import { expect, test } from 'vitest'
import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'
import { applyInput, buildSpellItems, check, isComplete, lettersOf, pickSpellWords, slotsFor, starsFor } from './spelling'

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

test('typing only adds at the end and deleting only takes from the end', () => {
  const answer = [...'cope']
  const type = (previous: string, value: string, composing = false) => {
    const result = applyInput([...previous], value, answer, composing)
    return { typed: result.typed.join(''), mistake: result.mistake }
  }
  expect(type('c', 'co')).toEqual({ typed: 'co', mistake: false })
  expect(type('co', 'xco').typed).toBe('cox')
  expect(type('co', 'c')).toEqual({ typed: 'c', mistake: false })
  expect(type('co', 'co!')).toEqual({ typed: 'co', mistake: false })
  expect(type('cope', 'copes').typed).toBe('cope')
})

test('a wrong letter is judged at once and stays as the last letter; the next letter replaces it', () => {
  const answer = [...'cope']
  expect(applyInput(['c'], 'cx', answer)).toEqual({ typed: ['c', 'x'], mistake: true })
  // Typing on from the wrong letter replaces it, so nothing is ever typed beyond a wrong letter.
  expect(applyInput(['c', 'x'], 'cxo', answer)).toEqual({ typed: ['c', 'o'], mistake: false })
  expect(applyInput(['c', 'x'], 'cxz', answer)).toEqual({ typed: ['c', 'z'], mistake: true })
  // Several letters at once (a paste) stop at the first wrong one.
  expect(applyInput([], 'cxpe', answer)).toEqual({ typed: ['c', 'x'], mistake: true })
  expect(applyInput(['c', 'x'], 'c', answer)).toEqual({ typed: ['c'], mistake: false })
})

test('a keyboard still building a word is read as it stands, letter by letter', () => {
  const answer = [...'cope']
  expect(applyInput([], "c", answer, true)).toEqual({ typed: ['c'], mistake: false })
  expect(applyInput(['c'], "c'x", answer, true)).toEqual({ typed: ['c', 'x'], mistake: true })
  expect(applyInput(['c', 'x'], "c'xe", answer, true)).toEqual({ typed: ['c', 'x'], mistake: false })
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
  ]
  expect(pickSpellWords(entries).map((word) => word.id).sort()).toEqual([1, 2, 3, 4])
  const items = buildSpellItems(entries)
  const cope = items.find((item) => item.id === 1)!
  expect(cope.definition).toBe('_____ means number 1.')
  expect(cope.scene).toBe('She can _____ with it.')
  expect(cope.emoji).toBe('🧗')
  expect(buildSpellItems(entries.slice(0, 3))).toEqual([])
})
