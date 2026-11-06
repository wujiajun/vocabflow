import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { expectNoAxeViolations } from '../../test/axe'
import { installSpeechSynthesis, voice } from '../../test/speech'
import { expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'
import type { ReadingPassage } from '../reading/types/reading'
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

const walk: VocabularyEntry = {
  id: 9,
  term: 'walk',
  baseForm: null,
  spellingSuggestion: null,
  type: 'WORD',
  phonetic: null,
  partOfSpeech: null,
  definition: null,
  examples: null,
  collocations: null,
  senses: [{ partOfSpeech: 'verb', label: null, phonetic: null, definition: 'To move on foot.', examples: null, collocations: null }],
  enrichmentStatus: 'COMPLETED',
  failureReason: null,
  learningStatus: 'NEW',
  createdAt: '2026-10-20T12:00:00Z',
}

const passage: ReadingPassage = {
  id: 11,
  studyDate: '2026-11-01',
  createdAt: '2026-11-01T20:00:00Z',
  title: 'A quiet morning',
  text: 'Anna woke early. She walked slowly to the market, and the vendors greeted her.',
  words: [],
  read: false,
  readAt: null,
}

test('a word tapped in a passage is added with its sentence and the passage it came from', async () => {
  const requests: unknown[] = []
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/reading/passages/11': () => jsonResponse(passage),
    'GET /api/v1/reading/passages': () => jsonResponse({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
    'GET /api/v1/vocabulary': () => jsonResponse({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
    'POST /api/v1/vocabulary': ({ init }) => {
      requests.push(JSON.parse(String(init.body)))
      return jsonResponse(walk, 201)
    },
  })
  const browserUser = userEvent.setup()
  renderApp('/app/reading/11')

  await browserUser.click(await screen.findByText('walked'))
  await browserUser.click(within(screen.getByRole('dialog', { name: 'Add a word' })).getByRole('button', { name: 'Add' }))

  await within(screen.getByRole('dialog', { name: 'Add a word' })).findByText(/^Added/)
  expect(requests).toEqual([
    {
      term: 'walked',
      sentence: 'She walked slowly to the market, and the vendors greeted her.',
      form: 'walked',
      sourceTitle: 'A quiet morning',
      sourceLink: '/app/reading/11',
    },
  ])
})

test('a word typed over the tapped one is added without the sentence', async () => {
  const requests: unknown[] = []
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/reading/passages/11': () => jsonResponse(passage),
    'GET /api/v1/reading/passages': () => jsonResponse({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
    'GET /api/v1/vocabulary': () => jsonResponse({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
    'POST /api/v1/vocabulary': ({ init }) => {
      requests.push(JSON.parse(String(init.body)))
      return jsonResponse(walk, 201)
    },
  })
  const browserUser = userEvent.setup()
  renderApp('/app/reading/11')

  await browserUser.click(await screen.findByText('market'))
  const box = screen.getByRole('textbox', { name: 'Add a word or phrase' })
  await browserUser.clear(box)
  await browserUser.type(box, 'shop{Enter}')

  await within(screen.getByRole('dialog', { name: 'Add a word' })).findByText(/^Added/)
  expect(requests).toEqual([{ term: 'shop' }])
})

test('the detail page shows the source sentence with the tapped form in bold and a link back', async () => {
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary/9': () =>
      jsonResponse({
        ...walk,
        source: {
          sentence: 'She walked slowly to the market.',
          form: 'walked',
          title: 'A quiet morning',
          link: '/app/reading/11',
        },
      }),
  })
  const speech = installSpeechSynthesis([voice('Samantha', 'en-US')])
  const browserUser = userEvent.setup()
  renderApp('/app/vocabulary/9')

  const block = await screen.findByRole('region', { name: 'Source' })
  expect(block).toHaveTextContent('She walked slowly to the market.')
  expect(within(block).getByText('walked')).toHaveClass('font-semibold')
  expect(within(block).getByText('slowly')).not.toHaveClass('font-semibold')
  expect(within(block).getByRole('link', { name: 'From “A quiet morning”' })).toHaveAttribute('href', '/app/reading/11')
  await browserUser.click(within(block).getByRole('button', { name: /Play pronunciation/ }))
  expect(speech.lastUtterance().text).toBe('She walked slowly to the market.')
  await expectNoAxeViolations()
})

test('a tapped word in the source sentence offers to add it', async () => {
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary/9': () =>
      jsonResponse({ ...walk, source: { sentence: 'She walked slowly.', form: 'walked', title: null, link: null } }),
  })
  const browserUser = userEvent.setup()
  renderApp('/app/vocabulary/9')

  await browserUser.click(await screen.findByText('slowly'))

  expect(screen.getByRole('textbox', { name: 'Add a word or phrase' })).toHaveValue('slowly')
})

test('a word without a source shows no source block', async () => {
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary/9': () => jsonResponse({ ...walk, source: null }),
  })
  renderApp('/app/vocabulary/9')

  await screen.findByRole('heading', { name: 'walk' })
  expect(screen.queryByRole('region', { name: 'Source' })).not.toBeInTheDocument()
})
