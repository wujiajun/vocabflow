import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, getToken, setToken } from '../../shared/api/tokenStorage'
import {
  errorResponse,
  expectNoUnexpectedRequests,
  jsonResponse,
  renderApp,
  stubApi,
  user,
} from '../../test/utils'

const emptyVocabularyPage = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }
const cachedUserDataKey = ['test', 'cached-user-data'] as const
const unauthorized = () => errorResponse(401, 'UNAUTHORIZED', 'Authentication is required')

beforeEach(() => {
  clearToken()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

test('does not request the current user when no token exists and protects /app', async () => {
  const fetchMock = stubApi({})

  renderApp('/app')

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('loads the current user when a valid token exists and renders /app', async () => {
  setToken('valid-token')
  const fetchMock = stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary': () => jsonResponse(emptyVocabularyPage),
  })

  renderApp('/app')

  expect(await screen.findByRole('heading', { name: 'Your vocabulary' })).toBeInTheDocument()
  expect(screen.getByText(user.email)).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/auth/me',
    expect.objectContaining({ headers: expect.any(Headers) }),
  )
})

test('clears a stale token and redirects to login', async () => {
  setToken('stale-token')
  stubApi({ 'GET /api/v1/auth/me': unauthorized })

  renderApp('/app')

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  expect(getToken()).toBeNull()
})

test('validates and completes login with a persisted token', async () => {
  const fetchMock = stubApi({
    'POST /api/v1/auth/login': () => jsonResponse({ accessToken: 'new-token', user }),
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary': () => jsonResponse(emptyVocabularyPage),
  })
  const browserUser = userEvent.setup()

  renderApp('/login')
  await browserUser.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Enter your email and password.')
  expect(fetchMock).not.toHaveBeenCalled()

  await browserUser.type(screen.getByLabelText('Email'), user.email)
  await browserUser.type(screen.getByLabelText('Password'), 'password123')
  await browserUser.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('heading', { name: 'Your vocabulary' })).toBeInTheDocument()
  expect(getToken()).toBe('new-token')
})

test('displays a failed login error', async () => {
  stubApi({
    'POST /api/v1/auth/login': () => errorResponse(401, 'UNAUTHORIZED', 'Invalid email or password'),
  })
  const browserUser = userEvent.setup()

  renderApp('/login')
  await browserUser.type(screen.getByLabelText('Email'), user.email)
  await browserUser.type(screen.getByLabelText('Password'), 'incorrect-password')
  await browserUser.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
})

test('registers with all backend fields and redirects to login', async () => {
  const fetchMock = stubApi({ 'POST /api/v1/auth/register': () => jsonResponse(user) })
  const browserUser = userEvent.setup()

  renderApp('/register')
  expect(screen.getByLabelText('CLB level')).toBeInTheDocument()
  expect(screen.getByLabelText('Daily new vocabulary goal')).toBeInTheDocument()
  await browserUser.type(screen.getByLabelText('Email'), user.email)
  await browserUser.type(screen.getByLabelText('Password'), 'password123')
  await browserUser.click(screen.getByRole('button', { name: 'Create account' }))

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/auth/register',
    expect.objectContaining({ method: 'POST' }),
  )
})

test('displays backend registration validation errors', async () => {
  stubApi({
    'POST /api/v1/auth/register': () => errorResponse(409, 'CONFLICT', 'Email is already registered'),
  })
  const browserUser = userEvent.setup()

  renderApp('/register')
  await browserUser.type(screen.getByLabelText('Email'), user.email)
  await browserUser.type(screen.getByLabelText('Password'), 'password123')
  await browserUser.click(screen.getByRole('button', { name: 'Create account' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Email is already registered')
})

test('clears local auth and redirects after logout even when backend logout fails', async () => {
  setToken('valid-token')
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary': () => jsonResponse(emptyVocabularyPage),
    'POST /api/v1/auth/logout': unauthorized,
  })
  const browserUser = userEvent.setup()

  renderApp('/app')
  await screen.findByRole('heading', { name: 'Your vocabulary' })
  await browserUser.click(screen.getByRole('button', { name: 'Sign out' }))

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  await waitFor(() => expect(getToken()).toBeNull())
})

test('shows a retry screen when the first session check cannot reach the server, then recovers', async () => {
  setToken('valid-token')
  let meCalls = 0
  stubApi({
    'GET /api/v1/auth/me': () => {
      meCalls += 1
      if (meCalls === 1) {
        throw new TypeError('Failed to fetch')
      }
      return jsonResponse(user)
    },
    'GET /api/v1/vocabulary': () => jsonResponse(emptyVocabularyPage),
  })
  const browserUser = userEvent.setup()

  renderApp('/app')

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach VocabFlow. Please try again.')
  expect(screen.queryByText('Checking your session…')).not.toBeInTheDocument()
  expect(getToken()).toBe('valid-token')

  await browserUser.click(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByRole('heading', { name: 'Your vocabulary' })).toBeInTheDocument()
  expect(meCalls).toBeGreaterThanOrEqual(2)
})

test('lets the user sign out locally when the session check keeps failing with a server error', async () => {
  setToken('valid-token')
  const fetchMock = stubApi({
    'GET /api/v1/auth/me': () => errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred'),
  })
  const browserUser = userEvent.setup()

  renderApp('/app')

  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
  await browserUser.click(screen.getByRole('button', { name: 'Sign out' }))

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  expect(getToken()).toBeNull()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('shows the same retry screen on a public route when a stored token cannot be checked', async () => {
  setToken('valid-token')
  stubApi({
    'GET /api/v1/auth/me': () => {
      throw new TypeError('Failed to fetch')
    },
  })

  renderApp('/login')

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach VocabFlow. Please try again.')
  expect(screen.queryByRole('heading', { name: 'Welcome back' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})

test('shows the retry screen from the root route when the session check fails', async () => {
  setToken('valid-token')
  stubApi({
    'GET /api/v1/auth/me': () => {
      throw new TypeError('Failed to fetch')
    },
  })

  renderApp('/')

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach VocabFlow. Please try again.')
  expect(screen.queryByText('Checking your session…')).not.toBeInTheDocument()
})

test('redirects a signed-in user away from the public login route', async () => {
  setToken('valid-token')
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary': () => jsonResponse(emptyVocabularyPage),
  })

  renderApp('/login')

  expect(await screen.findByRole('heading', { name: 'Your vocabulary' })).toBeInTheDocument()
})

test('displays backend 400 validation errors on registration', async () => {
  stubApi({
    'POST /api/v1/auth/register': () =>
      errorResponse(400, 'VALIDATION_ERROR', 'Daily new vocabulary goal must be between 1 and 100'),
  })
  const browserUser = userEvent.setup()

  renderApp('/register')
  await browserUser.type(screen.getByLabelText('Email'), user.email)
  await browserUser.type(screen.getByLabelText('Password'), 'password123')
  await browserUser.click(screen.getByRole('button', { name: 'Create account' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Daily new vocabulary goal must be between 1 and 100',
  )
})

test('signs out cleanly when the backend logout returns an empty success response', async () => {
  setToken('valid-token')
  const fetchMock = stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary': () => jsonResponse(emptyVocabularyPage),
    'POST /api/v1/auth/logout': () => new Response(null, { status: 204 }),
  })
  const browserUser = userEvent.setup()

  renderApp('/app')
  await screen.findByRole('heading', { name: 'Your vocabulary' })
  await browserUser.click(screen.getByRole('button', { name: 'Sign out' }))

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  await waitFor(() => expect(getToken()).toBeNull())
  expect(fetchMock).toHaveBeenLastCalledWith(
    '/api/v1/auth/logout',
    expect.objectContaining({ method: 'POST' }),
  )
})

test('drops cached user data when the user signs out', async () => {
  setToken('valid-token')
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary': () => jsonResponse(emptyVocabularyPage),
    'POST /api/v1/auth/logout': () => new Response(null, { status: 204 }),
  })
  const browserUser = userEvent.setup()

  const { queryClient } = renderApp('/app')
  await screen.findByRole('heading', { name: 'Your vocabulary' })
  queryClient.setQueryData(cachedUserDataKey, { content: [] })
  await browserUser.click(screen.getByRole('button', { name: 'Sign out' }))

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  expect(queryClient.getQueryData(cachedUserDataKey)).toBeUndefined()
  expect(queryClient.getQueryData(['auth', 'current-user'])).toBeUndefined()
  expect(queryClient.getQueryData(['vocabulary', 'list', 0, 20])).toBeUndefined()
})

test('drops cached user data when a stale token is rejected', async () => {
  setToken('stale-token')
  stubApi({ 'GET /api/v1/auth/me': unauthorized })

  const { queryClient } = renderApp('/app', (client) => client.setQueryData(cachedUserDataKey, { content: [] }))

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  expect(queryClient.getQueryData(cachedUserDataKey)).toBeUndefined()
})

test('drops cached user data when the session is discarded from the retry screen', async () => {
  setToken('valid-token')
  stubApi({
    'GET /api/v1/auth/me': () => {
      throw new TypeError('Failed to fetch')
    },
  })
  const browserUser = userEvent.setup()

  const { queryClient } = renderApp('/app', (client) => client.setQueryData(cachedUserDataKey, { content: [] }))
  await screen.findByRole('alert')
  await browserUser.click(screen.getByRole('button', { name: 'Sign out' }))

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  expect(queryClient.getQueryData(cachedUserDataKey)).toBeUndefined()
})

test('does not show a previous user’s cached data after a new login', async () => {
  stubApi({
    'POST /api/v1/auth/login': () => jsonResponse({ accessToken: 'second-token', user }),
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary': () => jsonResponse(emptyVocabularyPage),
  })
  const browserUser = userEvent.setup()

  const { queryClient } = renderApp('/login', (client) => client.setQueryData(cachedUserDataKey, { content: [] }))
  await browserUser.type(screen.getByLabelText('Email'), user.email)
  await browserUser.type(screen.getByLabelText('Password'), 'password123')
  await browserUser.click(screen.getByRole('button', { name: 'Sign in' }))

  await screen.findByRole('heading', { name: 'Your vocabulary' })
  expect(queryClient.getQueryData(cachedUserDataKey)).toBeUndefined()
})
