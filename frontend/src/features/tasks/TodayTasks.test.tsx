import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { emptyStudyQueue, errorResponse, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'
import type { DailyTask, LedgerPage, TaskDay } from './types/tasks'

beforeEach(() => {
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

function task(overrides: Partial<DailyTask>): DailyTask {
  return { key: 'T', type: 'ADD_WORDS', category: 'ADD_WORDS', game: null, target: 1, current: 0, points: 3, completed: false, completedAt: null, ...overrides }
}

function day(overrides: Partial<TaskDay> = {}): TaskDay {
  return {
    date: '2026-11-01',
    tasks: [
      task({ key: 'STUDY_PLAN', type: 'STUDY_PLAN', category: 'STUDY', points: 10 }),
      task({ key: 'ADD_WORDS', type: 'ADD_WORDS', target: 5, current: 2 }),
      task({ key: 'WATCH_VIDEO', type: 'WATCH_VIDEO', category: 'VIDEO' }),
      task({ key: 'PLAY_GAME:spell-it', type: 'PLAY_GAME', category: 'GAMES', game: 'spell-it', points: 3 }),
      task({ key: 'READ_ARTICLE', type: 'READ_ARTICLE', category: 'READING', points: 4 }),
    ],
    allDone: false,
    earnedToday: 0,
    balance: 25,
    streak: 4,
    bestStreak: 6,
    ...overrides,
  }
}

function signedIn() {
  return {
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/learning/study-queue': () => jsonResponse(emptyStudyQueue),
  }
}

test('the study page opens with the base task first, the others after it and the streak and points above', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/tasks/today': () => jsonResponse(day()) })
  renderApp('/app/study')

  const card = await screen.findByRole('region', { name: /Today’s tasks/ })
  expect(within(card).getByRole('heading', { name: /Today’s tasks 0\/5/ })).toBeInTheDocument()
  const links = within(card).getAllByRole('link').filter((link) => link.textContent?.startsWith('Finish') || /\+\d+$/.test(link.textContent ?? ''))
  expect(links[0]).toHaveTextContent('Finish today’s study plan')
  expect(within(card).getByText('4')).toBeInTheDocument()
  expect(card).toHaveTextContent('days in a row')
  expect(card).toHaveTextContent('Total 25 points')
  expect(within(card).getByRole('progressbar', { name: 'Add 5 words to your list progress' })).toHaveAttribute('aria-valuenow', '2')
  expect(within(card).getByText('2/5')).toBeInTheDocument()
})

test('each task opens the place where it is done', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/tasks/today': () => jsonResponse(day()) })
  renderApp('/app/study')
  const card = await screen.findByRole('region', { name: /Today’s tasks/ })
  const href = (name: RegExp) => within(card).getByRole('link', { name }).getAttribute('href')

  expect(href(/Finish today’s study plan/)).toBe('/app/study')
  expect(href(/Add 5 words/)).toBe('/app/vocabulary')
  expect(href(/Watch a video/)).toBe('/app/reading/videos')
  expect(href(/Play Spell it/)).toBe('/app/study/spell')
  expect(href(/Read an article/)).toBe('/app/reading/articles')
})

test('a finished task shows a check and no bar, and the whole day shows a message', async () => {
  const done = day({
    allDone: true,
    earnedToday: 25,
    tasks: day().tasks.map((t) => ({ ...t, completed: true, current: t.target })),
  })
  stubApi({ ...signedIn(), 'GET /api/v1/tasks/today': () => jsonResponse(done) })
  renderApp('/app/study')

  const card = await screen.findByRole('region', { name: /Today’s tasks/ })
  expect(within(card).getByRole('heading', { name: /5\/5/ })).toBeInTheDocument()
  expect(within(card).queryByRole('progressbar')).not.toBeInTheDocument()
  expect(within(card).getAllByText('(done)')).toHaveLength(5)
  // Not celebrated on opening: these were done earlier.
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('a task that turns done while the page is open is celebrated, and the card asks again after a save', async () => {
  let calls = 0
  stubApi({
    ...signedIn(),
    'GET /api/v1/tasks/today': () => {
      calls += 1
      if (calls === 1) {
        return jsonResponse(day())
      }
      const tasks = day().tasks.map((t) => (t.key === 'WATCH_VIDEO' ? { ...t, completed: true, current: 1 } : t))
      return jsonResponse(day({ tasks, earnedToday: 3, balance: 28 }))
    },
  })
  const { queryClient } = renderApp('/app/study')
  await screen.findByRole('region', { name: /Today’s tasks/ })

  // Something saved elsewhere on the page (a rating, say) makes the card ask again.
  await queryClient.getMutationCache().build(queryClient, { mutationFn: async () => 'ok' }).execute(undefined)

  expect(await screen.findByText(/Watch a video to the end — done! \+3/)).toBeInTheDocument()
  expect(screen.getByRole('region', { name: /Today’s tasks/ })).toHaveTextContent('Total 28 points')
  expect(calls).toBe(2)
})

test('a day without tasks shows no card and a failed read offers another try', async () => {
  let fail = true
  stubApi({
    ...signedIn(),
    'GET /api/v1/tasks/today': () => (fail ? errorResponse(500, 'INTERNAL_ERROR', 'Boom') : jsonResponse(day({ tasks: [] }))),
  })
  const browserUser = userEvent.setup()
  renderApp('/app/study')

  await browserUser.click(await screen.findByRole('button', { name: 'Try again' }))
  fail = false
  await browserUser.click(await screen.findByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(screen.queryByRole('region', { name: /Today’s tasks/ })).not.toBeInTheDocument())
})

test('the points page lists the ledger, newest first, with pages', async () => {
  const page = (n: number): LedgerPage => ({
    entries: [
      { date: '2026-11-01', key: `K${n}`, amount: 10, reason: `Finished today’s study plan ${n}`, createdAt: '2026-11-01T10:00:00Z' },
      { date: '2026-11-01', key: `L${n}`, amount: 5, reason: `All of today’s tasks done ${n}`, createdAt: '2026-11-01T11:00:00Z' },
    ],
    page: n,
    size: 20,
    totalElements: 25,
    totalPages: 2,
  })
  stubApi({
    ...signedIn(),
    'GET /api/v1/tasks/ledger': ({ url }) => jsonResponse(page(Number(url.searchParams.get('page')))),
  })
  const browserUser = userEvent.setup()
  renderApp('/app/points')

  expect(await screen.findByText('Finished today’s study plan 0')).toBeInTheDocument()
  expect(screen.getByText('+10')).toBeInTheDocument()
  await browserUser.click(screen.getByRole('button', { name: 'Next' }))
  expect(await screen.findByText('Finished today’s study plan 1')).toBeInTheDocument()
})
