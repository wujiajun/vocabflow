import { afterEach, expect, test, vi } from 'vitest'
import { apiClient } from './apiClient'
import { clearToken, setToken } from './tokenStorage'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

test('adds an Authorization header when a token is stored', async () => {
  setToken('stored-token')
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
  vi.stubGlobal('fetch', fetchMock)

  await apiClient('/api/v1/auth/me')

  const request = fetchMock.mock.calls[0]?.[1] as RequestInit
  expect(new Headers(request.headers).get('Authorization')).toBe('Bearer stored-token')
})

test('does not add an Authorization header when no token is stored', async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
  vi.stubGlobal('fetch', fetchMock)

  await apiClient('/api/v1/auth/me')

  const request = fetchMock.mock.calls[0]?.[1] as RequestInit
  expect(new Headers(request.headers).get('Authorization')).toBeNull()
})

test('parses backend API errors consistently', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse(
        { code: 'CONFLICT', message: 'Email is already registered', timestamp: '2026-10-20T00:00:00Z' },
        409,
      ),
    ),
  )

  await expect(apiClient('/api/v1/auth/register')).rejects.toMatchObject(
    {
      code: 'CONFLICT',
      message: 'Email is already registered',
      status: 409,
    },
  )
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
