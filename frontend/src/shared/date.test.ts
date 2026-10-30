import { expect, test } from 'vitest'
import { parseLocalDate, toLocalDateString } from './date'

test('formats the local calendar date even late in the evening', () => {
  // 23:30 local time is already the next day in UTC for any zone west of Greenwich.
  expect(toLocalDateString(new Date(2026, 9, 29, 23, 30))).toBe('2026-10-29')
})

test('zero-pads single-digit months and days', () => {
  expect(toLocalDateString(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
})

test('parses a date string as that local calendar day', () => {
  const parsed = parseLocalDate('2026-10-29')

  expect([parsed.getFullYear(), parsed.getMonth(), parsed.getDate()]).toEqual([2026, 9, 29])
  expect(toLocalDateString(parsed)).toBe('2026-10-29')
})
