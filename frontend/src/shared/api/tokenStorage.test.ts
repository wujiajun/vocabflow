import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, getToken, setToken } from './tokenStorage'

beforeEach(() => {
  clearToken()
})

afterEach(() => {
  vi.restoreAllMocks()
  clearToken()
})

test('stores and reads back a token', () => {
  setToken('abc')

  expect(getToken()).toBe('abc')
  expect(localStorage.getItem('vocabflow.access-token')).toBe('abc')
})

test('treats an unreadable store as signed out instead of throwing', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('denied', 'SecurityError')
  })

  expect(getToken()).toBeNull()
})

test('keeps the token for this tab when it cannot be written to storage', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError')
  })

  expect(() => setToken('abc')).not.toThrow()
  expect(getToken()).toBe('abc')
})

test('clearing removes the in-memory fallback too, even when storage throws', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError')
  })
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new DOMException('denied', 'SecurityError')
  })
  setToken('abc')

  expect(() => clearToken()).not.toThrow()
  expect(getToken()).toBeNull()
})

test('a successful write replaces an earlier in-memory fallback', () => {
  const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
    throw new DOMException('full', 'QuotaExceededError')
  })
  setToken('old')
  setItem.mockRestore()

  setToken('new')
  localStorage.removeItem('vocabflow.access-token')

  expect(getToken()).toBeNull()
})
