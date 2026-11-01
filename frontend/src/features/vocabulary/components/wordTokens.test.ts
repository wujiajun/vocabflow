import { expect, test } from 'vitest'
import { splitWords } from './wordTokens'

function words(text: string) {
  return splitWords(text)
    .filter((part) => part.word !== undefined)
    .map((part) => part.word)
}

test('splits text into words and the text between them, losing nothing', () => {
  const parts = splitWords('We signed a lease, then left.')

  expect(parts.map((part) => part.text).join('')).toBe('We signed a lease, then left.')
  expect(words('We signed a lease, then left.')).toEqual(['we', 'signed', 'a', 'lease', 'then', 'left'])
})

test('keeps apostrophes and hyphens inside a word, and writes the apostrophe plainly', () => {
  expect(words('She can’t find a two-bedroom flat; it’s o’clock')).toEqual(['she', 'can\'t', 'find', 'a', 'two-bedroom', 'flat', 'it\'s', 'o\'clock'])
})

test('drops a capital that only starts a sentence, and keeps one that belongs to the word', () => {
  expect(words('Leased cars are cheap. Toronto is large. He moved to Toronto! Then NASA called.')).toEqual([
    'leased',
    'cars',
    'are',
    'cheap',
    'toronto',
    'is',
    'large',
    'he',
    'moved',
    'to',
    'Toronto',
    'then',
    'NASA',
    'called',
  ])
})

test('a sentence that begins after a closing quote still starts with a plain word', () => {
  expect(words('He said "Stop." Then left.')).toEqual(['he', 'said', 'Stop', 'then', 'left'])
})

test('digits and punctuation alone are not words', () => {
  expect(splitWords('3 p.m. — 4.5%').filter((part) => part.word !== undefined).map((part) => part.text)).toEqual(['p', 'm'])
  expect(splitWords('')).toEqual([])
})
