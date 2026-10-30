import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import {
  errorResponse,
  expectNoUnexpectedRequests,
  jsonResponse,
  renderApp,
  stubApi,
  user,
} from '../../test/utils'
import type { DailyPlan, DailyPlanItem } from './types/dailyPlan'

beforeEach(() => {
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

test('shows today’s new words in server order and links each to its vocabulary page', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/daily-plan': () =>
      jsonResponse(
        plan({
          newVocabularyGoal: 2,
          newItems: [
            item({ userVocabularyId: 11, term: 'overwhelmed', type: 'WORD' }),
            item({ userVocabularyId: 12, term: 'figure out', type: 'PHRASAL_VERB' }),
          ],
        }),
      ),
  })

  renderApp('/app/today')

  expect(await screen.findByText('2 new words · daily goal 2')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Today’s plan' })).toBeInTheDocument()
  expect(screen.getByText(/2026/)).toBeInTheDocument()
  const rows = within(screen.getByRole('list', { name: 'New words' })).getAllByRole('listitem')
  expect(rows).toHaveLength(2)
  expect(rows[0]).toHaveTextContent('1overwhelmedWord')
  expect(rows[1]).toHaveTextContent('2figure outPhrasal verb')
  expect(within(rows[1]).getByRole('link')).toHaveAttribute('href', '/app/vocabulary/12')
  expect(screen.queryByText(/saved once created/)).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Review' })).not.toBeInTheDocument()
})

test('asks for the plan of the local calendar date, not the UTC date', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 29, 23, 30))
  const fetchMock = stubApi({
    ...signedIn(),
    'GET /api/v1/learning/daily-plan': () => jsonResponse(plan({})),
  })

  renderApp('/app/today')

  await screen.findByRole('heading', { name: 'Today’s plan' })
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/learning/daily-plan?date=2026-10-29', expect.anything())
})

test('loads the next day’s plan when the page is left open past midnight', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 29, 23, 59, 30))
  const fetchMock = stubApi({
    ...signedIn(),
    'GET /api/v1/learning/daily-plan': ({ url }) =>
      jsonResponse(plan({ date: url.searchParams.get('date') ?? '', newVocabularyGoal: 1 })),
  })

  renderApp('/app/today')
  await screen.findByRole('heading', { name: 'Today’s plan' })
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/learning/daily-plan?date=2026-10-29', expect.anything())

  vi.setSystemTime(new Date(2026, 9, 30, 0, 0, 30))
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })

  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/learning/daily-plan?date=2026-10-30', expect.anything()),
  )
})

test('explains an empty plan and points to the vocabulary page', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/learning/daily-plan': () => jsonResponse(plan({})) })

  renderApp('/app/today')

  expect(await screen.findByText('There are no new words in today’s plan.')).toBeInTheDocument()
  expect(screen.getByText('0 new words · daily goal 10')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Go to your vocabulary' })).toHaveAttribute('href', '/app/vocabulary')
})

test('tells the user why a plan below the goal does not grow when they add words', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/daily-plan': () =>
      jsonResponse(plan({ newVocabularyGoal: 10, newItems: [item({ userVocabularyId: 1, term: 'solo' })] })),
  })

  renderApp('/app/today')

  expect(await screen.findByText('1 new word · daily goal 10')).toBeInTheDocument()
  expect(screen.getByText('Today’s plan is saved once created, so words you add now won’t appear in it.')).toBeInTheDocument()
})

test('shows review items in their own section when the plan has any', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/daily-plan': () =>
      jsonResponse(
        plan({
          newVocabularyGoal: 1,
          newItems: [item({ userVocabularyId: 1, term: 'fresh' })],
          reviewItems: [item({ userVocabularyId: 2, term: 'old friend' })],
        }),
      ),
  })

  renderApp('/app/today')

  expect(await screen.findByRole('heading', { name: 'Review' })).toBeInTheDocument()
  expect(within(screen.getByRole('list', { name: 'Words to review' })).getByText('old friend')).toBeInTheDocument()
})

test('shows a retryable error when the plan cannot be loaded', async () => {
  let calls = 0
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/daily-plan': () => {
      calls += 1
      return calls === 1
        ? errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred')
        : jsonResponse(plan({ newVocabularyGoal: 1, newItems: [item({ userVocabularyId: 1, term: 'back again' })] }))
    },
  })
  const browserUser = userEvent.setup()

  renderApp('/app/today')
  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
  await browserUser.click(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByText('back again')).toBeInTheDocument()
})

test('switches between the Vocabulary and Today tabs', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary': () => jsonResponse({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
    'GET /api/v1/learning/daily-plan': () => jsonResponse(plan({})),
  })
  const browserUser = userEvent.setup()

  renderApp('/app')
  expect(await screen.findByRole('heading', { name: 'Your vocabulary' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Vocabulary' })).toHaveAttribute('aria-current', 'page')

  await browserUser.click(screen.getByRole('link', { name: 'Today' }))

  expect(await screen.findByRole('heading', { name: 'Today’s plan' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: 'Vocabulary' })).not.toHaveAttribute('aria-current')
})

test('opens a planned word on its vocabulary detail page', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/daily-plan': () =>
      jsonResponse(plan({ newVocabularyGoal: 1, newItems: [item({ userVocabularyId: 5, term: 'overwhelmed' })] })),
    'GET /api/v1/vocabulary/5': () =>
      jsonResponse({
        id: 5,
        term: 'overwhelmed',
        type: 'WORD',
        phonetic: null,
        partOfSpeech: 'adjective',
        definition: 'Feeling unable to cope.',
        examples: null,
        collocations: null,
        enrichmentStatus: 'COMPLETED',
        learningStatus: 'NEW',
        createdAt: '2026-10-20T12:00:00Z',
      }),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/today')
  await browserUser.click(await screen.findByRole('link', { name: /overwhelmed/ }))

  expect(await screen.findByText('Feeling unable to cope.')).toBeInTheDocument()

  await browserUser.click(screen.getByRole('link', { name: '← Back to today’s plan' }))

  expect(await screen.findByRole('heading', { name: 'Today’s plan' })).toBeInTheDocument()
})

function signedIn() {
  return { 'GET /api/v1/auth/me': () => jsonResponse(user) }
}

function item(overrides: Partial<DailyPlanItem> & Pick<DailyPlanItem, 'userVocabularyId' | 'term'>): DailyPlanItem {
  return { vocabularyItemId: overrides.userVocabularyId + 100, type: null, ...overrides }
}

function plan(overrides: Partial<DailyPlan>): DailyPlan {
  return { date: '2026-10-29', newVocabularyGoal: 10, newItems: [], reviewItems: [], ...overrides }
}
