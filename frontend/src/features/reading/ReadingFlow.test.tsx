import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { expectNoAxeViolations } from '../../test/axe'
import { errorResponse, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'
import type { StudyQueue } from '../learning/types/study'
import type { ReadingPage, ReadingPassage, ReadingSummary } from './types/reading'

beforeEach(() => {
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

test('a finished day offers a passage, which is written on request and opened', async () => {
  const requests: unknown[] = []
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ finished: true })),
    'GET /api/v1/reading/today': () => jsonResponse({ passageId: null }),
    'POST /api/v1/reading/passages': ({ init }) => {
      requests.push(JSON.parse(String(init.body)))
      return jsonResponse(passage())
    },
    'GET /api/v1/reading/passages/11': () => jsonResponse(passage()),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  const write = await screen.findByRole('button', { name: 'Write a reading passage' })
  await expectNoAxeViolations()
  await browserUser.click(write)

  expect(await screen.findByRole('heading', { name: 'Signing the lease' })).toBeInTheDocument()
  expect(requests).toEqual([{ date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }])
})

test('while it is being written the button says so and a second press does nothing', async () => {
  let writes = 0
  let finish: (response: Response) => void = () => {}
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ finished: true })),
    'GET /api/v1/reading/today': () => jsonResponse({ passageId: null }),
    'POST /api/v1/reading/passages': () => {
      writes += 1
      return new Promise<Response>((resolve) => {
        finish = resolve
      })
    },
    'GET /api/v1/reading/passages/11': () => jsonResponse(passage()),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Write a reading passage' }))
  const writing = await screen.findByRole('button', { name: 'Writing your passage…' })
  await browserUser.click(writing)

  expect(writing).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByText(/This takes about 15 seconds/)).toBeInTheDocument()
  expect(writes).toBe(1)
  finish(jsonResponse(passage()))
  expect(await screen.findByRole('heading', { name: 'Signing the lease' })).toBeInTheDocument()
})

test('a day that already has a passage offers to open it, not to write another', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ finished: true })),
    'GET /api/v1/reading/today': () => jsonResponse({ passageId: 11 }),
  })

  renderApp('/app/study')

  const link = await screen.findByRole('link', { name: 'Open today’s passage' })
  expect(link).toHaveAttribute('href', '/app/reading/11')
  expect(screen.queryByRole('button', { name: 'Write a reading passage' })).not.toBeInTheDocument()
})

test('too few words is explained and leaves the button ready for another try', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ finished: true })),
    'GET /api/v1/reading/today': () => jsonResponse({ passageId: null }),
    'POST /api/v1/reading/passages': () =>
      errorResponse(409, 'CONFLICT', 'You studied 3 words or phrases today. A passage needs at least 10.'),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Write a reading passage' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('You studied 3 words or phrases today. A passage needs at least 10.')
  expect(screen.getByRole('button', { name: 'Write a reading passage' })).not.toHaveAttribute('aria-disabled', 'true')
})

test('nothing about reading is offered before the day’s study is complete', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ finished: false, nextDueAt: '2026-11-01T23:00:00Z' })),
  })

  renderApp('/app/study')

  await screen.findByRole('heading', { name: 'Nothing is due right now' })
  expect(screen.queryByRole('button', { name: 'Write a reading passage' })).not.toBeInTheDocument()
})

test('a passage highlights the studied words, lets any other word be added and can be marked read and unread', async () => {
  let read = false
  stubApi({
    ...signedIn(),
    'GET /api/v1/reading/passages/11': () =>
      jsonResponse(passage({ read, readAt: read ? '2026-11-02T15:00:00Z' : null })),
    'PUT /api/v1/reading/passages/11/read': ({ init }) => {
      read = JSON.parse(String(init.body)).read
      return jsonResponse(passage({ read, readAt: read ? '2026-11-02T15:00:00Z' : null }))
    },
    'GET /api/v1/reading/passages': () => jsonResponse(page([])),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/reading/11')
  await screen.findByRole('heading', { name: 'Signing the lease' })

  expect(screen.getAllByText('lease').find((element) => element.tagName === 'MARK')).toBeDefined()
  expect(screen.getByText('landlord', { selector: 'mark' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Words in this passage' })).toHaveTextContent('lease')
  expect(screen.getByText('Unread')).toBeInTheDocument()
  await expectNoAxeViolations()

  await browserUser.click(screen.getByText('twice'))
  expect(screen.getByRole('textbox', { name: 'Add a word or phrase' })).toHaveValue('twice')
  await expectNoAxeViolations()
  await browserUser.click(screen.getByRole('button', { name: 'Close' }))

  await browserUser.click(screen.getByRole('button', { name: 'Mark as read' }))
  expect(await screen.findByRole('button', { name: 'Mark as unread' })).toBeInTheDocument()
  expect(screen.getByText('Read ✓')).toBeInTheDocument()
  expect(screen.getByText(/^Read on /)).toBeInTheDocument()

  await browserUser.click(screen.getByRole('button', { name: 'Mark as unread' }))
  expect(await screen.findByRole('button', { name: 'Mark as read' })).toBeInTheDocument()
  expect(screen.getByText('Unread')).toBeInTheDocument()
})

test('a passage that is not found, or not yours, says so', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/reading/passages/404': () => errorResponse(404, 'NOT_FOUND', 'Passage was not found'),
  })

  renderApp('/app/reading/404')

  expect(await screen.findByRole('heading', { name: 'We couldn’t find that passage' })).toBeInTheDocument()
})

test('the list shows newest first with a plain mark for unread and read, and links each passage', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/reading/passages': () =>
      jsonResponse(page([summary({ id: 12, title: 'A new job' }), summary({ id: 11, title: 'Signing the lease', read: true })])),
  })

  renderApp('/app/reading')

  const rows = await screen.findAllByRole('listitem')
  expect(rows).toHaveLength(2)
  expect(within(rows[0]).getByText('Unread')).toBeInTheDocument()
  expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', '/app/reading/12')
  expect(rows[0]).toHaveTextContent('A new job')
  expect(rows[0]).toHaveTextContent('Written')
  expect(rows[0]).toHaveTextContent('12 words studied')
  expect(within(rows[1]).getByText('Read ✓')).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Main' })).toHaveTextContent('Reading')
  await expectNoAxeViolations()
})

test('the filter asks the server for only read or only unread passages', async () => {
  const asked: string[] = []
  stubApi({
    ...signedIn(),
    'GET /api/v1/reading/passages': ({ url }) => {
      asked.push(url.searchParams.get('read') ?? 'any')
      return jsonResponse(page(url.searchParams.get('read') === 'false' ? [summary({ id: 12, title: 'A new job' })] : []))
    },
  })
  const browserUser = userEvent.setup()

  renderApp('/app/reading')
  expect(await screen.findByText(/No passages yet/)).toBeInTheDocument()
  await browserUser.click(screen.getByRole('link', { name: 'Unread' }))

  expect(await screen.findByText('A new job')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Unread' })).toHaveAttribute('aria-current', 'true')
  await browserUser.click(screen.getByRole('link', { name: 'Read' }))
  expect(await screen.findByText('No passages read yet.')).toBeInTheDocument()
  expect(asked).toEqual(['any', 'false', 'true'])
})

function signedIn() {
  return { 'GET /api/v1/auth/me': () => jsonResponse(user) }
}

function page(content: ReadingSummary[]): ReadingPage {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages: content.length === 0 ? 0 : 1 }
}

function summary(overrides: Partial<ReadingSummary> = {}): ReadingSummary {
  return {
    id: 11,
    studyDate: '2026-11-01',
    createdAt: '2026-11-01T22:00:00Z',
    title: 'Signing the lease',
    wordCount: 12,
    read: false,
    ...overrides,
  }
}

function passage(overrides: Partial<ReadingPassage> = {}): ReadingPassage {
  return {
    id: 11,
    studyDate: '2026-11-01',
    createdAt: '2026-11-01T22:00:00Z',
    title: 'Signing the lease',
    text: 'Maya read the [[lease]] twice.\n\nHer [[landlord]] waited, then left.',
    words: ['lease', 'landlord'],
    read: false,
    readAt: null,
    ...overrides,
  }
}

function queue(overrides: Partial<StudyQueue> = {}): StudyQueue {
  return {
    date: '2026-11-01',
    learningCount: 0,
    reviewCount: 0,
    newCount: 0,
    unavailableCount: 0,
    nextCard: null,
    nextDueAt: null,
    studiedCount: 12,
    stillLearningCount: 0,
    notStartedCount: 0,
    newTargetCount: 10,
    goalShortfall: 0,
    finished: false,
    moreNewWords: false,
    studiedToday: [],
    ...overrides,
  }
}

