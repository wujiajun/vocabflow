import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { apiClient } from './apiClient'
import { onTokenRejected } from './sessionEvents'
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

describe('rejected tokens', () => {
  const rejected = vi.fn()
  let unsubscribe: () => void

  beforeEach(() => {
    rejected.mockReset()
    unsubscribe = onTokenRejected(rejected)
  })

  afterEach(() => {
    unsubscribe()
  })

  test('reports a 401 for a request that carried a token, with that token', async () => {
    setToken('stored-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ code: 'UNAUTHORIZED', message: 'No' }, 401)))

    await expect(apiClient('/api/v1/vocabulary')).rejects.toMatchObject({ status: 401 })

    expect(rejected).toHaveBeenCalledTimes(1)
    expect(rejected).toHaveBeenCalledWith('stored-token')
  })

  test('does not report a 401 for a request without a token, such as a wrong password', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ code: 'UNAUTHORIZED', message: 'No' }, 401)))

    await expect(apiClient('/api/v1/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 401 })

    expect(rejected).not.toHaveBeenCalled()
  })

  test.each([400, 403, 404, 409, 500])('does not report a %i response', async (status) => {
    setToken('stored-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ code: 'OTHER', message: 'No' }, status)))

    await expect(apiClient('/api/v1/vocabulary')).rejects.toMatchObject({ status })

    expect(rejected).not.toHaveBeenCalled()
  })

  test('does not report a 401 when the request opts out', async () => {
    setToken('stored-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ code: 'UNAUTHORIZED', message: 'No' }, 401)))

    await expect(
      apiClient('/api/v1/auth/logout', { method: 'POST', notifyOnUnauthorized: false }),
    ).rejects.toMatchObject({ status: 401 })

    expect(rejected).not.toHaveBeenCalled()
  })

  test('does not report anything after the listener is removed', async () => {
    setToken('stored-token')
    unsubscribe()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ code: 'UNAUTHORIZED', message: 'No' }, 401)))

    await expect(apiClient('/api/v1/vocabulary')).rejects.toMatchObject({ status: 401 })

    expect(rejected).not.toHaveBeenCalled()
  })
})

test('resolves undefined for a 204 response without a body', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

  await expect(apiClient('/api/v1/auth/logout', { method: 'POST' })).resolves.toBeUndefined()
})

test.each([
  ['an empty body', ''],
  ['malformed JSON', '{"id":'],
])('wraps a 200 JSON response with %s in an ApiClientError', async (_name, body) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ),
  )

  await expect(apiClient('/api/v1/auth/me')).rejects.toMatchObject({
    name: 'ApiClientError',
    status: 200,
    message: 'Received an unexpected response from VocabFlow. Please try again.',
  })
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
