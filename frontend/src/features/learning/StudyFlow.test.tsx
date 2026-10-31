import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { toLocalDateString } from '../../shared/date'
import { errorResponse, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'
import { formatInterval } from './components/formatInterval'
import type { StudyCard, StudyQueue } from './types/study'

beforeEach(() => {
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

test('hides the answer until asked, then shows it with what each rating would do', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ nextCard: card() })) })
  const browserUser = userEvent.setup()

  renderApp('/app/study')

  expect(await screen.findByRole('heading', { name: 'overwhelmed' })).toBeInTheDocument()
  expect(document.title).toBe('Study · VocabFlow')
  expect(screen.getByText('0 learning · 0 to review · 1 new')).toBeInTheDocument()
  expect(screen.queryByText('Feeling unable to cope.')).not.toBeInTheDocument()
  expect(screen.queryByText(/\/ˌoʊ/)).not.toBeInTheDocument()
  expect(screen.queryByRole('group', { name: /remember/ })).not.toBeInTheDocument()

  await browserUser.click(screen.getByRole('button', { name: 'Show answer' }))

  expect(screen.getByText('Feeling unable to cope.')).toBeInTheDocument()
  expect(screen.getByText(/\/ˌoʊvərˈwelmd\//)).toBeInTheDocument()
  expect(screen.getByText('I felt overwhelmed.')).toBeInTheDocument()
  expect(screen.getByText('feel overwhelmed')).toBeInTheDocument()
  expect(screen.getByText('Feeling unable to cope.').parentElement).toHaveFocus()
  const ratings = within(screen.getByRole('group', { name: /remember/ })).getAllByRole('button')
  expect(ratings.map((button) => button.textContent)).toEqual(['Again1 min', 'Hard1 min', 'Good10 min', 'Easy4 days'])
})

test('sends the rating with the card’s version and today’s date, then moves on to the next card', async () => {
  const fetchMock = stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ nextCard: card() })),
    'POST /api/v1/learning/cards/7/reviews': () =>
      jsonResponse(queue({ nextCard: card({ userVocabularyId: 8, term: 'figure out' }) })),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Show answer' }))
  await browserUser.click(screen.getByRole('button', { name: /^Good/ }))

  const nextTerm = await screen.findByRole('heading', { name: 'figure out' })
  expect(nextTerm).toHaveFocus()
  expect(screen.getByRole('button', { name: 'Show answer' })).toBeInTheDocument()
  const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
  expect(JSON.parse(post?.[1]?.body as string)).toEqual({ rating: 'GOOD', version: 3, date: toLocalDateString(new Date()) })
})

test('hides the answer again when the same card comes back', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ nextCard: card() })),
    'POST /api/v1/learning/cards/7/reviews': () => jsonResponse(queue({ nextCard: card({ version: 4 }) })),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Show answer' }))
  await browserUser.click(screen.getByRole('button', { name: /^Again/ }))

  expect(await screen.findByRole('button', { name: 'Show answer' })).toBeInTheDocument()
  expect(screen.queryByText('Feeling unable to cope.')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'overwhelmed' })).toHaveFocus()
})

test('says when studying is finished and moves focus there', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ nextCard: card() })),
    'POST /api/v1/learning/cards/7/reviews': () => jsonResponse(queue({ newCount: 0 })),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Show answer' }))
  await browserUser.click(screen.getByRole('button', { name: /^Easy/ }))

  expect(await screen.findByRole('heading', { name: 'You’re done for now' })).toHaveFocus()
  expect(screen.getByRole('link', { name: 'Go to your vocabulary' })).toBeInTheDocument()
})

test('with nothing to study from the start, does not take focus', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ newCount: 0 })) })

  renderApp('/app/study')

  expect(await screen.findByRole('heading', { name: 'Nothing to study right now' })).not.toHaveFocus()
})

test('says when a later learning step comes back, and counts words still waiting for details', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () =>
      jsonResponse(queue({ newCount: 0, unavailableCount: 2, nextDueAt: '2026-11-01T18:30:00Z' })),
  })

  renderApp('/app/study')

  expect(await screen.findByText(/The next card comes back at/)).toBeInTheDocument()
  expect(screen.getByText('2 words are waiting for their details.')).toBeInTheDocument()
})

test('keeps the card and explains when a rating cannot be saved', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ nextCard: card() })),
    'POST /api/v1/learning/cards/7/reviews': () => errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred'),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Show answer' }))
  await browserUser.click(screen.getByRole('button', { name: /^Hard/ }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
  expect(screen.getByRole('button', { name: /^Hard/ })).toBeInTheDocument()
})

test('moves on without an error when another tab already reviewed the card', async () => {
  let refused = false
  let finishRefetch: () => void = () => undefined
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': async () => {
      if (!refused) {
        return jsonResponse(queue({ nextCard: card() }))
      }
      await new Promise<void>((resolve) => {
        finishRefetch = resolve
      })
      return jsonResponse(queue({ nextCard: card({ userVocabularyId: 8, term: 'figure out' }) }))
    },
    'POST /api/v1/learning/cards/7/reviews': () => {
      refused = true
      return errorResponse(409, 'CONFLICT', 'This card has already been reviewed')
    },
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Show answer' }))
  await browserUser.click(screen.getByRole('button', { name: /^Good/ }))

  // While the current card is being read again, no error flashes up.
  await waitFor(() => expect(refused).toBe(true))
  await new Promise((resolve) => setTimeout(resolve, 30))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  finishRefetch()

  expect(await screen.findByRole('heading', { name: 'figure out' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('ignores a second rating while the first is being saved', async () => {
  let posts = 0
  let release: () => void = () => undefined
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ nextCard: card() })),
    'POST /api/v1/learning/cards/7/reviews': async () => {
      posts += 1
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return jsonResponse(queue({ newCount: 0 }))
    },
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Show answer' }))
  await browserUser.click(screen.getByRole('button', { name: /^Good/ }))
  await waitFor(() => expect(posts).toBe(1))
  await browserUser.click(screen.getByRole('button', { name: /^Easy/ }))
  release()

  await screen.findByRole('heading', { name: 'You’re done for now' })
  expect(posts).toBe(1)
})

test('offers a retry when the queue cannot be loaded', async () => {
  let attempts = 0
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => {
      attempts += 1
      return attempts === 1
        ? errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred')
        : jsonResponse(queue({ nextCard: card() }))
    },
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Try again' }))

  expect(await screen.findByRole('heading', { name: 'overwhelmed' })).toBeInTheDocument()
})

test('the plan page leads to studying', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/daily-plan': () =>
      jsonResponse({ date: '2026-11-01', newVocabularyGoal: 10, newItems: [], reviewItems: [] }),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ nextCard: card() })),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/today')
  expect(await screen.findByText(/Words you add now will start today’s plan/)).toBeInTheDocument()
  await browserUser.click(screen.getByRole('link', { name: 'Start studying' }))

  expect(await screen.findByRole('heading', { name: 'overwhelmed' })).toBeInTheDocument()
})

test.each([
  [{ intervalMinutes: 1, intervalDays: null }, '1 min'],
  [{ intervalMinutes: null, intervalDays: 1 }, '1 day'],
  [{ intervalMinutes: null, intervalDays: 29 }, '29 days'],
  [{ intervalMinutes: null, intervalDays: 60 }, '2 mo'],
  [{ intervalMinutes: null, intervalDays: 730 }, '2.0 yr'],
])('formats %j as %s', (option, text) => {
  expect(formatInterval({ rating: 'GOOD', ...option })).toBe(text)
})

function signedIn() {
  return { 'GET /api/v1/auth/me': () => jsonResponse(user) }
}

function queue(overrides: Partial<StudyQueue> = {}): StudyQueue {
  return {
    date: '2026-11-01',
    learningCount: 0,
    reviewCount: 0,
    newCount: 1,
    unavailableCount: 0,
    nextCard: null,
    nextDueAt: null,
    ...overrides,
  }
}

function card(overrides: Partial<StudyCard> = {}): StudyCard {
  return {
    userVocabularyId: 7,
    term: 'overwhelmed',
    type: 'WORD',
    phonetic: '/ˌoʊvərˈwelmd/',
    partOfSpeech: 'adjective',
    definition: 'Feeling unable to cope.',
    examples: ['I felt overwhelmed.'],
    collocations: ['feel overwhelmed'],
    state: 'NEW',
    version: 3,
    options: [
      { rating: 'AGAIN', intervalMinutes: 1, intervalDays: null },
      { rating: 'HARD', intervalMinutes: 1, intervalDays: null },
      { rating: 'GOOD', intervalMinutes: 10, intervalDays: null },
      { rating: 'EASY', intervalMinutes: null, intervalDays: 4 },
    ],
    ...overrides,
  }
}
