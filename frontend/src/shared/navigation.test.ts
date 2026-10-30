import { expect, test } from 'vitest'
import { backState, readBackTarget } from './navigation'

const fallback = { path: '/app/vocabulary', label: 'Back to vocabulary' }

test('reads back the place a page was opened from', () => {
  const state = backState('/app/vocabulary?page=3', 'Back to vocabulary')

  expect(readBackTarget(state, { path: '/app/today', label: 'Back to today’s plan' })).toEqual({
    path: '/app/vocabulary?page=3',
    label: 'Back to vocabulary',
  })
})

test.each([
  ['no state', null],
  ['undefined state', undefined],
  ['a string', 'oops'],
  ['an empty object', {}],
  ['a missing target', { backTo: null }],
  ['a path outside the app', { backTo: { path: 'https://example.com/', label: 'Back' } }],
  ['a protocol-relative path', { backTo: { path: '//example.com/app/', label: 'Back' } }],
  ['a non-string path', { backTo: { path: 7, label: 'Back' } }],
  ['a missing label', { backTo: { path: '/app/today' } }],
])('falls back to the default for %s', (_name, state) => {
  expect(readBackTarget(state, fallback)).toBe(fallback)
})
