import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'
import { filterQuery, listPath, searchFromParam } from './hooks/listFilter'

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
  })
}

const urls = (fetchMock: ReturnType<typeof stubApi>) =>
  fetchMock.mock.calls.map(([path]) => String(path)).filter((path) => path.startsWith('/api/v1/vocabulary'))

const searchBox = () => screen.findByRole('searchbox', { name: 'Search your vocabulary' })

test('typing waits for a pause, then asks the server once and keeps the text in the address', async () => {
  const fetchMock = api((url) => (url.searchParams.get('q') === 'chee' ? page([entry(2, 'cheese')]) : page([entry(1, 'apple'), entry(2, 'cheese')])))
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary')
  await screen.findByText('apple')
  await browserUser.type(await searchBox(), 'chee')

  expect(await screen.findByText('1 entry found')).toBeInTheDocument()
  expect(screen.queryByText('apple')).not.toBeInTheDocument()
  const searches = urls(fetchMock).filter((path) => path.includes('q='))
  expect(searches).toEqual(['/api/v1/vocabulary?page=0&size=20&q=chee'])
})

test('a search in the address is filled in and sent, with the list and special characters kept', async () => {
  const fetchMock = api(() => page([entry(1, '50% off')]))

  renderApp('/app/vocabulary?show=new&q=50%25%20o')

  await screen.findByText('50% off')
  expect(await searchBox()).toHaveValue('50% o')
  expect(urls(fetchMock).at(-1)).toBe('/api/v1/vocabulary?page=0&size=20&status=NEW&q=50%25%20o')
})

test('a new search goes back to the first page', async () => {
  const fetchMock = api(() => page([entry(1, 'one')], 3, 1))
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary?page=2')
  await screen.findByText('one')
  await browserUser.type(await searchBox(), 'o')

  await waitFor(() => expect(urls(fetchMock).at(-1)).toBe('/api/v1/vocabulary?page=0&size=20&q=o'))
})

test('paging and choosing a list keep the search', async () => {
  const fetchMock = api((url) => (url.searchParams.get('page') === '1' ? page([entry(5, 'second')], 2, 1) : page([entry(4, 'first')], 2)))
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary?q=s')
  await screen.findByText('first')
  await browserUser.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('second')
  expect(urls(fetchMock).at(-1)).toBe('/api/v1/vocabulary?page=1&size=20&q=s')

  await browserUser.click(screen.getByRole('link', { name: 'Learning' }))
  await waitFor(() => expect(urls(fetchMock).at(-1)).toBe('/api/v1/vocabulary?page=0&size=20&status=LEARNING&q=s'))
  expect(await searchBox()).toHaveValue('s')
})

test('the clear button empties the search at once and brings the whole list back', async () => {
  const fetchMock = api((url) => (url.searchParams.get('q') ? page([entry(2, 'cheese')]) : page([entry(1, 'apple'), entry(2, 'cheese')])))
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary?q=chee')
  await screen.findByText('1 entry found')
  await browserUser.click(screen.getByRole('button', { name: 'Clear search' }))

  expect(await screen.findByText('apple')).toBeInTheDocument()
  expect(await searchBox()).toHaveValue('')
  expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
  expect(urls(fetchMock).at(-1)).toBe('/api/v1/vocabulary?page=0&size=20')
})

test('no match says so and offers to clear the search', async () => {
  api((url) => (url.searchParams.get('q') ? page([], 0) : page([entry(1, 'apple')])))
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary?q=zzz')

  expect(await screen.findByText(/No words match “zzz”/)).toBeInTheDocument()
  expect(screen.queryByText(/No words yet/)).not.toBeInTheDocument()
  await browserUser.click(screen.getByRole('button', { name: 'Clear the search' }))
  expect(await screen.findByText('apple')).toBeInTheDocument()
})

test('adding a word clears the search box along with the address', async () => {
  api((url) => (url.searchParams.get('q') ? page([]) : page([entry(1, 'apple')])))
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary': ({ url }) => jsonResponse(url.searchParams.get('q') ? page([]) : page([entry(1, 'apple')])),
    'POST /api/v1/vocabulary': () => jsonResponse(entry(9, 'added word')),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary?q=zzz')
  await browserUser.type(await screen.findByLabelText('New word or phrase'), 'added word')
  await browserUser.click(screen.getByRole('button', { name: 'Add' }))

  await waitFor(async () => expect(await searchBox()).toHaveValue(''))
})

test('the address text is trimmed and cut, and goes into the request encoded', () => {
  expect(searchFromParam('  cheese ')).toBe('cheese')
  expect(searchFromParam('   ')).toBe('')
  expect(searchFromParam(null)).toBe('')
  expect(searchFromParam('x'.repeat(150))).toHaveLength(100)
  expect(filterQuery('all', '2026-11-01', 'a&b%')).toBe('&q=a%26b%25')
  expect(filterQuery('due', '2026-11-01', 'x')).toBe('&due=2026-11-01&q=x')
  expect(listPath('new', 'a b')).toBe('/app/vocabulary?show=new&q=a+b')
  expect(listPath('all')).toBe('/app/vocabulary')
})
