import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../shared/api/tokenStorage'
import { installSpeechSynthesis, voice } from '../test/speech'
import indexHtml from '../../index.html?raw'
import { expectNoAxeViolations } from '../test/axe'
import { errorResponse, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../test/utils'

const word = {
  id: 7,
  term: 'overwhelmed',
  type: 'WORD',
  phonetic: '/ˌoʊvərˈwelmd/',
  partOfSpeech: 'adjective',
  definition: 'Feeling unable to deal with a situation because there is too much to do.',
  examples: ['I felt overwhelmed during my first week at work.'],
  collocations: ['feel overwhelmed'],
  enrichmentStatus: 'COMPLETED',
  learningStatus: 'NEW',
  createdAt: '2026-10-20T12:00:00Z',
}
const pending = { ...word, id: 8, term: 'waiting', enrichmentStatus: 'PENDING' }
const vocabularyPage = { content: [word, pending], page: 0, size: 20, totalElements: 41, totalPages: 3 }
const plan = {
  date: '2026-10-30',
  newVocabularyGoal: 10,
  newItems: [{ userVocabularyId: 7, term: 'overwhelmed', type: 'WORD' }],
  reviewItems: [],
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

function signedInApi() {
  // Without a speech API the play buttons are not rendered at all, so they would go unscanned. A
  // non-American voice also shows the accent note on the detail page.
  installSpeechSynthesis([voice('Daniel', 'en-GB')])
  return stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary': () => jsonResponse(vocabularyPage),
    'GET /api/v1/vocabulary/7': () => jsonResponse(word),
    'GET /api/v1/learning/daily-plan': () => jsonResponse(plan),
    'POST /api/v1/vocabulary': () => errorResponse(409, 'CONFLICT', 'This vocabulary is already in your list'),
  })
}

// Automatic rules find only part of the accessibility problems (focus order, wording and what a
// screen reader actually says still need a person), but they catch missing names, bad ARIA and
// heading mistakes on every page for free.

test('the sign-in page has no axe violations, including with an error shown', async () => {
  clearToken()
  stubApi({ 'POST /api/v1/auth/login': () => errorResponse(401, 'UNAUTHORIZED', 'Invalid email or password') })
  const browserUser = userEvent.setup()

  renderApp('/login')
  await screen.findByRole('heading', { name: 'Welcome back' })
  await expectNoAxeViolations()

  await browserUser.type(screen.getByLabelText('Email'), user.email)
  await browserUser.type(screen.getByLabelText('Password'), 'wrong-password')
  await browserUser.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByRole('alert')
  await expectNoAxeViolations()
})

test('the registration page has no axe violations, including with an error shown', async () => {
  clearToken()
  stubApi({})
  const browserUser = userEvent.setup()

  renderApp('/register')
  await screen.findByRole('heading', { name: 'Create your account' })
  await expectNoAxeViolations()

  await browserUser.click(screen.getByRole('button', { name: 'Create account' }))
  await screen.findByRole('alert')
  await expectNoAxeViolations()
})

test('the vocabulary list has no axe violations, including with an add error shown', async () => {
  signedInApi()
  const browserUser = userEvent.setup()

  renderApp('/app/vocabulary')
  await screen.findByText('overwhelmed')
  await expectNoAxeViolations()

  await browserUser.type(screen.getByLabelText('New word or phrase'), 'overwhelmed')
  await browserUser.click(screen.getByRole('button', { name: 'Add' }))
  await screen.findByRole('alert')
  await expectNoAxeViolations()
})

test('the vocabulary detail page has no axe violations', async () => {
  signedInApi()

  renderApp('/app/vocabulary/7')
  await screen.findByRole('heading', { name: 'overwhelmed' })

  await expectNoAxeViolations()
})

test('today’s plan has no axe violations', async () => {
  signedInApi()

  renderApp('/app/today')
  await screen.findByRole('list', { name: 'New words' })

  await expectNoAxeViolations()
})

test('the page declares its language in index.html', () => {
  expect(indexHtml).toMatch(/<html[^>]*\slang="en"/)
})

test('a word that is still being enriched, and one that failed, have no axe violations', async () => {
  installSpeechSynthesis([voice('Samantha', 'en-US')])
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/vocabulary/8': () => jsonResponse(pending),
    'GET /api/v1/vocabulary/9': () =>
      jsonResponse({ ...word, id: 9, term: 'broken', enrichmentStatus: 'FAILED', failureReason: 'Enrichment could not be completed' }),
  })

  renderApp('/app/vocabulary/8')
  await screen.findByText(/Filling in the details/)
  await expectNoAxeViolations()
  cleanup()

  renderApp('/app/vocabulary/9')
  await screen.findByRole('button', { name: 'Retry details' })
  await expectNoAxeViolations()
})
