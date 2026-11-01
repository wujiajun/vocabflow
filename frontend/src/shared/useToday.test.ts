import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useToday } from './useToday'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 29, 23, 59, 50))
})

afterEach(() => {
  vi.useRealTimers()
})

test('returns today’s local date', () => {
  const { result } = renderHook(() => useToday())

  expect(result.current).toBe('2026-10-29')
})

test('moves on to the next day by itself when midnight passes', () => {
  const { result } = renderHook(() => useToday())

  act(() => vi.advanceTimersByTime(9_000))
  expect(result.current).toBe('2026-10-29')

  act(() => vi.advanceTimersByTime(2_000))
  expect(result.current).toBe('2026-10-30')
})

test('keeps rolling over every night', () => {
  const { result } = renderHook(() => useToday())

  act(() => vi.advanceTimersByTime(11_000))
  expect(result.current).toBe('2026-10-30')

  act(() => vi.advanceTimersByTime(24 * 60 * 60 * 1000))
  expect(result.current).toBe('2026-10-31')
})

test('catches up when the user returns after a long sleep, without waiting for the timer', () => {
  const { result } = renderHook(() => useToday())

  vi.setSystemTime(new Date(2026, 10, 2, 8, 0, 0))
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })

  expect(result.current).toBe('2026-11-02')
})

test('also catches up when the window regains focus', () => {
  const { result } = renderHook(() => useToday())

  vi.setSystemTime(new Date(2026, 9, 30, 9, 0, 0))
  act(() => {
    window.dispatchEvent(new Event('focus'))
  })

  expect(result.current).toBe('2026-10-30')
})

test('leaves no timer or listener behind once unmounted', () => {
  const { result, unmount } = renderHook(() => useToday())
  expect(vi.getTimerCount()).toBe(1)

  unmount()
  vi.setSystemTime(new Date(2026, 9, 30, 9, 0, 0))
  document.dispatchEvent(new Event('visibilitychange'))

  expect(vi.getTimerCount()).toBe(0)
  expect(result.current).toBe('2026-10-29')
})

// The shared test setup unmounts after every test. A hook left mounted keeps its listeners and can
// schedule React work that runs after the test file has finished (CI: "window is not defined").
test('leaves no hook from an earlier test mounted', () => {
  expect(document.body).toBeEmptyDOMElement()
})

test('follows a chosen time zone instead of the device, and rolls over at that zone’s midnight', () => {
  // Midnight in Toronto (UTC-4 that night) is 04:00 UTC.
  vi.setSystemTime(new Date('2026-10-29T03:59:30Z'))
  const { result } = renderHook(() => useToday('America/Toronto'))

  expect(result.current).toBe('2026-10-28')
  act(() => vi.advanceTimersByTime(29_000))
  expect(result.current).toBe('2026-10-28')
  act(() => vi.advanceTimersByTime(3_000))
  expect(result.current).toBe('2026-10-29')
})

test('changing the zone changes the date at once', () => {
  vi.setSystemTime(new Date('2026-10-29T03:30:00Z'))
  const { result, rerender } = renderHook(({ zone }) => useToday(zone), { initialProps: { zone: 'America/Toronto' as string | null } })
  expect(result.current).toBe('2026-10-28')

  rerender({ zone: 'Asia/Tokyo' })
  expect(result.current).toBe('2026-10-29')
})
