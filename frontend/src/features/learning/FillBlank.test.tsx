import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
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

const words = [
  { id: 1, term: 'cope', example: 'I can cope with the cold.' },
  { id: 2, term: 'budget', example: 'Our budget is tight.' },
  { id: 3, term: 'tenant', example: 'The tenant paid the rent.' },
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
    senses: [{ partOfSpeech: null, label: null, phonetic: null, definition: `Meaning of ${word.term}.`, examples: [word.example], collocations: null, emoji: '🧊' }],
    baseForm: null,
    spellingSuggestion: null,
    enrichmentStatus: 'COMPLETED',
    failureReason: null,
    learningStatus: 'LEARNING',
    createdAt: '2026-11-01T00:00:00Z',
  }
}

function routes(count = 3) {
  const studied = words.slice(0, count).map((word) => ({ userVocabularyId: word.id, term: word.term, learningStatus: 'LEARNING' }))
  return {
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/reading/today': () => jsonResponse({ passageId: null }),
    'GET /api/v1/learning/study-queue': () => jsonResponse({ ...emptyStudyQueue, finished: true, studiedCount: count, studiedToday: studied }),
    ...Object.fromEntries(words.map((word) => [`GET /api/v1/vocabulary/${word.id}`, () => jsonResponse(entry(word))])),
  }
}

test('the study-complete page offers the exercise once three words were studied', async () => {
  stubApi(routes(2))
  renderApp('/app/study')
  await screen.findByRole('heading', { name: 'Today’s study is complete' })
  expect(screen.queryByRole('link', { name: 'Fill in the blank' })).not.toBeInTheDocument()
  cleanup()

  stubApi(routes(3))
  renderApp('/app/study')
  expect(await screen.findByRole('link', { name: 'Fill in the blank' })).toHaveAttribute('href', '/app/study/fill')
})

test('with too few words studied it says so', async () => {
  stubApi(routes(2))
  renderApp('/app/study/fill')

  expect(await screen.findByText(/Study at least 3 words today/)).toBeInTheDocument()
})

test('asks for each word in a sentence, marks the answer, and ends with the words to look at again', async () => {
  stubApi(routes(3))
  const browserUser = userEvent.setup()
  renderApp('/app/study/fill')
  await screen.findByRole('heading', { name: 'Fill in the blank' })

  const missed: string[] = []
  for (let question = 1; question <= 3; question += 1) {
    const region = await screen.findByRole('region', { name: `Question ${question} of 3` })
    const sentence = region.querySelectorAll('p')[0].textContent ?? ''
    const word = words.find((candidate) => sentence.includes(candidate.example.split(candidate.term)[0]))!
    // The first word is answered wrongly on purpose.
    if (question === 1) {
      missed.push(word.term)
      await browserUser.type(screen.getByLabelText('Your answer'), 'wrong')
      await browserUser.click(screen.getByRole('button', { name: 'Check' }))
      expect(screen.getByRole('status')).toHaveTextContent(`Not quite. The word is “${word.term}”.`)
    } else {
      await browserUser.type(screen.getByLabelText('Your answer'), `${word.term.toUpperCase()}{Enter}`)
      expect(screen.getByRole('status')).toHaveTextContent('Correct!')
    }
    await browserUser.click(screen.getByRole('button', { name: question === 3 ? 'See results' : 'Next' }))
  }

  expect(screen.getByRole('heading', { name: 'Nicely done! 2 of 3 right' })).toBeInTheDocument()
  expect(screen.getByText(`Worth another look: ${missed[0]}.`)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
})
