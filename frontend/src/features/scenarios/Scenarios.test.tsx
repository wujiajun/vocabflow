import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { expectNoAxeViolations } from '../../test/axe'
import { errorResponse, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'
import { articleTimings } from '../articles/articleLengths'

beforeEach(() => {
  clearToken()
  setToken('valid-token')
  articleTimings.endDwellMs = 0
})

afterEach(() => {
  cleanup()
  articleTimings.endDwellMs = 8000
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

const summaries = [
  { id: 'renting', title: 'Renting an Apartment', titleZh: '看房租房', clb: 6, readingMinutes: 3, summary: 'Sam views a flat.', summaryZh: '山姆看房。', keywordCount: 2, quizSize: 2 },
  { id: 'bank', title: 'Opening a Bank Account', titleZh: '银行开户', clb: 6, readingMinutes: 3, summary: 'Amira opens an account.', summaryZh: '阿米拉开户。', keywordCount: 2, quizSize: 2 },
]

function detail(completed: boolean, bestScore: number | null) {
  return {
    ...summaries[0],
    canadaNoteZh: '签约前要读完租约。',
    text: 'Sam is looking for a flat.\n\nMs. Patel: The lease is for one year.',
    keywords: [
      { word: 'lease', zh: '租约', definition: 'a written agreement to rent a home', example: 'I signed a lease.' },
      { word: 'flat', zh: '公寓', definition: 'a set of rooms to live in', example: 'A small flat.' },
    ],
    quiz: [
      { question: 'How long is the lease?', options: ['One year', 'One month'], answer: 0, explainZh: '租约是一年。' },
      { question: 'Who is looking for a flat?', options: ['Ms. Patel', 'Sam'], answer: 1, explainZh: '是山姆。' },
    ],
    completed,
    completedAt: completed ? '2026-11-01T10:00:00Z' : null,
    bestScore,
  }
}

function server(state = { completed: false, score: null as number | null }, added: unknown[] = [], completions: unknown[] = []) {
  return {
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/scenarios': () => jsonResponse(summaries.map((s, i) => ({ ...s, completed: i === 0 && state.completed, bestScore: i === 0 ? state.score : null }))),
    'GET /api/v1/scenarios/renting': () => jsonResponse(detail(state.completed, state.score)),
    'GET /api/v1/scenarios/nope': () => errorResponse(404, 'NOT_FOUND', 'Scenario was not found'),
    'PUT /api/v1/scenarios/renting/complete': ({ init }: { init: RequestInit }) => {
      const body = init.body ? (JSON.parse(String(init.body)) as { score?: number }) : {}
      completions.push(body)
      state.completed = true
      if (body.score !== undefined) {
        state.score = Math.max(state.score ?? 0, body.score)
      }
      return new Response(null, { status: 204 })
    },
    'POST /api/v1/vocabulary': ({ init }: { init: RequestInit }) => {
      const body = JSON.parse(String(init.body)) as { term: string }
      added.push(body.term)
      if (body.term === 'flat') {
        return errorResponse(409, 'VOCABULARY_ALREADY_EXISTS', 'Already added')
      }
      return jsonResponse({ id: 5, term: body.term, enrichmentStatus: 'PENDING', learningStatus: 'NEW', senses: [], createdAt: '2026-11-01T00:00:00Z' }, 201)
    },
    'GET /api/v1/vocabulary': () => jsonResponse({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
  }
}

test('the Canada section lists the scenarios with their level and progress', async () => {
  stubApi(server({ completed: true, score: 2 }))
  renderApp('/app/reading/scenarios')

  await screen.findByRole('heading', { name: 'Renting an Apartment' })
  const nav = screen.getByRole('navigation', { name: 'Reading sections' })
  expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Passages', 'Videos', 'Articles', 'Canada'])
  expect(within(nav).getByRole('link', { name: 'Canada' })).toHaveAttribute('aria-current', 'true')
  expect(screen.getByText('1 of 2 finished')).toBeInTheDocument()
  expect(screen.getByText('✓ Finished · 2/2')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Renting an Apartment/ })).toHaveAttribute('href', '/app/reading/scenarios/renting')
  await expectNoAxeViolations()
})

test('a scenario shows its text, note and keywords, and "Add all" skips a word already in the list', async () => {
  const added: unknown[] = []
  stubApi(server(undefined, added))
  const browserUser = userEvent.setup()
  renderApp('/app/reading/scenarios/renting')

  await screen.findByRole('heading', { name: 'Renting an Apartment' })
  expect(screen.getByText('看房租房')).toBeInTheDocument()
  expect(screen.getByText('签约前要读完租约。')).toBeInTheDocument()
  const words = screen.getByRole('region', { name: 'Keywords' })
  expect(within(words).getByText(/租约/)).toBeInTheDocument()

  await browserUser.click(within(words).getByRole('button', { name: 'Add all 2 words' }))
  await within(words).findByText('Added ✓')
  await within(words).findByText('In your list')
  expect([...added].sort()).toEqual(['flat', 'lease'])
  await expectNoAxeViolations()
})

test('reaching the end marks the scenario finished', async () => {
  const completions: unknown[] = []
  stubApi(server(undefined, [], completions))
  const original = globalThis.IntersectionObserver
  class Visible {
    callback: (entries: { isIntersecting: boolean }[]) => void
    constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
      this.callback = callback
    }
    observe() {
      this.callback([{ isIntersecting: true }])
    }
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal('IntersectionObserver', Visible)
  renderApp('/app/reading/scenarios/renting')

  await screen.findByRole('heading', { name: 'Renting an Apartment' })
  await waitFor(() => expect(completions).toEqual([{}]))
  await screen.findByText('Read ✓')
  vi.stubGlobal('IntersectionObserver', original)
})

test('checking the quiz shows the answers and sends the score', async () => {
  const completions: unknown[] = []
  stubApi(server(undefined, [], completions))
  const browserUser = userEvent.setup()
  renderApp('/app/reading/scenarios/renting')

  await screen.findByRole('heading', { name: 'Renting an Apartment' })
  const quiz = screen.getByRole('region', { name: 'Quick quiz' })
  const check = within(quiz).getByRole('button', { name: 'Check answers' })
  expect(check).toHaveAttribute('aria-disabled', 'true')
  await browserUser.click(check)
  expect(completions).toEqual([])

  await browserUser.click(within(quiz).getByRole('radio', { name: 'One year' }))
  await browserUser.click(within(quiz).getByRole('radio', { name: 'Ms. Patel' }))
  await browserUser.click(within(quiz).getByRole('button', { name: 'Check answers' }))

  expect(await within(quiz).findByText('1 of 2 right')).toBeInTheDocument()
  expect(within(quiz).getByText('是山姆。')).toBeInTheDocument()
  await waitFor(() => expect(completions).toContainEqual({ score: 1 }))

  await browserUser.click(within(quiz).getByRole('button', { name: 'Try again' }))
  expect(within(quiz).queryByText('1 of 2 right')).not.toBeInTheDocument()
})

test('an unknown scenario says so', async () => {
  stubApi(server())
  renderApp('/app/reading/scenarios/nope')

  expect(await screen.findByRole('heading', { name: 'We couldn’t find that scenario' })).toBeInTheDocument()
})
