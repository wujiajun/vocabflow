import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { App } from '../../app/App'
import { clearToken, getToken, setToken } from '../../shared/api/tokenStorage'
import { AuthTokenProvider } from './hooks/AuthTokenProvider'

const user = {
  id: 1,
  email: 'learner@example.com',
  clbLevel: 'CLB_4',
  dailyNewVocabularyGoal: 10,
} as const

beforeEach(() => {
  clearToken()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('does not request the current user when no token exists and protects /app', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)

  renderApp('/app')

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('loads the current user when a valid token exists and renders /app', async () => {
  setToken('valid-token')
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(user))
  vi.stubGlobal('fetch', fetchMock)

  renderApp('/app')

  expect(await screen.findByRole('heading', { name: 'Your learning space is ready' })).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/auth/me',
    expect.objectContaining({ headers: expect.any(Headers) }),
  )
})

test('clears a stale token and redirects to login', async () => {
  setToken('stale-token')
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse(
        { code: 'UNAUTHORIZED', message: 'Authentication is required', timestamp: '2026-10-20T00:00:00Z' },
        401,
      ),
    ),
  )

  renderApp('/app')

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  expect(getToken()).toBeNull()
})

test('validates and completes login with a persisted token', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse({ accessToken: 'new-token', user }))
    .mockResolvedValueOnce(jsonResponse(user))
  vi.stubGlobal('fetch', fetchMock)
  const browserUser = userEvent.setup()

  renderApp('/login')
  await browserUser.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Enter your email and password.')
  expect(fetchMock).not.toHaveBeenCalled()

  await browserUser.type(screen.getByLabelText('Email'), user.email)
  await browserUser.type(screen.getByLabelText('Password'), 'password123')
  await browserUser.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('heading', { name: 'Your learning space is ready' })).toBeInTheDocument()
  expect(getToken()).toBe('new-token')
})

test('displays a failed login error', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse(
        { code: 'UNAUTHORIZED', message: 'Invalid email or password', timestamp: '2026-10-20T00:00:00Z' },
        401,
      ),
    ),
  )
  const browserUser = userEvent.setup()

  renderApp('/login')
  await browserUser.type(screen.getByLabelText('Email'), user.email)
  await browserUser.type(screen.getByLabelText('Password'), 'incorrect-password')
  await browserUser.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
})

test('registers with all backend fields and redirects to login', async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(user))
  vi.stubGlobal('fetch', fetchMock)
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
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse(
        { code: 'CONFLICT', message: 'Email is already registered', timestamp: '2026-10-20T00:00:00Z' },
        409,
      ),
    ),
  )
  const browserUser = userEvent.setup()

  renderApp('/register')
  await browserUser.type(screen.getByLabelText('Email'), user.email)
  await browserUser.type(screen.getByLabelText('Password'), 'password123')
  await browserUser.click(screen.getByRole('button', { name: 'Create account' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Email is already registered')
})

test('clears local auth and redirects after logout even when backend logout fails', async () => {
  setToken('valid-token')
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse(user))
    .mockResolvedValueOnce(
      jsonResponse(
        { code: 'UNAUTHORIZED', message: 'Authentication is required', timestamp: '2026-10-20T00:00:00Z' },
        401,
      ),
    )
  vi.stubGlobal('fetch', fetchMock)
  const browserUser = userEvent.setup()

  renderApp('/app')
  await screen.findByRole('heading', { name: 'Your learning space is ready' })
  await browserUser.click(screen.getByRole('button', { name: 'Sign out' }))

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  await waitFor(() => expect(getToken()).toBeNull())
})

test('shows a retry screen when the first session check cannot reach the server, then recovers', async () => {
  setToken('valid-token')
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce(jsonResponse(user))
  vi.stubGlobal('fetch', fetchMock)
  const browserUser = userEvent.setup()

  renderApp('/app')

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach VocabFlow. Please try again.')
  expect(screen.queryByText('Checking your session…')).not.toBeInTheDocument()
  expect(getToken()).toBe('valid-token')

  await browserUser.click(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByRole('heading', { name: 'Your learning space is ready' })).toBeInTheDocument()
  expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
})

test('lets the user sign out locally when the session check keeps failing with a server error', async () => {
  setToken('valid-token')
  const fetchMock = vi.fn().mockResolvedValue(
    jsonResponse(
      { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', timestamp: '2026-10-20T00:00:00Z' },
      500,
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
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
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

  renderApp('/login')

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach VocabFlow. Please try again.')
  expect(screen.queryByRole('heading', { name: 'Welcome back' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})

test('shows the retry screen from the root route when the session check fails', async () => {
  setToken('valid-token')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

  renderApp('/')

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach VocabFlow. Please try again.')
  expect(screen.queryByText('Checking your session…')).not.toBeInTheDocument()
})

test('redirects a signed-in user away from the public login route', async () => {
  setToken('valid-token')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(user)))

  renderApp('/login')

  expect(await screen.findByRole('heading', { name: 'Your learning space is ready' })).toBeInTheDocument()
})

test('displays backend 400 validation errors on registration', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse(
        {
          code: 'VALIDATION_ERROR',
          message: 'Daily new vocabulary goal must be between 1 and 100',
          timestamp: '2026-10-20T00:00:00Z',
        },
        400,
      ),
    ),
  )
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
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse(user))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)
  const browserUser = userEvent.setup()

  renderApp('/app')
  await screen.findByRole('heading', { name: 'Your learning space is ready' })
  await browserUser.click(screen.getByRole('button', { name: 'Sign out' }))

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  await waitFor(() => expect(getToken()).toBeNull())
  expect(fetchMock).toHaveBeenLastCalledWith(
    '/api/v1/auth/logout',
    expect.objectContaining({ method: 'POST' }),
  )
})

function renderApp(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthTokenProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <App />
        </MemoryRouter>
      </AuthTokenProvider>
    </QueryClientProvider>,
  )
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
