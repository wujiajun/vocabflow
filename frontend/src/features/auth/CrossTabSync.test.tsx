import { act, cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, getToken, setToken, TOKEN_STORAGE_KEY } from '../../shared/api/tokenStorage'
import { errorResponse, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user, emptyStudyQueue} from '../../test/utils'

const cachedUserDataKey = ['test', 'cached-user-data'] as const
const otherUser = { ...user, id: 2, email: 'other@example.com' }

beforeEach(() => {
  clearToken()
  setToken('first-token')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

// Another tab changed storage; the browser then tells this tab with a storage event.
function otherTabChangesStorage(change: () => void, key: string | null = TOKEN_STORAGE_KEY) {
  change()
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key }))
  })
}

function signedInApi() {
  return stubApi({
    // Like the real server, refuse a request without a token. Rarely, a query that was just mounting
    // when the session ended still fires one; answering it with a user would refill the cache.
    'GET /api/v1/auth/me': ({ init }) => {
      const authorization = new Headers(init.headers).get('Authorization')
      if (authorization === null) {
        return errorResponse(401, 'UNAUTHORIZED', 'Authentication is required')
      }
      return jsonResponse(authorization === 'Bearer second-token' ? otherUser : user)
    },
    'GET /api/v1/learning/study-queue': () => jsonResponse(emptyStudyQueue),
  })
}

test('signs out here, without a notice, when another tab signs out', async () => {
  signedInApi()

  const { queryClient } = renderApp('/app', (client) => client.setQueryData(cachedUserDataKey, { content: [] }))
  await screen.findByRole('heading', { name: 'Study' })

  otherTabChangesStorage(clearToken)

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(queryClient.getQueryData(cachedUserDataKey)).toBeUndefined()
  expect(queryClient.getQueryData(['auth', 'current-user'])).toBeUndefined()
})

test('signs in here when another tab signs in', async () => {
  clearToken()
  signedInApi()

  renderApp('/login')
  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()

  otherTabChangesStorage(() => setToken('first-token'))

  expect(await screen.findByRole('heading', { name: 'Study' })).toBeInTheDocument()
})

test('switches to the new account and drops the previous account’s data when another tab signs in as someone else', async () => {
  signedInApi()

  const { queryClient } = renderApp('/app', (client) => client.setQueryData(cachedUserDataKey, { content: ['old'] }))
  await screen.findByRole('heading', { name: 'Study' })
  expect(await screen.findByText(user.email)).toBeInTheDocument()

  otherTabChangesStorage(() => setToken('second-token'))

  expect(await screen.findByText(otherUser.email)).toBeInTheDocument()
  expect(screen.queryByText(user.email)).not.toBeInTheDocument()
  expect(queryClient.getQueryData(cachedUserDataKey)).toBeUndefined()
  expect(getToken()).toBe('second-token')
})

test('also follows a storage.clear() in another tab', async () => {
  signedInApi()

  renderApp('/app')
  await screen.findByRole('heading', { name: 'Study' })

  otherTabChangesStorage(() => localStorage.clear(), null)

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
})

test('does nothing when storage changes but the token does not', async () => {
  signedInApi()

  renderApp('/app')
  await screen.findByRole('heading', { name: 'Study' })

  otherTabChangesStorage(() => localStorage.setItem('something-else', 'x'), 'something-else')
  otherTabChangesStorage(() => undefined)

  expect(screen.getByRole('heading', { name: 'Study' })).toBeInTheDocument()
  expect(getToken()).toBe('first-token')
})

test('stops listening once the app is unmounted', async () => {
  signedInApi()
  const { unmount } = renderApp('/app')
  await screen.findByRole('heading', { name: 'Study' })
  const removeListener = vi.spyOn(window, 'removeEventListener')

  unmount()

  expect(removeListener).toHaveBeenCalledWith('storage', expect.any(Function))
})
