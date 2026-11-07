import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render } from '@testing-library/react'
import { expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { App } from '../app/App'
import { AuthTokenProvider } from '../features/auth/hooks/AuthTokenProvider'
import { BackProbe } from './BackProbe'

export const user = {
  id: 1,
  email: 'learner@example.com',
  clbLevel: 'CLB_4',
  dailyNewVocabularyGoal: 10,
  timeZone: null,
} as const

export const emptyStudyQueue = {
  date: '2026-11-01',
  learningCount: 0,
  reviewCount: 0,
  newCount: 0,
  unavailableCount: 0,
  nextCard: null,
  nextDueAt: null,
  studiedCount: 0,
  stillLearningCount: 0,
  notStartedCount: 0,
  newTargetCount: 10,
  goalShortfall: 0,
  finished: false,
  moreNewWords: false,
  studiedToday: [],
  recentlyStudied: [],
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function errorResponse(status: number, code: string, message: string) {
  return jsonResponse({ code, message, timestamp: '2026-10-20T00:00:00Z' }, status)
}

type RouteHandler = (call: { url: URL; init: RequestInit }) => Response | Promise<Response>

let unexpectedRequests: string[] = []

// Routes are keyed "METHOD /path"; a request with no route is recorded so tests fail loudly
// instead of the UI quietly rendering a network error.
export const emptyTaskDay = {
  date: '2026-11-01',
  tasks: [],
  allDone: false,
  earnedToday: 0,
  balance: 0,
  streak: 0,
  bestStreak: 0,
}

export function stubApi(given: Record<string, RouteHandler>) {
  // Most tests are not about the daily tasks: unless one says otherwise, the day has none.
  const routes: Record<string, RouteHandler> = { 'GET /api/v1/tasks/today': () => jsonResponse(emptyTaskDay), ...given }
  unexpectedRequests = []
  const fetchMock = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input, 'http://localhost')
    const key = `${init.method ?? 'GET'} ${url.pathname}`
    const route = routes[key]
    if (!route) {
      unexpectedRequests.push(`${key}${url.search}`)
      throw new Error(`Unexpected request: ${key}${url.search}`)
    }
    return route({ url, init })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function expectNoUnexpectedRequests() {
  expect(unexpectedRequests).toEqual([])
}

export function renderApp(initialPath: string, prepare?: (queryClient: QueryClient) => void) {
  let back = () => {}
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  prepare?.(queryClient)

  return {
    queryClient,
    goBack: () => act(() => back()),
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthTokenProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <App />
            <BackProbe onReady={(navigateBack) => (back = navigateBack)} />
          </MemoryRouter>
        </AuthTokenProvider>
      </QueryClientProvider>,
    ),
  }
}

// The words of a definition or an example are separate elements, so that each can be tapped. This
// matches the one element that holds the whole text.
export function wholeText(text: string) {
  return (_content: string, element: Element | null) =>
    element !== null && element.textContent === text && !Array.from(element.children).some((child) => child.textContent === text)
}
