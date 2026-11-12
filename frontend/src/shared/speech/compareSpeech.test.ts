import { expect, test } from 'vitest'
import { compareSpeech, tokenize } from './compareSpeech'

const statuses = (target: string, heard: string) => compareSpeech(target, heard).target.map((w) => w.status)

test('tokenize ignores capitals and punctuation but keeps apostrophes', () => {
  expect(tokenize("Hello, World! I’d like it.")).toEqual(['hello', 'world', "i'd", 'like', 'it'])
  expect(tokenize('  ... ?! ')).toEqual([])
})

test('a perfect reading is all correct', () => {
  const r = compareSpeech('Where is the nearest bus stop?', 'where is the nearest bus stop')
  expect(r.correct).toBe(6)
  expect(r.share).toBe(1)
  expect(r.extra).toEqual([])
})

test('a left-out word is missed and does not turn the rest wrong', () => {
  expect(statuses('I need a health card', 'I need health card')).toEqual(['correct', 'correct', 'missed', 'correct', 'correct'])
})

test('a different word is wrong and says what was heard', () => {
  const r = compareSpeech('My son has a fever', 'my sun has a fever')
  expect(r.target[1]).toEqual({ word: 'son', status: 'wrong', heard: 'sun' })
  expect(r.correct).toBe(4)
})

test('words said that are not in the sentence are extra', () => {
  const r = compareSpeech('Open the door', 'please open the door now')
  expect(r.extra).toEqual(['please', 'now'])
  expect(r.share).toBe(1)
})

test('nothing heard misses everything; an empty target scores 0', () => {
  expect(statuses('good morning', '')).toEqual(['missed', 'missed'])
  expect(compareSpeech('...', 'hello').share).toBe(0)
})
