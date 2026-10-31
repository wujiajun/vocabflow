import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { notifyTokenRejected } from '../../shared/api/sessionEvents'
import { clearToken, getToken, setToken } from '../../shared/api/tokenStorage'
import {
  errorResponse,
  expectNoUnexpectedRequests,
  jsonResponse,
  renderApp,
  stubApi,
  user,
  emptyStudyQueue,
} from '../../test/utils'
import { AuthTokenProvider } from './hooks/AuthTokenProvider'
import { useAuthToken } from './hooks/authTokenContext'

const emptyVocabularyPage = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }
const cachedUserDataKey = ['test', 'cached-user-data'] as const
const unauthorized = () => errorResponse(401, 'UNAUTHORIZED', 'Authentication is required')
const signedOutNotice = 'You’ve been signed out. Please sign in again to continue.'

beforeEach(() => {
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

test('signs the user out with an explanation when any query is rejected with a 401', async () => {
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/learning/study-queue': unauthorized,
  })

  const { queryClient } = renderApp('/app/study', (client) => client.setQueryData(cachedUserDataKey, { content: [] }))

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent(signedOutNotice)
  expect(getToken()).toBeNull()
  expect(queryClient.getQueryData(cachedUserDataKey)).toBeUndefined()
  expect(queryClient.getQueryData(['auth', 'current-user'])).toBeUndefined()
})

test('signs the user out when a mutation is rejected with a 401', async () => {
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary': () => jsonResponse(emptyVocabularyPage),
    'POST /api/v1/vocabulary': unauthorized,
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary')
  await browserUser.type(await screen.findByLabelText('New word or phrase'), 'overwhelmed')
  await browserUser.click(screen.getByRole('button', { name: 'Add' }))

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent(signedOutNotice)
  expect(getToken()).toBeNull()
})

test('explains the sign-out when a stored token is rejected on the first load', async () => {
  stubApi({ 'GET /api/v1/auth/me': unauthorized })

  renderApp('/app')

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent(signedOutNotice)
})

test('does not treat a wrong password as a rejected session', async () => {
  clearToken()
  stubApi({
    'POST /api/v1/auth/login': () => errorResponse(401, 'UNAUTHORIZED', 'Invalid email or password'),
  })
  const browserUser = userEvent.setup()

  renderApp('/login')
  await browserUser.type(screen.getByLabelText('Email'), user.email)
  await browserUser.type(screen.getByLabelText('Password'), 'wrong-password')
  await browserUser.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('does not explain a sign-out the user asked for, even when the backend answers 401', async () => {
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/learning/study-queue': () => jsonResponse(emptyStudyQueue),
    'POST /api/v1/auth/logout': unauthorized,
  })
  const browserUser = userEvent.setup()

  renderApp('/app')
  await screen.findByRole('heading', { name: 'Study' })
  await browserUser.click(screen.getByRole('button', { name: 'Sign out' }))

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('drops the explanation once the user signs in again', async () => {
  let queueCalls = 0
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/learning/study-queue': () => {
      queueCalls += 1
      return queueCalls === 1 ? unauthorized() : jsonResponse(emptyStudyQueue)
    },
    'POST /api/v1/auth/login': () => jsonResponse({ accessToken: 'new-token', user }),
    'POST /api/v1/auth/logout': () => new Response(null, { status: 204 }),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  expect(await screen.findByText(signedOutNotice)).toBeInTheDocument()

  await browserUser.type(screen.getByLabelText('Email'), user.email)
  await browserUser.type(screen.getByLabelText('Password'), 'password123')
  await browserUser.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByRole('heading', { name: 'Study' })
  await browserUser.click(screen.getByRole('button', { name: 'Sign out' }))

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('does not tell a user who has just registered that they were signed out', async () => {
  stubApi({
    'GET /api/v1/auth/me': unauthorized,
    'POST /api/v1/auth/register': () => jsonResponse(user),
  })
  const browserUser = userEvent.setup()

  renderApp('/register')
  await browserUser.type(await screen.findByLabelText('Email'), user.email)
  await browserUser.type(screen.getByLabelText('Password'), 'password123')
  await browserUser.click(screen.getByRole('button', { name: 'Create account' }))

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('ignores a late rejection of a token that has already been replaced', () => {
  setToken('old-token')
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <AuthTokenProvider>
        <TokenProbe />
      </AuthTokenProvider>
    </QueryClientProvider>,
  )

  act(() => screen.getByRole('button', { name: 'Store new token' }).click())
  act(() => notifyTokenRejected('old-token'))

  expect(screen.getByTestId('token')).toHaveTextContent('new-token')
  expect(screen.getByTestId('signed-out')).toHaveTextContent('false')
  expect(getToken()).toBe('new-token')

  act(() => notifyTokenRejected('new-token'))

  expect(screen.getByTestId('token')).toHaveTextContent('none')
  expect(screen.getByTestId('signed-out')).toHaveTextContent('true')
  expect(getToken()).toBeNull()
})

function TokenProbe() {
  const { token, signedOutUnexpectedly, storeToken } = useAuthToken()

  return (
    <>
      <p data-testid="token">{token ?? 'none'}</p>
      <p data-testid="signed-out">{String(signedOutUnexpectedly)}</p>
      <button onClick={() => storeToken('new-token')} type="button">
        Store new token
      </button>
    </>
  )
}
