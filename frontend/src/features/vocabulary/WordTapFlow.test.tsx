import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { expectNoAxeViolations } from '../../test/axe'
import { errorResponse, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'
import type { VocabularyEntry } from './types/vocabulary'

beforeEach(() => {
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

const lease: VocabularyEntry = {
  id: 7,
  term: 'lease',
  baseForm: null,
  spellingSuggestion: null,
  type: 'WORD',
  phonetic: null,
  partOfSpeech: null,
  definition: null,
  examples: null,
  collocations: null,
  senses: [
    {
      partOfSpeech: 'noun',
      label: 'rental agreement',
      phonetic: '/liːs/',
      definition: 'A contract to rent a property.',
      examples: ['Landlords often renew a lease.', 'Signed the papers.'],
      collocations: ['sign a lease'],
    },
  ],
  enrichmentStatus: 'COMPLETED',
  failureReason: null,
  learningStatus: 'NEW',
  createdAt: '2026-10-20T12:00:00Z',
}

function routes(extra: Parameters<typeof stubApi>[0] = {}) {
  return {
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary/7': () => jsonResponse(lease),
    ...extra,
  }
}

function added(term: string): VocabularyEntry {
  return { ...lease, id: 8, term, senses: [], enrichmentStatus: 'PENDING' }
}

test('tapping a word in a definition offers to add it, ready to go', async () => {
  const requests: unknown[] = []
  stubApi(
    routes({
      'POST /api/v1/vocabulary': ({ init }) => {
        requests.push(JSON.parse(String(init.body)))
        return jsonResponse(added('rent'), 201)
      },
      'GET /api/v1/vocabulary': () => jsonResponse({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
    }),
  )
  const browserUser = userEvent.setup()
  renderApp('/app/vocabulary/7')

  await browserUser.click(await screen.findByText('rent'))

  const panel = screen.getByRole('dialog', { name: 'Add a word' })
  expect(within(panel).getByRole('textbox', { name: 'Add a word or phrase' })).toHaveValue('rent')
  expect(within(panel).getByRole('button', { name: 'Add' })).toHaveFocus()

  await expectNoAxeViolations()
  await browserUser.click(within(panel).getByRole('button', { name: 'Add' }))

  expect(await within(panel).findByRole('status')).toHaveTextContent('Added “rent” to your list.')
  // Focus stays in the panel, so Escape still closes it.
  expect(within(panel).getByRole('button', { name: 'Close' })).toHaveFocus()
  await browserUser.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(requests).toEqual([{ term: 'rent' }])
})

test('a word in an example works too, and a capital that only starts the sentence is dropped', async () => {
  stubApi(routes())
  const browserUser = userEvent.setup()
  renderApp('/app/vocabulary/7')

  await browserUser.click(await screen.findByText('Signed'))

  expect(screen.getByRole('textbox', { name: 'Add a word or phrase' })).toHaveValue('signed')
})

test('words in the combinations are plain text', async () => {
  stubApi(routes())
  const browserUser = userEvent.setup()
  renderApp('/app/vocabulary/7')

  await browserUser.click(await screen.findByText('sign a lease'))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('tapping another word replaces the one in the panel', async () => {
  stubApi(routes())
  const browserUser = userEvent.setup()
  renderApp('/app/vocabulary/7')

  await browserUser.click(await screen.findByText('rent'))
  await browserUser.click(screen.getByText('property'))

  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(screen.getByRole('textbox', { name: 'Add a word or phrase' })).toHaveValue('property')
})

test('a word already in the list says so', async () => {
  stubApi(
    routes({ 'POST /api/v1/vocabulary': () => errorResponse(409, 'CONFLICT', 'This vocabulary is already in your list') }),
  )
  const browserUser = userEvent.setup()
  renderApp('/app/vocabulary/7')

  await browserUser.click(await screen.findByText('rent'))
  await browserUser.click(screen.getByRole('button', { name: 'Add' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('“rent” is already in your list.')
  expect(screen.getByRole('textbox', { name: 'Add a word or phrase' })).toHaveAttribute('aria-invalid', 'true')
})

test('the Add button keeps focus while the request runs, so Escape still works after an error', async () => {
  let answer: (response: Response) => void = () => {}
  const requests: unknown[] = []
  stubApi(
    routes({
      'POST /api/v1/vocabulary': ({ init }) => {
        requests.push(JSON.parse(String(init.body)))
        return new Promise<Response>((resolve) => {
          answer = resolve
        })
      },
    }),
  )
  const browserUser = userEvent.setup()
  renderApp('/app/vocabulary/7')

  await browserUser.click(await screen.findByText('rent'))
  const add = screen.getByRole('button', { name: 'Add' })
  await browserUser.click(add)

  const adding = await screen.findByRole('button', { name: 'Adding…' })
  expect(adding).toHaveFocus()
  expect(adding).toHaveAttribute('aria-disabled', 'true')
  await browserUser.click(adding)
  expect(requests).toHaveLength(1)

  answer(errorResponse(409, 'CONFLICT', 'This vocabulary is already in your list'))
  expect(await screen.findByRole('alert')).toHaveTextContent('already in your list')
  expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus()

  await browserUser.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('the panel can be edited before adding', async () => {
  const requests: unknown[] = []
  stubApi(
    routes({
      'POST /api/v1/vocabulary': ({ init }) => {
        requests.push(JSON.parse(String(init.body)))
        return jsonResponse(added('rent'), 201)
      },
      'GET /api/v1/vocabulary': () => jsonResponse({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
    }),
  )
  const browserUser = userEvent.setup()
  renderApp('/app/vocabulary/7')

  await browserUser.click(await screen.findByText('property'))
  const field = screen.getByRole('textbox', { name: 'Add a word or phrase' })
  await browserUser.clear(field)
  await browserUser.type(field, 'rented out{Enter}')

  await screen.findByText('Added “rented out” to your list.')
  expect(requests).toEqual([{ term: 'rented out' }])
})

test('“Add a word” opens an empty field by keyboard, and Escape closes it and gives focus back', async () => {
  stubApi(routes())
  const browserUser = userEvent.setup()
  renderApp('/app/vocabulary/7')
  await screen.findByText('rent')

  await browserUser.tab()
  const button = screen.getByRole('button', { name: 'Add a word' })
  button.focus()
  await browserUser.keyboard('{Enter}')

  const field = screen.getByRole('textbox', { name: 'Add a word or phrase' })
  expect(field).toHaveValue('')
  expect(field).toHaveFocus()

  await browserUser.keyboard('{Enter}')
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a word or phrase.')

  await browserUser.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(button).toHaveFocus()
})

test('Close dismisses the panel', async () => {
  stubApi(routes())
  const browserUser = userEvent.setup()
  renderApp('/app/vocabulary/7')

  await browserUser.click(await screen.findByText('rent'))
  await browserUser.click(screen.getByRole('button', { name: 'Close' }))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('the tapped word is highlighted until the panel closes, and only that one', async () => {
  stubApi(
    routes({
      'POST /api/v1/vocabulary': () => jsonResponse(added('rent'), 201),
      'GET /api/v1/vocabulary': () => jsonResponse({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
    }),
  )
  const browserUser = userEvent.setup()
  renderApp('/app/vocabulary/7')
  const rent = await screen.findByText('rent')
  expect(rent).not.toHaveAttribute('data-selected')

  await browserUser.click(rent)
  expect(rent).toHaveAttribute('data-selected')

  await browserUser.click(screen.getByText('property'))
  expect(rent).not.toHaveAttribute('data-selected')
  expect(screen.getByText('property')).toHaveAttribute('data-selected')

  await browserUser.click(screen.getByRole('button', { name: 'Add' }))
  await within(screen.getByRole('dialog')).findByRole('status')
  // Still marked after adding, so it is clear which word was added.
  expect(screen.getByText('property')).toHaveAttribute('data-selected')

  await browserUser.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.getByText('property')).not.toHaveAttribute('data-selected')
})

test('opening the panel with “Add a word” highlights nothing', async () => {
  stubApi(routes())
  const browserUser = userEvent.setup()
  renderApp('/app/vocabulary/7')
  await browserUser.click(await screen.findByText('rent'))
  await browserUser.click(screen.getByRole('button', { name: 'Add a word' }))

  expect(document.querySelector('[data-selected]')).toBeNull()
})
