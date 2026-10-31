import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { toLocalDateString } from '../../shared/date'
import { expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'
import { filterFromParam, filterQuery } from './hooks/listFilter'

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
  return { id, term, type: null, phonetic: null, partOfSpeech: null, definition: null, examples: null, collocations: null, senses: [], enrichmentStatus: 'COMPLETED', failureReason: null, learningStatus: 'NEW', createdAt: '2026-10-20T12:00:00Z' }
}

function page(content: unknown[], totalPages = 1, number = 0) {
  return { content, page: number, size: 20, totalElements: content.length, totalPages }
}

function api(respond: (url: URL) => unknown) {
  return stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary': ({ url }) => jsonResponse(respond(url)),
    'POST /api/v1/vocabulary': () => jsonResponse(entry(9, 'added word')),
  })
}

const urls = (fetchMock: ReturnType<typeof stubApi>) =>
  fetchMock.mock.calls.map(([path]) => String(path)).filter((path) => path.startsWith('/api/v1/vocabulary'))

test('offers every list, marks the current one, and starts on All', async () => {
  const fetchMock = api(() => page([entry(1, 'one')]))

  renderApp('/app/vocabulary')
  await screen.findByText('one')

  const filters = within(screen.getByRole('navigation', { name: 'Filter vocabulary' })).getAllByRole('link')
  expect(filters.map((link) => link.textContent)).toEqual(['All', 'Due today', 'New', 'Learning', 'Familiar', 'Mastered'])
  expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'true')
  expect(urls(fetchMock).at(-1)).toBe('/api/v1/vocabulary?page=0&size=20')
})

test('choosing a list asks the server for it and starts from its first page', async () => {
  const fetchMock = api((url) => (url.searchParams.get('status') === 'FAMILIAR' ? page([entry(2, 'known')]) : page([entry(1, 'one')], 3, 1)))
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary?page=2')
  await screen.findByText('one')
  await browserUser.click(screen.getByRole('link', { name: 'Familiar' }))

  expect(await screen.findByText('known')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Familiar' })).toHaveAttribute('aria-current', 'true')
  expect(screen.getByRole('link', { name: 'All' })).not.toHaveAttribute('aria-current')
  expect(urls(fetchMock).at(-1)).toBe('/api/v1/vocabulary?page=0&size=20&status=FAMILIAR')
})

test('Due today asks for the local date', async () => {
  const fetchMock = api(() => page([entry(3, 'due word')]))

  renderApp('/app/vocabulary?show=due')

  await screen.findByText('due word')
  expect(urls(fetchMock).at(-1)).toBe(`/api/v1/vocabulary?page=0&size=20&due=${toLocalDateString(new Date())}`)
})

test('paging keeps the list', async () => {
  const fetchMock = api((url) =>
    url.searchParams.get('page') === '1' ? page([entry(5, 'second page')], 2, 1) : page([entry(4, 'first page')], 2),
  )
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary?show=new')
  await screen.findByText('first page')
  await browserUser.click(screen.getByRole('button', { name: 'Next' }))

  expect(await screen.findByText('second page')).toBeInTheDocument()
  expect(urls(fetchMock).at(-1)).toBe('/api/v1/vocabulary?page=1&size=20&status=NEW')
  expect(screen.getByRole('link', { name: 'New' })).toHaveAttribute('aria-current', 'true')
})

test('an empty list says so without telling the user they have no words', async () => {
  api(() => page([], 0))

  renderApp('/app/vocabulary?show=mastered')

  expect(await screen.findByText('No words in this list.')).toBeInTheDocument()
  expect(screen.queryByText(/No words yet/)).not.toBeInTheDocument()
})

test('adding a word while filtered returns to All, where the new word shows', async () => {
  const fetchMock = api(() => page([]))
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary?show=mastered')
  await browserUser.type(await screen.findByLabelText('New word or phrase'), 'added word')
  await browserUser.click(screen.getByRole('button', { name: 'Add' }))

  await screen.findByText('Added “added word”.')
  expect(await screen.findByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'true')
  expect(urls(fetchMock).at(-1)).toBe('/api/v1/vocabulary?page=0&size=20')
})

test('an entry opened from a filtered list comes back to that list', async () => {
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary': () => jsonResponse(page([entry(1, 'one')])),
    'GET /api/v1/vocabulary/1': () => jsonResponse(entry(1, 'one')),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary?show=new')
  await browserUser.click(await screen.findByRole('link', { name: /^one/ }))
  await browserUser.click(await screen.findByRole('link', { name: '← Back to vocabulary' }))

  expect(await screen.findByRole('link', { name: 'New' })).toHaveAttribute('aria-current', 'true')
})

test.each([
  ['new', 'new'],
  ['due', 'due'],
  ['everything', 'all'],
  [null, 'all'],
])('reads %j from the URL as %s', (param, filter) => {
  expect(filterFromParam(param)).toBe(filter)
})

test.each([
  ['all', ''],
  ['due', '&due=2026-11-01'],
  ['new', '&status=NEW'],
  ['learning', '&status=LEARNING'],
  ['familiar', '&status=FAMILIAR'],
  ['mastered', '&status=MASTERED'],
] as const)('asks the server for %s with %j', (filter, query) => {
  expect(filterQuery(filter, '2026-11-01')).toBe(query)
})
