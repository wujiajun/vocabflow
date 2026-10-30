import { cleanup, screen, within } from '@testing-library/react'
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
import type { VocabularyEntry } from './types/vocabulary'

const overwhelmed = entry({
  id: 7,
  term: 'overwhelmed',
  type: 'WORD',
  phonetic: '/ˌoʊvərˈwelmd/',
  partOfSpeech: 'adjective',
  definition: 'Feeling unable to deal with a situation because there is too much to do.',
  examples: ['I felt overwhelmed during my first week at work.'],
  collocations: ['feel overwhelmed', 'overwhelmed by'],
})
const figureOut = entry({
  id: 8,
  term: 'figure out',
  type: 'PHRASAL_VERB',
  partOfSpeech: 'phrasal verb',
  definition: 'To understand or solve something.',
})

beforeEach(() => {
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

test('lists saved vocabulary with its details and links each entry to its page', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/vocabulary': () => jsonResponse(page([overwhelmed, figureOut])) })

  renderApp('/app')

  expect(await screen.findByRole('heading', { name: 'Your vocabulary' })).toBeInTheDocument()
  const list = await screen.findByRole('list')
  const items = within(list).getAllByRole('listitem')
  expect(items).toHaveLength(2)
  expect(items[0]).toHaveTextContent('overwhelmed')
  expect(items[0]).toHaveTextContent('Word · adjective')
  expect(items[0]).toHaveTextContent('Feeling unable to deal with a situation')
  expect(items[1]).toHaveTextContent('Phrasal verb')
  expect(items[1]).not.toHaveTextContent('Phrasal verb · phrasal verb')
  expect(within(items[0]).getByRole('link')).toHaveAttribute('href', '/app/vocabulary/7')
  expect(screen.getByText('2 entries')).toBeInTheDocument()
})

test('shows an empty state when nothing has been saved yet', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/vocabulary': () => jsonResponse(page([])) })

  renderApp('/app/vocabulary')

  expect(await screen.findByText('No words yet. Add your first word or phrase above.')).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Vocabulary pages' })).not.toBeInTheDocument()
})

test('marks entries whose enrichment is pending or failed', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary': () =>
      jsonResponse(
        page([
          entry({ id: 1, term: 'waiting', enrichmentStatus: 'PENDING' }),
          entry({ id: 2, term: 'broken', enrichmentStatus: 'FAILED' }),
          entry({ id: 3, term: 'done', enrichmentStatus: 'COMPLETED' }),
        ]),
      ),
  })

  renderApp('/app/vocabulary')

  const items = await screen.findAllByRole('listitem')
  expect(items[0]).toHaveTextContent('Enriching…')
  expect(items[1]).toHaveTextContent('Details unavailable')
  expect(items[2]).not.toHaveTextContent('Enriching…')
  expect(items[2]).not.toHaveTextContent('Details unavailable')
})

test('requests the next page from the server when paginating', async () => {
  const fetchMock = stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary': ({ url }) =>
      url.searchParams.get('page') === '1'
        ? jsonResponse({ ...page([figureOut], 2, 21), page: 1 })
        : jsonResponse(page([overwhelmed], 2, 21)),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary')
  expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  await browserUser.click(screen.getByRole('button', { name: 'Next' }))

  expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
  expect(await screen.findByText('figure out')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/vocabulary?page=1&size=20', expect.anything())
})

test('shows a retryable error when the list cannot be loaded', async () => {
  let listCalls = 0
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary': () => {
      listCalls += 1
      return listCalls === 1
        ? errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred')
        : jsonResponse(page([overwhelmed]))
    },
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary')
  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
  await browserUser.click(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByText('overwhelmed')).toBeInTheDocument()
})

test('adds a trimmed term, clears the input and refreshes the list', async () => {
  let saved: VocabularyEntry[] = []
  const fetchMock = stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary': () => jsonResponse(page(saved)),
    'POST /api/v1/vocabulary': () => {
      saved = [figureOut]
      return jsonResponse(figureOut)
    },
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary')
  const input = await screen.findByLabelText('New word or phrase')
  await browserUser.type(input, '  figure out  ')
  await browserUser.click(screen.getByRole('button', { name: 'Add' }))

  expect(await screen.findByRole('listitem')).toHaveTextContent('figure out')
  expect(input).toHaveValue('')
  expect(input).toHaveFocus()
  const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
  expect(JSON.parse(post?.[1]?.body as string)).toEqual({ term: 'figure out' })
})

test('does not send blank or over-long terms', async () => {
  const fetchMock = stubApi({ ...signedIn(), 'GET /api/v1/vocabulary': () => jsonResponse(page([])) })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary')
  const input = await screen.findByLabelText('New word or phrase')
  await browserUser.type(input, '   ')
  await browserUser.click(screen.getByRole('button', { name: 'Add' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a word or phrase.')

  await browserUser.clear(input)
  await browserUser.click(input)
  await browserUser.paste('x'.repeat(256))
  await browserUser.click(screen.getByRole('button', { name: 'Add' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Keep it to 255 characters or fewer.')

  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
})

test('shows the backend message and keeps the input when the word is already saved', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary': () => jsonResponse(page([overwhelmed])),
    'POST /api/v1/vocabulary': () => errorResponse(409, 'CONFLICT', 'This vocabulary is already in your list'),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary')
  const input = await screen.findByLabelText('New word or phrase')
  await browserUser.type(input, 'Overwhelmed')
  await browserUser.click(screen.getByRole('button', { name: 'Add' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('This vocabulary is already in your list')
  expect(input).toHaveValue('Overwhelmed')
})

test('returns to the first page after adding so the new word is visible', async () => {
  const fetchMock = stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary': ({ url }) =>
      url.searchParams.get('page') === '1'
        ? jsonResponse({ ...page([figureOut], 2, 21), page: 1 })
        : jsonResponse(page([overwhelmed], 2, 21)),
    'POST /api/v1/vocabulary': () => jsonResponse(entry({ id: 9, term: 'brand new' })),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary')
  await browserUser.click(await screen.findByRole('button', { name: 'Next' }))
  expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
  await browserUser.type(screen.getByLabelText('New word or phrase'), 'brand new')
  await browserUser.click(screen.getByRole('button', { name: 'Add' }))

  expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/vocabulary?page=0&size=20', expect.anything())
})

test('opens an entry from the list and shows its full details', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary': () => jsonResponse(page([overwhelmed])),
    'GET /api/v1/vocabulary/7': () => jsonResponse(overwhelmed),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary')
  await browserUser.click(await screen.findByRole('link', { name: /overwhelmed/ }))

  expect(await screen.findByRole('heading', { name: 'overwhelmed' })).toBeInTheDocument()
  expect(screen.getByText(/\/ˌoʊvərˈwelmd\//)).toBeInTheDocument()
  expect(screen.getByText('Feeling unable to deal with a situation because there is too much to do.')).toBeInTheDocument()
  expect(screen.getByText('I felt overwhelmed during my first week at work.')).toBeInTheDocument()
  expect(screen.getByText('feel overwhelmed')).toBeInTheDocument()
  expect(screen.getByText(/Status: New/)).toBeInTheDocument()

  await browserUser.click(screen.getByRole('link', { name: '← Back to vocabulary' }))
  expect(await screen.findByRole('heading', { name: 'Your vocabulary' })).toBeInTheDocument()
})

test('shows a placeholder for details that have not been enriched yet', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary/3': () => jsonResponse(entry({ id: 3, term: 'waiting', enrichmentStatus: 'PENDING' })),
  })

  renderApp('/app/vocabulary/3')

  expect(await screen.findByRole('heading', { name: 'waiting' })).toBeInTheDocument()
  expect(screen.getByText('Enriching…')).toBeInTheDocument()
  expect(screen.getByText('Definition not available yet.')).toBeInTheDocument()
})

test('shows not found for a missing entry', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary/404': () => errorResponse(404, 'NOT_FOUND', 'Vocabulary was not found'),
  })

  renderApp('/app/vocabulary/404')

  expect(await screen.findByRole('heading', { name: 'We couldn’t find that word' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '← Back to vocabulary' })).toBeInTheDocument()
})

test('shows not found without a request when the id is not a number', async () => {
  const fetchMock = stubApi(signedIn())

  renderApp('/app/vocabulary/abc')

  expect(await screen.findByRole('heading', { name: 'We couldn’t find that word' })).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/v1/vocabulary'), expect.anything())
})

test('shows a retryable error when an entry cannot be loaded', async () => {
  let calls = 0
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary/7': () => {
      calls += 1
      return calls === 1 ? errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred') : jsonResponse(overwhelmed)
    },
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary/7')
  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
  await browserUser.click(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByRole('heading', { name: 'overwhelmed' })).toBeInTheDocument()
})

test('sends unknown app paths to the vocabulary page', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/vocabulary': () => jsonResponse(page([])) })

  renderApp('/app/somewhere-else')

  expect(await screen.findByRole('heading', { name: 'Your vocabulary' })).toBeInTheDocument()
})

function signedIn() {
  return { 'GET /api/v1/auth/me': () => jsonResponse(user) }
}

function page(content: VocabularyEntry[], totalPages = content.length === 0 ? 0 : 1, totalElements = content.length) {
  return { content, page: 0, size: 20, totalElements, totalPages }
}

function entry(overrides: Partial<VocabularyEntry> & Pick<VocabularyEntry, 'id' | 'term'>): VocabularyEntry {
  return {
    type: null,
    phonetic: null,
    partOfSpeech: null,
    definition: null,
    examples: null,
    collocations: null,
    enrichmentStatus: 'COMPLETED',
    learningStatus: 'NEW',
    createdAt: '2026-10-20T12:00:00Z',
    ...overrides,
  }
}
