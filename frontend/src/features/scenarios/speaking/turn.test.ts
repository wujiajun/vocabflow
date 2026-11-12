import { expect, test } from 'vitest'
import { dialogueFromText } from './dialogueFromText'
import { readingMs, turnText } from './turn'

test('only what came after the turn began belongs to the turn', () => {
  const results = [
    { transcript: 'the first line I said', isFinal: true },
    { transcript: 'can I pay', isFinal: true },
    { transcript: 'by card', isFinal: false },
  ]
  expect(turnText(results, 1)).toEqual({ text: 'can I pay by card', final: false })
  expect(turnText([results[0], results[1], { transcript: 'by card', isFinal: true }], 1).final).toBe(true)
  expect(turnText(results, 3)).toEqual({ text: '', final: false })
})

test('a late final of the line before changes an earlier entry and so stays out of the new turn', () => {
  const before = [{ transcript: 'one two', isFinal: false }]
  const baseline = before.length
  const after = [{ transcript: 'one two three', isFinal: true }, { transcript: 'next line', isFinal: false }]
  expect(turnText(after, baseline).text).toBe('next line')
})

test('longer lines are shown longer', () => {
  expect(readingMs('Hi')).toBe(2500)
  expect(readingMs('one two three four five six seven eight nine ten')).toBeGreaterThan(readingMs('one two three'))
})

test('the conversation is found in the text; tips and scene paragraphs are not lines', () => {
  const text = [
    'Sam is looking for a flat.',
    'Ms. Patel: Welcome, Sam.',
    'Sam: Thank you. Is it all right if I look around?',
    'Ms. Patel: Of course.',
    'Tip: always read the lease. Ask about the rent.',
    'Sam: Could I see the kitchen?',
  ].join('\n\n')
  expect(dialogueFromText(text).map((l) => l.speaker)).toEqual(['Ms. Patel', 'Sam', 'Ms. Patel', 'Sam'])
})

test('no conversation: one speaker, or a single labelled paragraph', () => {
  expect(dialogueFromText('Sam is looking for a flat.\n\nMs. Patel: The lease is for one year.')).toEqual([])
  expect(dialogueFromText('Note: be careful.\n\nTip: ask first.')).toEqual([])
  expect(dialogueFromText('Amy: hello there\n\nAmy: how are you')).toEqual([])
})
