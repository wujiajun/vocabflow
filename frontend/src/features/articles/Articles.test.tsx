import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { expectNoAxeViolations } from '../../test/axe'
import { errorResponse, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'
import { articleTimings } from './articleLengths'

beforeEach(() => {
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  articleTimings.endDwellMs = 8000
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

const albums = [
  { id: 'easy', title: 'Easy reads', source: 'VOA Learning English', description: 'Simple.', clbMin: 2, clbMax: 3, articleCount: 1, readCount: 0 },
  { id: 'middle', title: 'Middle reads', source: 'VOA Learning English', description: 'Medium.', clbMin: 4, clbMax: 6, articleCount: 3, readCount: 1 },
  { id: 'hard', title: 'Hard reads', source: 'VOA Learning English', description: 'Hard.', clbMin: 7, clbMax: 9, articleCount: 1, readCount: 0 },
]

function articleList(read: Set<string>) {
  const entries = [
    { id: '101', title: 'Sew and Knit', publishedOn: '2025-03-14', readingMinutes: 2 },
    { id: '102', title: 'A Long Story', publishedOn: '2025-03-01', readingMinutes: 9 },
    { id: '103', title: 'Hello and Goodbye', publishedOn: '2025-02-01', readingMinutes: 3 },
  ]
  return entries.map((entry) => ({ ...entry, read: read.has(entry.id) }))
}

function article(read: Set<string>) {
  return {
    id: '101',
    title: 'Sew and Knit',
    albumId: 'middle',
    albumTitle: 'Middle reads',
    source: 'VOA Learning English',
    publishedOn: '2025-03-14',
    readingMinutes: 2,
    sourceUrl: 'https://learningenglish.voanews.com/a/sew-and-knit-/101.html',
    audioUrl: 'https://voa-audio.example/101.mp3',
    text: 'Anna likes to knit. She knitted a warm hat.\n\nThe next day she sewed a bag.',
    glossary: [
      { word: 'thread', definition: 'n. a long, thin piece of material' },
      { word: 'needle', definition: 'n. a small, thin piece of metal' },
    ],
    read: read.has('101'),
    readAt: read.has('101') ? '2025-05-01T10:00:00Z' : null,
  }
}

function server(read = new Set<string>(), added: unknown[] = []) {
  return {
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/articles/albums': () => jsonResponse(albums),
    'GET /api/v1/articles/albums/middle': () => {
      const articles = articleList(read)
      return jsonResponse({ ...albums[1], readCount: articles.filter((a) => a.read).length, articles })
    },
    'GET /api/v1/articles/101': () => jsonResponse(article(read)),
    'PUT /api/v1/articles/101/read': () => {
      read.add('101')
      return new Response(null, { status: 204 })
    },
    'DELETE /api/v1/articles/101/read': () => {
      read.delete('101')
      return new Response(null, { status: 204 })
    },
    'POST /api/v1/vocabulary': ({ init }: { init: RequestInit }) => {
      const body = JSON.parse(String(init.body)) as { term: string }
      added.push(body)
      if (body.term === 'needle') {
        return errorResponse(409, 'VOCABULARY_ALREADY_EXISTS', 'Already added')
      }
      return jsonResponse({ id: 5, term: body.term, enrichmentStatus: 'PENDING', learningStatus: 'NEW', senses: [], createdAt: '2026-11-01T00:00:00Z' }, 201)
    },
    'GET /api/v1/vocabulary': () => jsonResponse({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
  }
}

test('shows the albums for the learner’s own CLB level, and every level when asked, filtered by band', async () => {
  stubApi(server())
  const browserUser = userEvent.setup()
  renderApp('/app/reading/articles')

  await screen.findByRole('heading', { name: 'Middle reads' })
  expect(screen.getByText(/Showing the albums for your level, CLB 4\./)).toBeInTheDocument()
  const list = screen.getByRole('region', { name: 'Article albums' })
  expect(within(list).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Middle reads'])
  expect(within(list).getByText('1 of 3 read')).toBeInTheDocument()
  expect(within(list).getByRole('link', { name: /Middle reads/ })).toHaveAttribute('href', '/app/reading/articles/albums/middle')
  // The switch offers the three sections.
  expect(within(screen.getByRole('navigation', { name: 'Reading sections' })).getAllByRole('link').map((link) => link.textContent)).toEqual(['Passages', 'Videos', 'Articles'])
  await expectNoAxeViolations()

  await browserUser.click(screen.getByRole('link', { name: 'Show all levels' }))
  expect(within(screen.getByRole('region', { name: 'Article albums' })).getAllByRole('heading', { level: 2 })).toHaveLength(3)
  const filter = screen.getByRole('navigation', { name: 'Filter by level' })
  await browserUser.click(within(filter).getByRole('link', { name: 'CLB 6–7' }))
  // An album sits under every band its range touches: 4-6 and 7-9 both touch 6-7.
  expect(within(screen.getByRole('region', { name: 'Article albums' })).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Middle reads', 'Hard reads'])
  await browserUser.click(within(filter).getByRole('link', { name: 'CLB 1–3' }))
  expect(within(screen.getByRole('region', { name: 'Article albums' })).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Easy reads'])
})

test('an album splits short and long articles and lists the unread ones first', async () => {
  stubApi(server(new Set(['101'])))
  const browserUser = userEvent.setup()
  renderApp('/app/reading/articles/albums/middle')

  await screen.findByRole('heading', { name: 'Middle reads' })
  expect(screen.getByText('1 of 3 read')).toBeInTheDocument()
  const short = screen.getByRole('list', { name: 'Short articles' })
  // Unread first: "Hello and Goodbye" comes before the read "Sew and Knit".
  expect(within(short).getAllByRole('link').map((link) => link.textContent)).toEqual([expect.stringContaining('Hello and Goodbye'), expect.stringContaining('Sew and Knit')])
  expect(within(short).getByText('✓ Read')).toBeInTheDocument()

  await browserUser.click(screen.getByRole('button', { name: /Long/ }))
  expect(within(screen.getByRole('list', { name: 'Long articles' })).getByRole('link', { name: /A Long Story/ })).toHaveAttribute('href', '/app/reading/articles/a/102')
})

test('the article shows its text, credit and glossary; a tapped word keeps the sentence and the article link', async () => {
  const added: unknown[] = []
  stubApi(server(new Set(), added))
  const browserUser = userEvent.setup()
  renderApp('/app/reading/articles/a/101')

  await screen.findByRole('heading', { name: 'Sew and Knit' })
  expect(screen.getByRole('link', { name: 'VOA Learning English' })).toHaveAttribute('href', 'https://learningenglish.voanews.com/a/sew-and-knit-/101.html')
  expect(screen.getByRole('link', { name: 'Listen to the original recording' })).toHaveAttribute('href', 'https://voa-audio.example/101.mp3')
  expect(screen.getByText('Unread')).toBeInTheDocument()

  await browserUser.click(screen.getByText('knitted'))
  await browserUser.click(within(screen.getByRole('dialog', { name: 'Add a word' })).getByRole('button', { name: 'Add' }))
  await within(screen.getByRole('dialog', { name: 'Add a word' })).findByText(/^Added/)
  expect(added).toEqual([
    { term: 'knitted', sentence: 'She knitted a warm hat.', form: 'knitted', sourceTitle: 'Sew and Knit', sourceLink: '/app/reading/articles/a/101' },
  ])
})

test('each glossary word is added with one tap, and one already in the list says so', async () => {
  const added: unknown[] = []
  stubApi(server(new Set(), added))
  const browserUser = userEvent.setup()
  renderApp('/app/reading/articles/a/101')

  await screen.findByRole('heading', { name: 'Sew and Knit' })
  const glossary = screen.getByRole('region', { name: 'Words in this story' })
  await browserUser.click(within(glossary).getByRole('button', { name: 'Add thread to your list' }))
  await within(glossary).findByText('Added ✓')
  await browserUser.click(within(glossary).getByRole('button', { name: 'Add needle to your list' }))
  await within(glossary).findByText('In your list')
  expect(added).toEqual([{ term: 'thread' }, { term: 'needle' }])
})

test('the end of the article marks it read, and the button toggles the mark', async () => {
  articleTimings.endDwellMs = 0
  const read = new Set<string>()
  stubApi(server(read))
  let notify: (entries: { isIntersecting: boolean }[]) => void = () => {}
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        notify = callback
      }
      observe() {}
      disconnect() {}
    },
  )
  const browserUser = userEvent.setup()
  renderApp('/app/reading/articles/a/101')

  await screen.findByRole('heading', { name: 'Sew and Knit' })
  expect(read.has('101')).toBe(false)
  notify([{ isIntersecting: true }])
  await waitFor(() => expect(read.has('101')).toBe(true))
  await screen.findByText('Read ✓')

  await browserUser.click(screen.getByRole('button', { name: 'Mark as unread' }))
  await waitFor(() => expect(read.has('101')).toBe(false))
  await screen.findByRole('button', { name: 'Mark as read' })
})

test('an unknown article says so', async () => {
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/articles/999': () => errorResponse(404, 'NOT_FOUND', 'Article was not found'),
  })
  renderApp('/app/reading/articles/a/999')
  await screen.findByRole('heading', { name: 'We couldn’t find that article' })
})
