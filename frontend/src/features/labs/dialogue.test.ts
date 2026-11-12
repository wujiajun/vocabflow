import { expect, test } from 'vitest'
import { dialogues, graceMs, isEchoWindow, turnSaid } from './dialogue'

test('results during the phone speaking, or just after, are echo', () => {
  expect(isEchoWindow(5000, true, 0)).toBe(true)
  expect(isEchoWindow(5000, false, 5000 - graceMs + 1)).toBe(true)
  expect(isEchoWindow(5000, false, 5000 - graceMs)).toBe(false)
})

test('a turn is the results from the baseline on, and ends when the last is final', () => {
  const results = [
    { transcript: 'old sentence', isFinal: true },
    { transcript: 'can I have', isFinal: true },
    { transcript: 'a coffee', isFinal: false },
  ]
  expect(turnSaid(results, 1)).toEqual({ text: 'can I have a coffee', final: false })
  expect(turnSaid([...results.slice(0, 2), { transcript: 'a coffee', isFinal: true }], 1)).toEqual({ text: 'can I have a coffee', final: true })
  expect(turnSaid(results, 3)).toEqual({ text: '', final: false })
})

test('the built-in conversations alternate and are 6 to 8 lines', () => {
  for (const d of dialogues) {
    expect(d.lines.length).toBeGreaterThanOrEqual(6)
    expect(d.lines.length).toBeLessThanOrEqual(8)
    d.lines.slice(1).forEach((l, i) => expect(l.speaker).not.toBe(d.lines[i].speaker))
  }
})
