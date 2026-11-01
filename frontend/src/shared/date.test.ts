import { expect, test } from 'vitest'
import { msUntilMidnightIn, parseLocalDate, toLocalDateString, todayIn } from './date'

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

test('names the calendar date in a given time zone, whatever the device is set to', () => {
  // 03:30 UTC on the 29th is still the evening of the 28th in Toronto (UTC-4), and already the 29th in Tokyo.
  const instant = new Date('2026-10-29T03:30:00Z')

  expect(todayIn('America/Toronto', instant)).toBe('2026-10-28')
  expect(todayIn('Asia/Tokyo', instant)).toBe('2026-10-29')
  expect(todayIn('Pacific/Kiritimati', instant)).toBe('2026-10-29')
  expect(todayIn('Pacific/Pago_Pago', instant)).toBe('2026-10-28')
})

test('falls back to the device for no zone or one this browser does not know', () => {
  const now = new Date(2026, 9, 29, 12, 0, 0)

  expect(todayIn(null, now)).toBe('2026-10-29')
  expect(todayIn('', now)).toBe('2026-10-29')
  expect(todayIn('Mars/Olympus', now)).toBe('2026-10-29')
})

test('counts the time left until midnight in the zone', () => {
  // 22:30 in Toronto is 90 minutes before midnight there.
  expect(msUntilMidnightIn('America/Toronto', new Date('2026-10-30T02:30:00Z'))).toBe(90 * 60_000)
  expect(msUntilMidnightIn('Asia/Tokyo', new Date('2026-10-29T14:59:00Z'))).toBe(60_000)
  expect(msUntilMidnightIn(null, new Date(2026, 9, 29, 23, 59, 30))).toBe(30_000)
})
