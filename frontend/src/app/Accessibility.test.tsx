import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../shared/api/tokenStorage'
import { errorResponse, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../test/utils'

const overwhelmed = entry(7, 'overwhelmed')
const figureOut = entry(8, 'figure out')

beforeEach(() => {
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

test.each([
  ['/login', 'Sign in · VocabFlow'],
  ['/register', 'Create account · VocabFlow'],
])('titles %s so a screen reader can tell where it is', async (path, title) => {
  clearToken()
  stubApi({})

  renderApp(path)

  expect(document.title).toBe(title)
})

test('gives every signed-in page its own title', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary': () => jsonResponse(vocabularyPage([overwhelmed])),
    'GET /api/v1/vocabulary/7': () => jsonResponse(overwhelmed),
    'GET /api/v1/learning/daily-plan': () => jsonResponse({ date: '2026-10-30', newVocabularyGoal: 10, newItems: [], reviewItems: [] }),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary')
  await screen.findByRole('heading', { name: 'Your vocabulary' })
  expect(document.title).toBe('Your vocabulary · VocabFlow')

  await browserUser.click(await screen.findByRole('link', { name: /overwhelmed/ }))
  await screen.findByRole('heading', { name: 'overwhelmed' })
  expect(document.title).toBe('overwhelmed · VocabFlow')

  await browserUser.click(screen.getByRole('link', { name: 'Today' }))
  await screen.findByRole('heading', { name: 'Today’s plan' })
  expect(document.title).toBe('Today’s plan · VocabFlow')
})

test('offers a skip link as the first stop that moves focus to the page content', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/vocabulary': () => jsonResponse(vocabularyPage([overwhelmed])) })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary')
  await screen.findByRole('heading', { name: 'Your vocabulary' })
  await browserUser.tab()

  const skipLink = screen.getByRole('link', { name: 'Skip to main content' })
  expect(skipLink).toHaveFocus()
  await browserUser.keyboard('{Enter}')

  expect(screen.getByRole('main')).toHaveFocus()
})

test('does not take focus when a page first loads', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/vocabulary': () => jsonResponse(vocabularyPage([overwhelmed])) })

  renderApp('/app/vocabulary')
  await screen.findByRole('heading', { name: 'Your vocabulary' })

  expect(document.body).toHaveFocus()
})

test('moves focus to the page content after navigating to another page', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary': () => jsonResponse(vocabularyPage([overwhelmed])),
    'GET /api/v1/vocabulary/7': () => jsonResponse(overwhelmed),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary')
  await browserUser.click(await screen.findByRole('link', { name: /overwhelmed/ }))
  await screen.findByRole('heading', { name: 'overwhelmed' })
  expect(screen.getByRole('main')).toHaveFocus()

  await browserUser.click(screen.getByRole('link', { name: '← Back to vocabulary' }))
  await screen.findByRole('heading', { name: 'Your vocabulary' })
  expect(screen.getByRole('main')).toHaveFocus()
})

test('keeps focus on the same control when only the page number changes', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary': ({ url }) =>
      url.searchParams.get('page') === '1'
        ? jsonResponse({ ...vocabularyPage([figureOut], 2, 21), page: 1 })
        : jsonResponse(vocabularyPage([overwhelmed], 2, 21)),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary')
  await screen.findByText('Page 1 of 2')
  expect(screen.getByRole('main')).not.toHaveFocus()
  await browserUser.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('figure out')

  expect(screen.getByRole('main')).not.toHaveFocus()
})

test('does not drop focus on the page when the Next button becomes disabled, and announces the new page', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary': ({ url }) =>
      url.searchParams.get('page') === '1'
        ? jsonResponse({ ...vocabularyPage([figureOut], 2, 21), page: 1 })
        : jsonResponse(vocabularyPage([overwhelmed], 2, 21)),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary')
  await screen.findByText('Page 1 of 2')
  screen.getByRole('button', { name: 'Next' }).focus()
  await browserUser.keyboard('{Enter}')
  await screen.findByText('figure out')

  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  expect(document.body).not.toHaveFocus()
  expect(screen.getByRole('region', { name: 'Saved vocabulary' })).toHaveFocus()
  expect(within(screen.getByRole('navigation', { name: 'Vocabulary pages' })).getByRole('status')).toHaveTextContent('Page 2 of 2')
})

test('ties a form error to the field it is about', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/vocabulary': () => jsonResponse(vocabularyPage([])) })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary')
  const input = await screen.findByLabelText('New word or phrase')
  expect(input).not.toHaveAttribute('aria-invalid')
  await browserUser.click(screen.getByRole('button', { name: 'Add' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Enter a word or phrase.')
  expect(input).toHaveAttribute('aria-invalid', 'true')
  expect(input).toHaveAccessibleDescription('Enter a word or phrase.')
  expect(input).toHaveFocus()
})

test('ties a server error on the add form to the field too', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary': () => jsonResponse(vocabularyPage([overwhelmed])),
    'POST /api/v1/vocabulary': () => errorResponse(409, 'CONFLICT', 'This vocabulary is already in your list'),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary')
  const input = await screen.findByLabelText('New word or phrase')
  await browserUser.type(input, 'overwhelmed')
  await browserUser.click(screen.getByRole('button', { name: 'Add' }))

  await screen.findByRole('alert')
  expect(input).toHaveAttribute('aria-invalid', 'true')
  expect(input).toHaveAccessibleDescription('This vocabulary is already in your list')
})

test('announces a successfully added word', async () => {
  let saved = [overwhelmed]
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary': () => jsonResponse(vocabularyPage(saved)),
    'POST /api/v1/vocabulary': () => {
      saved = [figureOut, overwhelmed]
      return jsonResponse(figureOut)
    },
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary')
  const input = await screen.findByLabelText('New word or phrase')
  const form = input.closest('form')!
  expect(within(form).getByRole('status')).toBeEmptyDOMElement()
  await browserUser.type(input, 'figure out')
  await browserUser.click(screen.getByRole('button', { name: 'Add' }))

  await waitFor(() => expect(within(form).getByRole('status')).toHaveTextContent('Added “figure out”.'))
  expect(input).toHaveFocus()

  await browserUser.type(input, 'x')
  expect(screen.queryByText('Added “figure out”.')).not.toBeInTheDocument()
})

test('ties the sign-in error to both fields', async () => {
  clearToken()
  stubApi({ 'POST /api/v1/auth/login': () => errorResponse(401, 'UNAUTHORIZED', 'Invalid email or password') })
  const browserUser = userEvent.setup()

  renderApp('/login')
  await browserUser.type(screen.getByLabelText('Email'), user.email)
  await browserUser.type(screen.getByLabelText('Password'), 'wrong-password')
  await browserUser.click(screen.getByRole('button', { name: 'Sign in' }))

  await screen.findByRole('alert')
  for (const field of [screen.getByLabelText('Email'), screen.getByLabelText('Password')]) {
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Invalid email or password')
  }
})

function signedIn() {
  return { 'GET /api/v1/auth/me': () => jsonResponse(user) }
}

function vocabularyPage(content: ReturnType<typeof entry>[], totalPages = content.length === 0 ? 0 : 1, totalElements = content.length) {
  return { content, page: 0, size: 20, totalElements, totalPages }
}

function entry(id: number, term: string) {
  return {
    id,
    term,
    type: null,
    phonetic: null,
    partOfSpeech: null,
    definition: null,
    examples: null,
    collocations: null,
    enrichmentStatus: 'COMPLETED' as const,
    learningStatus: 'NEW' as const,
    createdAt: '2026-10-20T12:00:00Z',
  }
}

test('ties the registration error to the fields it may be about', async () => {
  clearToken()
  stubApi({})
  const browserUser = userEvent.setup()

  renderApp('/register')
  await browserUser.click(screen.getByRole('button', { name: 'Create account' }))

  await screen.findByRole('alert')
  for (const field of [screen.getByLabelText('Email'), screen.getByLabelText('Password'), screen.getByLabelText('Daily new vocabulary goal')]) {
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Enter your email and password.')
  }
})
