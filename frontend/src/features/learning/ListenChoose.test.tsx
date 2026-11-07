import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { installSpeechSynthesis, voice } from '../../test/speech'
import { emptyStudyQueue, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'

beforeEach(() => {
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

const words = ['cope', 'budget', 'tenant', 'deposit', 'rent']

function entry(id: number, term: string) {
  return {
    id,
    term,
    type: 'WORD',
    phonetic: null,
    partOfSpeech: null,
    definition: null,
    examples: null,
    collocations: null,
    senses: [{ partOfSpeech: null, label: null, phonetic: null, definition: `Number ${id} means ${term}.`, examples: null, collocations: null }],
    baseForm: null,
    spellingSuggestion: null,
    enrichmentStatus: 'COMPLETED',
    failureReason: null,
    learningStatus: 'LEARNING',
    createdAt: '2026-11-01T00:00:00Z',
  }
}

function routes(count = 5) {
  const studied = words.slice(0, count).map((term, index) => ({ userVocabularyId: index + 1, term, learningStatus: 'LEARNING' }))
  return {
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/reading/today': () => jsonResponse({ passageId: null }),
    'GET /api/v1/learning/game-words': () => jsonResponse({ date: '2026-11-01', wordIds: studied.map((word) => word.userVocabularyId) }),
    'POST /api/v1/learning/game-words/played': () => new Response(null, { status: 204 }),
    'GET /api/v1/learning/study-queue': () => jsonResponse({ ...emptyStudyQueue, finished: true, studiedCount: count, studiedToday: studied }),
    ...Object.fromEntries(words.map((term, index) => [`GET /api/v1/vocabulary/${index + 1}`, () => jsonResponse(entry(index + 1, term))])),
  }
}

test('the study-complete page offers the exercise only with a voice and five words studied', async () => {
  stubApi(routes(5))
  renderApp('/app/study')
  await screen.findByRole('heading', { name: 'Today’s study is complete' })
  expect(screen.queryByRole('link', { name: 'Listen and choose' })).not.toBeInTheDocument()
  cleanup()

  installSpeechSynthesis([voice('Samantha', 'en-US')])
  stubApi(routes(4))
  renderApp('/app/study')
  await screen.findByRole('heading', { name: 'Today’s study is complete' })
  expect(screen.queryByRole('link', { name: 'Listen and choose' })).not.toBeInTheDocument()
  cleanup()

  stubApi(routes(5))
  renderApp('/app/study')
  expect(await screen.findByRole('link', { name: 'Listen and choose' })).toHaveAttribute('href', '/app/study/listen')
})

test('on a device that cannot speak it says so', async () => {
  stubApi(routes())
  renderApp('/app/study/listen')

  expect(await screen.findByText(/cannot read words aloud/)).toBeInTheDocument()
})

test('says each word aloud after a press, takes a pick, shows the word, and sums up with the reaction time', async () => {
  const speech = installSpeechSynthesis([voice('Samantha', 'en-US')])
  stubApi(routes())
  const browserUser = userEvent.setup()
  renderApp('/app/study/listen')

  await browserUser.click(await screen.findByRole('button', { name: 'Start' }))
  expect(speech.spoken).toHaveLength(1)

  for (let question = 1; question <= 5; question += 1) {
    await screen.findByRole('region', { name: `Question ${question} of 5` })
    const heard = speech.lastUtterance().text
    const id = words.indexOf(heard) + 1
    const meanings = within(screen.getByRole('group', { name: 'Meanings' }))
    const options = meanings.getAllByRole('button')
    expect(options).toHaveLength(4)
    // Each meaning has its own word hidden, so the word is not given away before the answer.
    expect(screen.queryByText(new RegExp(`“${heard}”`))).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Progress' })).toHaveAttribute('aria-valuenow', String(question - 1))
    // Two right answers in a row show a streak, here on the fourth question (the first was wrong).
    if (question === 4) {
      expect(screen.getByLabelText('2 in a row')).toBeInTheDocument()
    }

    const right = meanings.getByRole('button', { name: `Number ${id} means _____.` })
    // The first question is answered wrongly on purpose.
    await browserUser.click(question === 1 ? options.find((option) => option !== right)! : right)
    expect(screen.getByRole('status')).toHaveTextContent(`${question === 1 ? 'Not quite.' : 'Correct!'} The word was “${heard}”.`)
    // The score moves as soon as the answer is given: nothing for the wrong first one, then 1, 2, 3, 4.
    expect(screen.getByLabelText(`${question - 1} right so far`)).toBeInTheDocument()
    await browserUser.click(screen.getByRole('button', { name: question === 5 ? 'See results' : 'Next' }))
  }

  expect(screen.getByRole('heading', { name: 'Nicely done! 4 of 5 right' })).toBeInTheDocument()
  expect(screen.getByText(/Worth another look: /)).toBeInTheDocument()
  expect(screen.getByText(/seconds on average/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
})
