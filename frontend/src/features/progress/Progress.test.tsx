import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { emptyStudyQueue, errorResponse, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'
import { level } from './heatLevel'
import type { ProgressDay, ProgressSummary } from './types/progress'

beforeEach(() => {
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

// 84 days ending on Sunday 2026-11-08 (so the calendar has full weeks).
function days(overrides: Record<string, Partial<ProgressDay>> = {}): ProgressDay[] {
  const end = new Date(2026, 10, 8)
  return Array.from({ length: 84 }, (_, i) => {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (83 - i))
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { date, cards: 0, reviews: 0, newWords: 0, rounds: 0, points: 0, ...overrides[date] }
  })
}

function summary(overrides: Partial<ProgressSummary> = {}): ProgressSummary {
  return {
    date: '2026-11-08',
    started: 40,
    mastered: 12,
    learning: 28,
    streak: 5,
    bestStreak: 9,
    milestone: { previous: 0, next: 50 },
    days: days({
      '2026-11-08': { cards: 12, reviews: 7, newWords: 5, rounds: 2, points: 15 },
      '2026-11-05': { cards: 45, reviews: 40, newWords: 5, rounds: 0, points: 10 },
    }),
    thisWeek: { reviews: 30, newWords: 10, rounds: 1 },
    lastWeek: { reviews: 40, newWords: 10, rounds: 0 },
    ...overrides,
  }
}

function signedIn() {
  return {
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/learning/study-queue': () => jsonResponse(emptyStudyQueue),
  }
}

test('the study page links to the progress page', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/progress/summary': () => jsonResponse(summary()) })
  renderApp('/app/study')

  await userEvent.click(await screen.findByRole('link', { name: /My progress/ }))

  expect(await screen.findByRole('heading', { name: 'My progress' })).toBeInTheDocument()
})

test('shows the three big numbers, the learning count and the streak', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/progress/summary': () => jsonResponse(summary()) })
  renderApp('/app/progress')

  const numbers = await screen.findByRole('region', { name: 'Your numbers' })
  expect(within(numbers).getByText('Words learned').previousSibling).toHaveTextContent('40')
  expect(within(numbers).getByText('Mastered').previousSibling).toHaveTextContent('12')
  expect(within(numbers).getByText('Days in a row').previousSibling).toHaveTextContent('5')
  expect(numbers).toHaveTextContent('Best 9')
  expect(numbers).toHaveTextContent('28 words still being learned')
})

test('the milestone bar says how many words are left to the next goal', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/progress/summary': () => jsonResponse(summary({ mastered: 80, started: 90, learning: 10, milestone: { previous: 50, next: 100 } })) })
  renderApp('/app/progress')

  const goal = await screen.findByRole('region', { name: 'Next goal' })
  expect(goal).toHaveTextContent('20 more words to 100')
  const bar = within(goal).getByRole('progressbar')
  expect(bar).toHaveAttribute('aria-valuenow', '80')
  expect(bar.firstElementChild).toHaveStyle({ width: '60%' })
})

test('past the last goal the bar gives way to a message', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/progress/summary': () => jsonResponse(summary({ mastered: 1200, milestone: { previous: 1000, next: null } })) })
  renderApp('/app/progress')

  const goal = await screen.findByRole('region', { name: 'Next goal' })
  expect(goal).toHaveTextContent('past every goal')
  expect(within(goal).queryByRole('progressbar')).not.toBeInTheDocument()
})

test('the calendar shows 84 days, starts on the last day and shows another day when tapped', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/progress/summary': () => jsonResponse(summary()) })
  renderApp('/app/progress')

  const calendar = await screen.findByRole('region', { name: 'Study calendar' })
  expect(within(calendar).getAllByRole('button')).toHaveLength(84)
  const detail = within(calendar).getByTestId('day-detail')
  expect(detail).toHaveTextContent('Sunday, November 8')
  expect(detail).toHaveTextContent('Reviewed 7 cards')
  expect(detail).toHaveTextContent('Learned 5 new words')
  expect(detail).toHaveTextContent('Played 2 games')
  expect(detail).toHaveTextContent('Earned 15 points')

  const square = within(calendar).getByRole('button', { name: 'November 5: 45 cards' })
  expect(square).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(square)

  expect(square).toHaveAttribute('aria-pressed', 'true')
  expect(detail).toHaveTextContent('Thursday, November 5')
  expect(detail).toHaveTextContent('Reviewed 40 cards')
  expect(detail).toHaveTextContent('Earned 10 points')

  await userEvent.click(within(calendar).getByRole('button', { name: 'November 4: 0 cards' }))
  expect(detail).toHaveTextContent('No study this day.')
})

test('the squares get darker with more cards', () => {
  expect([0, 1, 9, 10, 19, 20, 39, 40, 200].map(level)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4])
})

test('the week comparison shows up and down arrows and no change', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/progress/summary': () => jsonResponse(summary()) })
  renderApp('/app/progress')

  const week = await screen.findByRole('region', { name: 'This week and last week' })
  const rows = within(week).getAllByRole('row')
  expect(within(rows[1]).getByText('▼ 10')).toBeInTheDocument() // reviews 30 vs 40
  expect(within(rows[2]).getByText('– same')).toBeInTheDocument() // new words 10 vs 10
  expect(within(rows[3]).getByText('▲ 1')).toBeInTheDocument() // rounds 1 vs 0
})

test('a learner with no data sees zeros, the first goal and a gentle hint', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/progress/summary': () =>
      jsonResponse(
        summary({
          started: 0, mastered: 0, learning: 0, streak: 0, bestStreak: 0,
          days: days(),
          thisWeek: { reviews: 0, newWords: 0, rounds: 0 },
          lastWeek: { reviews: 0, newWords: 0, rounds: 0 },
        }),
      ),
  })
  renderApp('/app/progress')

  const numbers = await screen.findByRole('region', { name: 'Your numbers' })
  expect(within(numbers).getByText('Words learned').previousSibling).toHaveTextContent('0')
  expect(screen.getByRole('region', { name: 'Next goal' })).toHaveTextContent('50 more words to 50')
  expect(screen.getByRole('region', { name: 'Study calendar' })).toHaveTextContent('Nothing yet')
  expect(screen.getByTestId('day-detail')).toHaveTextContent('No study this day.')
  expect(screen.getAllByText('– same')).toHaveLength(3)
})

test('asks for the learner’s own date and reports a failure with a retry', async () => {
  let calls = 0
  let seen = ''
  stubApi({
    ...signedIn(),
    'GET /api/v1/progress/summary': ({ url }) => {
      calls += 1
      seen = url.search
      return calls === 1 ? errorResponse(500, 'INTERNAL_ERROR', 'boom') : jsonResponse(summary())
    },
  })
  renderApp('/app/progress')

  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(seen).toMatch(/^\?date=\d{4}-\d{2}-\d{2}/)
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(screen.getByRole('region', { name: 'Your numbers' })).toBeInTheDocument())
})

test('a finished save anywhere (a rating, a game round) refreshes the numbers', async () => {
  let calls = 0
  stubApi({
    ...signedIn(),
    'GET /api/v1/progress/summary': () => {
      calls += 1
      return jsonResponse(summary({ started: 40 + calls }))
    },
  })
  const { queryClient } = renderApp('/app/progress')
  const numbers = await screen.findByRole('region', { name: 'Your numbers' })
  expect(within(numbers).getByText('Words learned').previousSibling).toHaveTextContent('41')

  await queryClient.getMutationCache().build(queryClient, { mutationFn: async () => 'saved' }).execute(undefined)

  await waitFor(() => expect(within(screen.getByRole('region', { name: 'Your numbers' })).getByText('Words learned').previousSibling).toHaveTextContent('42'))
})
