import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../shared/api/tokenStorage'
import { emptyStudyQueue, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../test/utils'

beforeEach(() => {
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

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
    senses: [],
    enrichmentStatus: 'COMPLETED',
    failureReason: null,
    learningStatus: 'NEW',
    createdAt: '2026-10-20T12:00:00Z',
  }
}

const list = { content: [entry(1, 'one')], page: 0, size: 20, totalElements: 1, totalPages: 1 }

function api() {
  return stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/learning/study-queue': () => jsonResponse(emptyStudyQueue),
    'GET /api/v1/reading/today': () => jsonResponse({ passageId: null }),
    'GET /api/v1/vocabulary': () => jsonResponse(list),
    'GET /api/v1/vocabulary/1': () => jsonResponse(entry(1, 'one')),
    'GET /api/v1/reading/passages': () => jsonResponse({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
  })
}

test('switching between the top tabs adds nothing to the history', async () => {
  api()
  const browserUser = userEvent.setup()
  const app = renderApp('/app/study')
  await screen.findByRole('heading', { name: 'Study' })

  await browserUser.click(screen.getByRole('link', { name: 'Vocabulary' }))
  await browserUser.click(screen.getByRole('link', { name: 'Reading' }))
  await browserUser.click(screen.getByRole('link', { name: 'Settings' }))
  await screen.findByRole('heading', { name: 'Settings' })
  await app.goBack()

  // With one entry that every tab replaced, going back stays where it is (on a phone, it leaves the app).
  expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
})

test('choosing a filter replaces the list that was showing', async () => {
  api()
  const browserUser = userEvent.setup()
  const app = renderApp('/app/vocabulary')
  await screen.findByText('one')

  await browserUser.click(screen.getByRole('link', { name: 'Due today' }))
  await browserUser.click(screen.getByRole('link', { name: 'New' }))
  await app.goBack()

  expect(screen.getByRole('link', { name: 'New' })).toHaveAttribute('aria-current', 'true')
})

test('an entry opened from the list goes back one step, and the page is not stacked again', async () => {
  api()
  const browserUser = userEvent.setup()
  const app = renderApp('/app/vocabulary')
  await browserUser.click(await screen.findByRole('link', { name: /^one/ }))

  await browserUser.click(await screen.findByRole('link', { name: '← Back to vocabulary' }))
  await screen.findByRole('heading', { name: 'Your vocabulary' })
  // The list was the only entry: had the link added another, going back would show the entry again.
  await app.goBack()

  expect(screen.getByRole('heading', { name: 'Your vocabulary' })).toBeInTheDocument()
})

test('an entry opened straight from an address has nothing behind it, so back takes its place', async () => {
  api()
  const browserUser = userEvent.setup()
  const app = renderApp('/app/vocabulary/1')

  await browserUser.click(await screen.findByRole('link', { name: '← Back to vocabulary' }))
  await screen.findByRole('heading', { name: 'Your vocabulary' })
  await app.goBack()

  expect(screen.getByRole('heading', { name: 'Your vocabulary' })).toBeInTheDocument()
})

test('pressing a tab from a page opened from a list starts a fresh stack: back no longer returns to the list', async () => {
  api()
  const browserUser = userEvent.setup()
  const app = renderApp('/app/vocabulary')
  await browserUser.click(await screen.findByRole('link', { name: /^one/ }))
  await screen.findByRole('link', { name: '← Back to vocabulary' })

  // A phone's history knows how deep the page is; jsdom has none of its own, so it is stood in for here.
  Object.defineProperty(window.history, 'state', { value: { idx: 1 }, configurable: true })
  try {
    await browserUser.click(screen.getByRole('link', { name: 'Reading' }))
    await screen.findByRole('heading', { name: 'Reading' })
    await app.goBack()
  } finally {
    delete (window.history as { state?: unknown }).state
  }

  // The vocabulary list under the entry was walked back over and replaced: nothing is left to return to.
  expect(screen.getByRole('heading', { name: 'Reading' })).toBeInTheDocument()
})
