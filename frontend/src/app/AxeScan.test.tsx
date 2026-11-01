import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../shared/api/tokenStorage'
import { installSpeechSynthesis, voice } from '../test/speech'
import indexHtml from '../../index.html?raw'
import manifest from '../../public/manifest.webmanifest?raw'
import { expectNoAxeViolations } from '../test/axe'
import { emptyStudyQueue, errorResponse, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../test/utils'

const word = {
  id: 7,
  term: 'overwhelmed',
  type: 'WORD',
  phonetic: '/ˌoʊvərˈwelmd/',
  partOfSpeech: 'adjective',
  definition: 'Feeling unable to deal with a situation because there is too much to do.',
  examples: ['I felt overwhelmed during my first week at work.'],
  collocations: ['feel overwhelmed'],
  senses: [
    { partOfSpeech: 'adjective', label: 'too much', phonetic: '/ˌoʊvərˈwelmd/', definition: 'Feeling unable to cope.', examples: ['I felt overwhelmed.'], collocations: ['feel overwhelmed'] },
    { partOfSpeech: 'verb', label: 'defeated', phonetic: null, definition: 'Completely defeated.', examples: ['They were overwhelmed.'], collocations: [] },
  ],
  enrichmentStatus: 'COMPLETED',
  learningStatus: 'NEW',
  createdAt: '2026-10-20T12:00:00Z',
}
const pending = { ...word, id: 8, term: 'waiting', enrichmentStatus: 'PENDING' }
const vocabularyPage = { content: [word, pending], page: 0, size: 20, totalElements: 41, totalPages: 3 }

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

test('the whole site belongs to the installed app, so no page opens outside it', () => {
  expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest" />')
  expect(JSON.parse(manifest)).toMatchObject({ scope: '/', start_url: '/', display: 'standalone' })
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

test('the study page has no axe violations, before and after revealing the answer and when finished', async () => {
  installSpeechSynthesis([voice('Samantha', 'en-US')])
  const option = (rating: string, intervalMinutes: number | null, intervalDays: number | null) => ({ rating, intervalMinutes, intervalDays })
  const nextCard = {
    userVocabularyId: 7,
    term: 'overwhelmed',
    type: 'WORD',
    phonetic: '/x/',
    partOfSpeech: 'adjective',
    definition: 'A definition.',
    examples: ['An example.'],
    collocations: ['a collocation'],
    senses: [
      { partOfSpeech: 'noun', label: 'first', phonetic: '/x/', definition: 'A definition.', examples: ['An example.'], collocations: ['a collocation'] },
      { partOfSpeech: 'verb', label: 'second', phonetic: null, definition: 'Another.', examples: [], collocations: [] },
    ],
    state: 'NEW',
    version: 0,
    options: [option('AGAIN', 1, null), option('HARD', 1, null), option('GOOD', 10, null), option('EASY', null, 4)],
  }
  const base = { ...emptyStudyQueue, newCount: 1, unavailableCount: 1, reviewCount: 1, studiedCount: 1, stillLearningCount: 1, notStartedCount: 2 }
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/learning/study-queue': () => jsonResponse({ ...base, nextCard }),
    'GET /api/v1/reading/today': () => jsonResponse({ passageId: null }),
    'POST /api/v1/learning/cards/7/reviews': () => jsonResponse({
        ...base,
        newCount: 0,
        reviewCount: 0,
        nextCard: null,
        finished: true,
        moreNewWords: true,
        studiedToday: [{ userVocabularyId: 7, term: 'overwhelmed', learningStatus: 'FAMILIAR' }],
      }),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await screen.findByRole('button', { name: 'Show answer' })
  await expectNoAxeViolations()

  await browserUser.click(screen.getByRole('button', { name: 'Show answer' }))
  await expectNoAxeViolations()

  await browserUser.click(screen.getByRole('button', { name: /^Good/ }))
  await screen.findByRole('heading', { name: 'Today’s study is complete' })
  await expectNoAxeViolations()
})

// Two full scans of a page with a few hundred time zone options: slow on a small CI machine.
test('the settings page has no axe violations, including with an error shown', async () => {
  stubApi({ 'GET /api/v1/auth/me': () => jsonResponse(user) })
  const browserUser = userEvent.setup()

  renderApp('/app/settings')
  const input = await screen.findByLabelText('Daily new vocabulary goal')
  await expectNoAxeViolations()

  await browserUser.clear(input)
  await browserUser.type(input, '0')
  await browserUser.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByRole('alert')
  await expectNoAxeViolations()
}, 20_000)
