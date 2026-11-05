import { expect, test } from 'vitest'
import { bandFromParam, clbNumber, fitsLevel, formatDuration, formatLevels, isShort, levelBands, overlapsBand } from './videoLevels'

test('an album fits a level inside its range, ends included', () => {
  const album = { clbMin: 4, clbMax: 6 }

  expect([3, 4, 5, 6, 7].map((level) => fitsLevel(album, level))).toEqual([false, true, true, true, false])
  expect(clbNumber('CLB_10')).toBe(10)
})

test('an album sits under every band its range touches', () => {
  const [low, mid, high, top] = levelBands

  expect([low, mid, high, top].map((band) => overlapsBand({ clbMin: 4, clbMax: 6 }, band))).toEqual([false, true, true, false])
  expect(overlapsBand({ clbMin: 8, clbMax: 12 }, top)).toBe(true)
  expect(overlapsBand({ clbMin: 3, clbMax: 5 }, low)).toBe(true)
  expect(bandFromParam('6-7')?.label).toBe('CLB 6–7')
  expect(bandFromParam('9')).toBeUndefined()
})

test('levels and lengths read plainly', () => {
  expect(formatLevels({ clbMin: 4, clbMax: 6 })).toBe('CLB 4–6')
  expect(formatLevels({ clbMin: 5, clbMax: 5 })).toBe('CLB 5')
  expect(formatDuration(230)).toBe('3:50')
  expect(formatDuration(30)).toBe('0:30')
  expect(formatDuration(1834)).toBe('30:34')
  expect(formatDuration(3723)).toBe('1:02:03')
  expect([600, 601].map(isShort)).toEqual([true, false])
})
