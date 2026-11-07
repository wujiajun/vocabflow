import { cleanup, waitFor, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { installSpeechSynthesis, voice } from '../../test/speech'
import { emptyStudyQueue, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'

const rounds: unknown[] = []

beforeEach(() => {
  rounds.length = 0
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

const words = [
  { id: 1, term: 'cope', example: 'I can cope with the cold.', start: /^I can _____ with the cold\./ },
  { id: 2, term: 'budget', example: 'Our budget is tight.', start: /^Our _____ is tight\./ },
  { id: 3, term: 'tenant', example: 'The tenant paid the rent.', start: /^The _____ paid the rent\./ },
  { id: 4, term: 'deposit', example: 'She made a deposit today.', start: /^She made a _____ today\./ },
  { id: 5, term: 'rent', example: 'We rent a small flat.', start: /^We _____ a small flat\./ },
]

function entry(word: (typeof words)[number]) {
  return {
    id: word.id,
    term: word.term,
    type: 'WORD',
    phonetic: null,
    partOfSpeech: null,
    definition: null,
    examples: null,
    collocations: null,
    senses: [{ partOfSpeech: null, label: null, phonetic: null, definition: `Number ${word.id} means ${word.term}.`, examples: [word.example], collocations: null, emoji: '🧊' }],
    baseForm: null,
    spellingSuggestion: null,
    enrichmentStatus: 'COMPLETED',
    failureReason: null,
    learningStatus: 'LEARNING',
    createdAt: '2026-11-01T00:00:00Z',
  }
}

function routes(count = 5) {
  const studied = words.slice(0, count).map((word) => ({ userVocabularyId: word.id, term: word.term, learningStatus: 'LEARNING' }))
  return {
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/reading/today': () => jsonResponse({ passageId: null }),
    'GET /api/v1/learning/game-words': () => jsonResponse({ date: '2026-11-01', wordIds: studied.map((word) => word.userVocabularyId) }),
    'POST /api/v1/learning/game-words/played': () => new Response(null, { status: 204 }),
    'POST /api/v1/learning/game-rounds': ({ init }: { init: RequestInit }) => {
      rounds.push(JSON.parse((init as RequestInit).body as string))
      return jsonResponse({ id: 1 })
    },
    'GET /api/v1/learning/study-queue': () => jsonResponse({ ...emptyStudyQueue, finished: true, studiedCount: count, studiedToday: studied }),
    ...Object.fromEntries(words.map((word) => [`GET /api/v1/vocabulary/${word.id}`, () => jsonResponse(entry(word))])),
  }
}

test('the study-complete page offers the exercise only with a voice and five words studied', async () => {
  stubApi(routes(5))
  renderApp('/app/study')
  await screen.findByRole('heading', { name: 'Today’s study is complete' })
  expect(screen.queryByRole('link', { name: 'Fill in the blank' })).not.toBeInTheDocument()
  cleanup()

  installSpeechSynthesis([voice('Samantha', 'en-US')])
  stubApi(routes(4))
  renderApp('/app/study')
  await screen.findByRole('heading', { name: 'Today’s study is complete' })
  expect(screen.queryByRole('link', { name: 'Fill in the blank' })).not.toBeInTheDocument()
  cleanup()

  stubApi(routes(5))
  renderApp('/app/study')
  const link = await screen.findByRole('link', { name: 'Fill in the blank' })
  expect(link).toHaveAttribute('href', '/app/study/fill')
  // The games are a menu of tiles: each says in a line what it is.
  expect(link).toHaveAccessibleDescription('Drop the right sound into the blank')
  expect(screen.getByRole('heading', { name: 'Play a game' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Listen and choose' })).toHaveAccessibleDescription('Hear a word, pick its meaning')
})

test('on a device that cannot speak it says so', async () => {
  stubApi(routes())
  renderApp('/app/study/fill')

  expect(await screen.findByText(/cannot read words aloud/)).toBeInTheDocument()
})

test('opens on a start screen with its icon, and Start begins the first round', async () => {
  installSpeechSynthesis([voice('Samantha', 'en-US')])
  stubApi(routes())
  const browserUser = userEvent.setup()
  renderApp('/app/study/fill')

  expect(await screen.findByRole('heading', { name: 'Ready to fill in the blanks?' })).toBeInTheDocument()
  expect(screen.getByText(/No word is shown until you place it/)).toBeInTheDocument()
  await browserUser.click(screen.getByRole('button', { name: 'Start' }))
  expect(await screen.findByRole('heading', { name: 'Round 1 of 1' })).toBeInTheDocument()
  expect(screen.getByLabelText('0 right on the first try')).toBeInTheDocument()
})

test('sounds are tapped to be heard, never show their word, and are placed on the sentence they fit', async () => {
  const speech = installSpeechSynthesis([voice('Samantha', 'en-US')])
  stubApi(routes())
  const browserUser = userEvent.setup()
  renderApp('/app/study/fill')

  await startGame()
  expect(await screen.findByRole('heading', { name: 'Round 1 of 1' })).toBeInTheDocument()
  const tray = () => screen.getByRole('group', { name: 'Sounds' })
  // The chips carry a number and nothing that gives the word away.
  expect(within(tray()).getAllByRole('button').map((chip) => chip.getAttribute('aria-label'))).toEqual(
    expect.arrayContaining(['Play sound 1', 'Play sound 2', 'Play sound 3', 'Play sound 4', 'Play sound 5']),
  )
  for (const word of words) {
    expect(within(tray()).queryByText(word.term)).not.toBeInTheDocument()
  }
  expect(screen.getByRole('list', { name: 'Sentences' })).toHaveTextContent('Number 1 means _____.')

  // The first sound is tried on the wrong sentence, so its word is missed.
  await browserUser.click(within(tray()).getAllByRole('button')[0])
  const missedTerm = speech.lastUtterance().text
  expect(words.map((word) => word.term)).toContain(missedTerm)
  const wrongWord = words.find((word) => word.term !== missedTerm)!
  await browserUser.click(screen.getByRole('button', { name: wrongWord.start }))
  expect(screen.getByRole('status')).toHaveTextContent('Not that one. Try another sound.')

  while (within(tray()).queryAllByRole('button').length > 0) {
    await browserUser.click(within(tray()).getAllByRole('button')[0])
    const heard = words.find((word) => word.term === speech.lastUtterance().text)!
    await browserUser.click(screen.getByRole('button', { name: heard.start }))
    expect(screen.getByRole('status')).toHaveTextContent(`Correct: ${heard.term}.`)
    if (screen.queryByRole('heading', { name: /All matched/ })) {
      break
    }
  }

  expect(screen.getByRole('heading', { name: 'All matched!' })).toBeInTheDocument()
  // A placed sound shows its word and the sentence with the word in it.
  expect(screen.getByText('I can cope with the cold.')).toBeInTheDocument()

  await browserUser.click(screen.getByRole('button', { name: 'See results' }))
  expect(screen.getByRole('heading', { name: /4 of 5 on the first try/ })).toBeInTheDocument()
  expect(screen.getByText(`Worth another look: ${missedTerm}.`)).toBeInTheDocument()

  // The finished round was sent once, with the stars the results show.
  await waitFor(() => expect(rounds).toHaveLength(1))
  expect(rounds[0]).toEqual({ game: 'fill-blank', stars: 2, mistakes: 1, wordCount: 5, date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
})

// Every game opens on its start screen, which is also the press that lets a voice begin.
async function startGame() {
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Start' }))
}
