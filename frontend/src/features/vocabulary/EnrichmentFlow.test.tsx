import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { errorResponse, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user, wholeText } from '../../test/utils'
import type { VocabularyEntry } from './types/vocabulary'

const polling = vi.hoisted(() => ({ intervalMs: 20 }))

vi.mock('./hooks/pollingConfig', () => ({
  get enrichmentPollIntervalMs() {
    return polling.intervalMs
  },
  enrichmentPollWindowMs: 400,
}))

beforeEach(() => {
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  polling.intervalMs = 20
  cleanup()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

test('keeps re-reading the list until a pending word has been filled in', async () => {
  let reads = 0
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary': () => {
      reads += 1
      return jsonResponse(page([reads < 3 ? entry({ enrichmentStatus: 'PENDING' }) : done()]))
    },
  })

  renderApp('/app/vocabulary')

  expect(await screen.findByText('Enriching…')).toBeInTheDocument()
  expect(await screen.findByText('A definition.')).toBeInTheDocument()
  expect(screen.queryByText('Enriching…')).not.toBeInTheDocument()
  const readsWhenDone = reads
  await new Promise((resolve) => setTimeout(resolve, 100))
  expect(reads).toBe(readsWhenDone)
})

test('does not poll when nothing is waiting to be enriched', async () => {
  let reads = 0
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary': () => {
      reads += 1
      return jsonResponse(page([done(), entry({ id: 2, term: 'broken', enrichmentStatus: 'FAILED' })]))
    },
  })

  renderApp('/app/vocabulary')
  await screen.findByText('A definition.')
  await new Promise((resolve) => setTimeout(resolve, 100))

  expect(reads).toBe(1)
})

test('gives up polling after the window instead of polling forever', async () => {
  let reads = 0
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary': () => {
      reads += 1
      return jsonResponse(page([entry({ enrichmentStatus: 'PENDING' })]))
    },
  })

  renderApp('/app/vocabulary')
  await screen.findByText('Enriching…')
  await new Promise((resolve) => setTimeout(resolve, 700))
  const readsAfterWindow = reads
  await new Promise((resolve) => setTimeout(resolve, 150))

  expect(readsAfterWindow).toBeGreaterThan(3)
  expect(reads).toBe(readsAfterWindow)
})

test('the detail page announces progress and reveals the details when they are ready', async () => {
  let reads = 0
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary/7': () => {
      reads += 1
      return jsonResponse(reads < 3 ? entry({ enrichmentStatus: 'PROCESSING' }) : done())
    },
  })

  renderApp('/app/vocabulary/7')

  expect(await screen.findByText(/Filling in the details/)).toBeInTheDocument()
  expect(await screen.findByText(wholeText('A definition.'))).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Details are ready.'))
  expect(screen.queryByText('Definition not available yet.')).not.toBeInTheDocument()
})

test('“Check now” reads the word again right away', async () => {
  let reads = 0
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary/7': () => {
      reads += 1
      return jsonResponse(entry({ enrichmentStatus: 'PENDING' }))
    },
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary/7')
  await screen.findByRole('button', { name: 'Check now' })
  const before = reads
  await browserUser.click(screen.getByRole('button', { name: 'Check now' }))

  await waitFor(() => expect(reads).toBeGreaterThan(before))
})

test('a failed word explains why and can be retried, which resumes the progress display', async () => {
  let retried = false
  let reads = 0
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary/7': () => {
      reads += 1
      return jsonResponse(
        retried ? (reads > 3 ? done() : entry({ enrichmentStatus: 'PROCESSING' })) : failed('Enrichment could not be completed'),
      )
    },
    'POST /api/v1/vocabulary/7/enrichment/retry': () => {
      retried = true
      reads = 0
      return jsonResponse(entry({ enrichmentStatus: 'PROCESSING' }))
    },
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary/7')
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('The details couldn’t be filled in. Enrichment could not be completed.')
  await browserUser.click(within(alert).getByRole('button', { name: 'Retry details' }))

  expect(await screen.findByText(/Filling in the details/)).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveFocus()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(await screen.findByText(wholeText('A definition.'))).toBeInTheDocument()
})

test('shows the daily limit message when a retry is refused', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary/7': () => jsonResponse(failed('Daily enrichment limit reached')),
    'POST /api/v1/vocabulary/7/enrichment/retry': () =>
      errorResponse(429, 'ENRICHMENT_LIMIT_REACHED', 'Daily enrichment limit reached'),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary/7')
  await browserUser.click(await screen.findByRole('button', { name: 'Retry details' }))

  await waitFor(() => expect(screen.getByRole('button', { name: 'Retry details' })).not.toHaveAttribute('aria-disabled', 'true'))
  const alert = screen.getByRole('alert')
  expect(alert.textContent?.match(/Daily enrichment limit reached/g)).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Retry details' })).toBeInTheDocument()
})

test('shows a refused retry’s own message when it differs from the stored reason', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary/7': () => jsonResponse(failed('Enrichment could not be completed')),
    'POST /api/v1/vocabulary/7/enrichment/retry': () =>
      errorResponse(429, 'ENRICHMENT_LIMIT_REACHED', 'Daily enrichment limit reached'),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary/7')
  await browserUser.click(await screen.findByRole('button', { name: 'Retry details' }))

  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Daily enrichment limit reached'))
  expect(screen.getByRole('alert')).toHaveTextContent('Enrichment could not be completed.')
})

test('a word that is already enriched shows no progress or retry controls', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/vocabulary/7': () => jsonResponse(done()) })

  renderApp('/app/vocabulary/7')
  await screen.findByText(wholeText('A definition.'))

  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  expect(screen.queryByRole('button', { name: /Retry|Check now/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

function signedIn() {
  return { 'GET /api/v1/auth/me': () => jsonResponse(user) }
}

function page(content: VocabularyEntry[]) {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages: 1 }
}

function done() {
  return entry({ enrichmentStatus: 'COMPLETED', definition: 'A definition.' })
}

function failed(reason: string) {
  return entry({ enrichmentStatus: 'FAILED', failureReason: reason })
}

function entry(overrides: Partial<VocabularyEntry> = {}): VocabularyEntry {
  return {
    id: 7,
    term: 'overwhelmed',
    baseForm: null,
    type: null,
    phonetic: null,
    partOfSpeech: null,
    definition: null,
    examples: null,
    collocations: null,
    senses: overrides.definition
      ? [{ partOfSpeech: null, label: null, phonetic: null, definition: overrides.definition, examples: null, collocations: null }]
      : [],
    enrichmentStatus: 'COMPLETED',
    failureReason: null,
    learningStatus: 'NEW',
    createdAt: '2026-10-20T12:00:00Z',
    ...overrides,
  }
}

test('opening a word right after adding it shows the server’s current state, not the add-time snapshot', async () => {
  // So slow that only reading on open, not polling, can replace the snapshot within the test.
  polling.intervalMs = 60_000
  let detailReads = 0
  let added = false
  stubApi({
    ...signedIn(),
    'GET /api/v1/vocabulary': () => jsonResponse(page(added ? [failed('Daily enrichment limit reached')] : [])),
    'POST /api/v1/vocabulary': () => {
      added = true
      return jsonResponse(entry({ enrichmentStatus: 'PENDING' }))
    },
    'GET /api/v1/vocabulary/7': () => {
      detailReads += 1
      return jsonResponse(failed('Daily enrichment limit reached'))
    },
  })
  const browserUser = userEvent.setup()

  // The app keeps data fresh for 30 seconds; the test client would otherwise re-read on every mount.
  renderApp('/app/vocabulary', (client) =>
    client.setDefaultOptions({ queries: { retry: false, staleTime: 30_000 } }),
  )
  await browserUser.type(await screen.findByLabelText('New word or phrase'), 'overwhelmed')
  await browserUser.click(screen.getByRole('button', { name: 'Add' }))
  await browserUser.click(await screen.findByRole('link', { name: /overwhelmed/ }))

  expect(await screen.findByRole('button', { name: 'Retry details' })).toBeInTheDocument()
  expect(detailReads).toBeGreaterThan(0)
})
