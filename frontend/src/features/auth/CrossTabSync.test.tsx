import { act, cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, getToken, setToken, TOKEN_STORAGE_KEY } from '../../shared/api/tokenStorage'
import { expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'

const emptyVocabularyPage = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }
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
    'GET /api/v1/auth/me': ({ init }) =>
      jsonResponse(new Headers(init.headers).get('Authorization') === 'Bearer second-token' ? otherUser : user),
    'GET /api/v1/vocabulary': () => jsonResponse(emptyVocabularyPage),
  })
}

test('signs out here, without a notice, when another tab signs out', async () => {
  signedInApi()

  const { queryClient } = renderApp('/app', (client) => client.setQueryData(cachedUserDataKey, { content: [] }))
  await screen.findByRole('heading', { name: 'Your vocabulary' })

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

  expect(await screen.findByRole('heading', { name: 'Your vocabulary' })).toBeInTheDocument()
})

test('switches to the new account and drops the previous account’s data when another tab signs in as someone else', async () => {
  signedInApi()

  const { queryClient } = renderApp('/app', (client) => client.setQueryData(cachedUserDataKey, { content: ['old'] }))
  await screen.findByRole('heading', { name: 'Your vocabulary' })
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
  await screen.findByRole('heading', { name: 'Your vocabulary' })

  otherTabChangesStorage(() => localStorage.clear(), null)

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
})

test('does nothing when storage changes but the token does not', async () => {
  signedInApi()

  renderApp('/app')
  await screen.findByRole('heading', { name: 'Your vocabulary' })

  otherTabChangesStorage(() => localStorage.setItem('something-else', 'x'), 'something-else')
  otherTabChangesStorage(() => undefined)

  expect(screen.getByRole('heading', { name: 'Your vocabulary' })).toBeInTheDocument()
  expect(getToken()).toBe('first-token')
})

test('stops listening once the app is unmounted', async () => {
  signedInApi()
  const { unmount } = renderApp('/app')
  await screen.findByRole('heading', { name: 'Your vocabulary' })
  const removeListener = vi.spyOn(window, 'removeEventListener')

  unmount()

  expect(removeListener).toHaveBeenCalledWith('storage', expect.any(Function))
})
