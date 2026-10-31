import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../api/tokenStorage'
import { expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user, emptyStudyQueue } from '../../test/utils'
import { installSpeechSynthesis, voice } from '../../test/speech'

const entry = {
  id: 7,
  term: 'overwhelmed',
  type: 'WORD',
  phonetic: null,
  partOfSpeech: 'adjective',
  definition: 'Feeling unable to cope.',
  examples: null,
  collocations: null,
  senses: [],
  enrichmentStatus: 'COMPLETED',
  learningStatus: 'NEW',
  createdAt: '2026-10-20T12:00:00Z',
}

beforeEach(() => {
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

test('each word in the vocabulary list has its own play button outside the link to its page', async () => {
  const speech = installSpeechSynthesis([voice('Samantha', 'en-US')])
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary': () =>
      jsonResponse({
        content: [entry, { ...entry, id: 8, term: 'figure out' }],
        page: 0,
        size: 20,
        totalElements: 2,
        totalPages: 1,
      }),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary')
  const rows = await screen.findAllByRole('listitem')
  const button = within(rows[1]).getByRole('button', { name: 'Play pronunciation of figure out' })
  expect(button.closest('a')).toBeNull()
  await browserUser.click(button)

  expect(speech.lastUtterance()).toMatchObject({ text: 'figure out', lang: 'en-US' })
  expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', '/app/vocabulary/7')
})

test('the list shows no play buttons on a browser without speech support', async () => {
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary': () =>
      jsonResponse({ content: [entry], page: 0, size: 20, totalElements: 1, totalPages: 1 }),
  })

  renderApp('/app/vocabulary')

  expect(await screen.findByText('overwhelmed')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Play pronunciation/ })).not.toBeInTheDocument()
})

test('the detail page can play the word and explains when only a non-American voice exists', async () => {
  const speech = installSpeechSynthesis([voice('Daniel', 'en-GB')])
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary/7': () => jsonResponse(entry),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary/7')
  await browserUser.click(await screen.findByRole('button', { name: 'Play pronunciation of overwhelmed' }))

  expect(speech.lastUtterance()).toMatchObject({ text: 'overwhelmed', lang: 'en-GB' })
  expect(
    screen.getByText('No American English voice was found on this device, so another English voice is used.'),
  ).toBeInTheDocument()
})

test('the detail page shows no accent warning when an American voice exists', async () => {
  installSpeechSynthesis([voice('Samantha', 'en-US')])
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary/7': () => jsonResponse(entry),
  })

  renderApp('/app/vocabulary/7')

  expect(await screen.findByRole('button', { name: 'Play pronunciation of overwhelmed' })).toBeInTheDocument()
  expect(screen.queryByText(/No American English voice/)).not.toBeInTheDocument()
})

test('the word being studied can be played before the answer is shown', async () => {
  const speech = installSpeechSynthesis([voice('Samantha', 'en-US')])
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/learning/study-queue': () =>
      jsonResponse({
        ...emptyStudyQueue,
        newCount: 1,
        nextCard: {
          userVocabularyId: 11,
          term: 'overwhelmed',
          type: 'WORD',
          phonetic: null,
          partOfSpeech: null,
          definition: 'A definition.',
          examples: [],
          collocations: [],
          senses: [],
          state: 'NEW',
          version: 0,
          options: [],
        },
      }),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Play pronunciation of overwhelmed' }))

  expect(speech.lastUtterance()).toMatchObject({ text: 'overwhelmed' })
  expect(screen.getByRole('button', { name: 'Show answer' })).toBeInTheDocument()
})
