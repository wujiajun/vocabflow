import { expect, test } from 'vitest'
import { pageFromParam, paramFromPage } from './pageParam'

test('turns the 1-based page number in the URL into a 0-based page', () => {
  expect(pageFromParam('1')).toBe(0)
  expect(pageFromParam('3')).toBe(2)
})

test.each([null, '', 'abc', '0', '-2', '2.5', ' 2', '2 ', '1e3', '٣'])('treats %j as the first page', (value) => {
  expect(pageFromParam(value)).toBe(0)
})

test('caps absurd page numbers instead of passing them to the API', () => {
  expect(pageFromParam('99999999999999999999999')).toBe(99_999)
})

test('writes nothing for the first page and the 1-based number otherwise', () => {
  expect(paramFromPage(0)).toBeUndefined()
  expect(paramFromPage(-1)).toBeUndefined()
  expect(paramFromPage(2)).toBe('3')
})
