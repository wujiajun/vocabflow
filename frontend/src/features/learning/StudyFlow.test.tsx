import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { toLocalDateString } from '../../shared/date'
import { errorResponse, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user, wholeText } from '../../test/utils'
import { formatInterval } from './components/formatInterval'
import type { StudyCard, StudyQueue } from './types/study'

beforeEach(() => {
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

test('tapping a word on the answer offers to add it and leaves the card as it was', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ nextCard: card() })) })
  const browserUser = userEvent.setup()
  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Show answer' }))

  await browserUser.click(screen.getByText('cope'))

  expect(screen.getByRole('textbox', { name: 'Add a word or phrase' })).toHaveValue('cope')
  expect(screen.getByRole('group', { name: /remember/ })).toBeInTheDocument()
  await browserUser.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'overwhelmed' })).toBeInTheDocument()
})

test('hides the answer until asked, then shows it with what each rating would do', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ nextCard: card() })) })
  const browserUser = userEvent.setup()

  renderApp('/app/study')

  expect(await screen.findByRole('heading', { name: 'overwhelmed' })).toBeInTheDocument()
  expect(document.title).toBe('Study · VocabFlow')
  expect(screen.getByRole('img', { name: '0 studied, 0 learning, 1 not started, 1 in total' })).toBeInTheDocument()
  expect(screen.queryByText(wholeText('Feeling unable to cope.'))).not.toBeInTheDocument()
  expect(screen.queryByText(/\/ˌoʊ/)).not.toBeInTheDocument()
  expect(screen.queryByRole('group', { name: /remember/ })).not.toBeInTheDocument()

  await browserUser.click(screen.getByRole('button', { name: 'Show answer' }))

  expect(screen.getByText(wholeText('Feeling unable to cope.'))).toBeInTheDocument()
  expect(screen.getByText(/\/ˌoʊvərˈwelmd\//)).toBeInTheDocument()
  expect(screen.getByText(wholeText('I felt overwhelmed.'))).toBeInTheDocument()
  expect(screen.getByText('feel overwhelmed')).toBeInTheDocument()
  expect(screen.getByText(wholeText('Feeling unable to cope.')).closest('[tabindex="-1"]')).toHaveFocus()
  const ratings = within(screen.getByRole('group', { name: /remember/ })).getAllByRole('button')
  expect(ratings.map((button) => button.textContent)).toEqual(['Again1 min', 'Hard1 min', 'Good10 min', 'Easy4 days'])
})

test('a card for an inflected word says which word the meaning belongs to, once the answer is shown', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ nextCard: card({ term: 'leases', baseForm: 'lease' }) })),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await screen.findByRole('heading', { name: 'leases' })
  expect(screen.queryByText(/Form of/)).not.toBeInTheDocument()
  await browserUser.click(screen.getByRole('button', { name: 'Show answer' }))

  expect(screen.getByText(/Form of/)).toHaveTextContent('Form of lease')
})

test('a card with several meanings offers them as tabs, says how many, and starts hidden again', async () => {
  const resume = card({
    term: 'resume',
    senses: [
      { partOfSpeech: 'noun', label: 'document', phonetic: '/ˈrezəmeɪ/', definition: 'A work history.', examples: ['Send it.'], collocations: [] },
      { partOfSpeech: 'verb', label: 'start again', phonetic: '/rɪˈzuːm/', definition: 'To begin again.', examples: ['We resume soon.'], collocations: [] },
    ],
  })
  stubApi({ ...signedIn(), 'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ nextCard: resume })) })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Show answer' }))

  expect(screen.getByText('2 meanings')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'noun · document' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByText(wholeText('A work history.'))).toBeInTheDocument()
  await browserUser.click(screen.getByRole('tab', { name: 'verb · start again' }))
  expect(screen.getByText(wholeText('To begin again.'))).toBeInTheDocument()
  expect(screen.getByText('/rɪˈzuːm/')).toBeInTheDocument()
  expect(screen.queryByText(wholeText('A work history.'))).not.toBeInTheDocument()
})

test('sends the rating with the card’s version and today’s date, then moves on to the next card', async () => {
  const fetchMock = stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ nextCard: card() })),
    'POST /api/v1/learning/cards/7/reviews': () =>
      jsonResponse(queue({ nextCard: card({ userVocabularyId: 8, term: 'figure out' }) })),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Show answer' }))
  await browserUser.click(screen.getByRole('button', { name: /^Good/ }))

  const nextTerm = await screen.findByRole('heading', { name: 'figure out' })
  expect(nextTerm).toHaveFocus()
  expect(screen.getByRole('button', { name: 'Show answer' })).toBeInTheDocument()
  const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
  expect(JSON.parse(post?.[1]?.body as string)).toEqual({ rating: 'GOOD', version: 3, date: toLocalDateString(new Date()) })
})

test('hides the answer again when the same card comes back', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ nextCard: card() })),
    'POST /api/v1/learning/cards/7/reviews': () => jsonResponse(queue({ nextCard: card({ version: 4 }) })),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Show answer' }))
  await browserUser.click(screen.getByRole('button', { name: /^Again/ }))

  expect(await screen.findByRole('button', { name: 'Show answer' })).toBeInTheDocument()
  expect(screen.queryByText(wholeText('Feeling unable to cope.'))).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'overwhelmed' })).toHaveFocus()
})

test('says when studying is finished and moves focus there', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ nextCard: card() })),
    'POST /api/v1/learning/cards/7/reviews': () => jsonResponse(queue({ newCount: 0, finished: true })),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Show answer' }))
  await browserUser.click(screen.getByRole('button', { name: /^Easy/ }))

  expect(await screen.findByRole('heading', { name: 'Today’s study is complete' })).toHaveFocus()
  expect(screen.getByRole('link', { name: 'Add new words' })).toBeInTheDocument()
})

test('with nothing to study from the start, does not take focus', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ newCount: 0 })) })

  renderApp('/app/study')

  expect(await screen.findByRole('heading', { name: 'Nothing to study yet' })).not.toHaveFocus()
})

test('says when a later learning step comes back, and counts words still waiting for details', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () =>
      jsonResponse(queue({ newCount: 0, unavailableCount: 2, nextDueAt: '2026-11-01T18:30:00Z' })),
  })

  renderApp('/app/study')

  expect(await screen.findByText(/The next card comes back at/)).toBeInTheDocument()
  expect(screen.getByText('2 words aren’t ready to study yet.')).toBeInTheDocument()
})

test('keeps the card and explains when a rating cannot be saved', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ nextCard: card() })),
    'POST /api/v1/learning/cards/7/reviews': () => errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred'),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Show answer' }))
  await browserUser.click(screen.getByRole('button', { name: /^Hard/ }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
  expect(screen.getByRole('button', { name: /^Hard/ })).toHaveFocus()
})

test('moves on without an error when another tab already reviewed the card', async () => {
  let refused = false
  let finishRefetch: () => void = () => undefined
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': async () => {
      if (!refused) {
        return jsonResponse(queue({ nextCard: card() }))
      }
      await new Promise<void>((resolve) => {
        finishRefetch = resolve
      })
      return jsonResponse(queue({ nextCard: card({ userVocabularyId: 8, term: 'figure out' }) }))
    },
    'POST /api/v1/learning/cards/7/reviews': () => {
      refused = true
      return errorResponse(409, 'CONFLICT', 'This card has already been reviewed')
    },
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Show answer' }))
  await browserUser.click(screen.getByRole('button', { name: /^Good/ }))

  // While the current card is being read again, no error flashes up.
  await waitFor(() => expect(refused).toBe(true))
  await new Promise((resolve) => setTimeout(resolve, 30))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  finishRefetch()

  expect(await screen.findByRole('heading', { name: 'figure out' })).toHaveFocus()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('ignores a second rating while the first is being saved', async () => {
  let posts = 0
  let release: () => void = () => undefined
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ nextCard: card() })),
    'POST /api/v1/learning/cards/7/reviews': async () => {
      posts += 1
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return jsonResponse(queue({ newCount: 0, finished: true }))
    },
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Show answer' }))
  await browserUser.click(screen.getByRole('button', { name: /^Good/ }))
  await waitFor(() => expect(posts).toBe(1))
  await browserUser.click(screen.getByRole('button', { name: /^Easy/ }))
  release()

  await screen.findByRole('heading', { name: 'Today’s study is complete' })
  expect(posts).toBe(1)
})

test('offers a retry when the queue cannot be loaded', async () => {
  let attempts = 0
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => {
      attempts += 1
      return attempts === 1
        ? errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred')
        : jsonResponse(queue({ nextCard: card() }))
    },
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Try again' }))

  expect(await screen.findByRole('heading', { name: 'overwhelmed' })).toBeInTheDocument()
})

test('opening the app goes straight to studying, and old links to Today land there too', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ nextCard: card() })) })

  const { unmount } = renderApp('/app')
  expect(await screen.findByRole('heading', { name: 'overwhelmed' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Study' })).toHaveAttribute('aria-current', 'page')
  expect(screen.queryByRole('link', { name: 'Today' })).not.toBeInTheDocument()
  unmount()

  renderApp('/app/today')
  expect(await screen.findByRole('heading', { name: 'overwhelmed' })).toBeInTheDocument()
  cleanup()

  renderApp('/app/somewhere-else')
  expect(await screen.findByRole('heading', { name: 'overwhelmed' })).toBeInTheDocument()
})

test('shows the three groups as a bar in proportion, with their counts and the total', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () =>
      jsonResponse(queue({ studiedCount: 2, stillLearningCount: 8, notStartedCount: 10, nextCard: card() })),
  })

  renderApp('/app/study')

  const bar = await screen.findByRole('img', { name: '2 studied, 8 learning, 10 not started, 20 in total' })
  expect(bar).toHaveAttribute('viewBox', '0 0 20 1')
  const segments = [...bar.querySelectorAll('rect')].map((rect) => [rect.getAttribute('x'), rect.getAttribute('width')])
  expect(segments).toEqual([
    ['0', '2'],
    ['2', '8'],
    ['10', '10'],
  ])
  const legend = screen.getByRole('region', { name: 'Study progress' })
  expect(legend).toHaveTextContent('Studied 2')
  expect(legend).toHaveTextContent('Learning 8')
  expect(legend).toHaveTextContent('Not started 10')
  expect(legend).toHaveTextContent('Total 20')
})

test('shows no bar when this study holds no words', async () => {
  stubApi({ ...signedIn(), 'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ notStartedCount: 0 })) })

  renderApp('/app/study')

  await screen.findByRole('heading', { name: 'Nothing to study yet' })
  expect(screen.queryByRole('region', { name: 'Study progress' })).not.toBeInTheDocument()
})

test('suggests adding words when the library falls short of the goal, but not when more can be studied', async () => {
  let more = false
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () =>
      jsonResponse(queue({ finished: true, newCount: 0, goalShortfall: 8, moreNewWords: more })),
  })

  const first = renderApp('/app/study')
  expect(await screen.findByText('Add 8 more words to reach today’s goal.')).toBeInTheDocument()
  first.unmount()

  more = true
  renderApp('/app/study')
  await screen.findByRole('button', { name: 'Study more new words' })
  expect(screen.queryByText(/to reach today’s goal/)).not.toBeInTheDocument()
})

test('the finished day lists what was studied and links each word to its page and back', async () => {
  const finished = queue({
    finished: true,
    newCount: 0,
    studiedCount: 1,
    notStartedCount: 0,
    studiedToday: [{ userVocabularyId: 7, term: 'overwhelmed', learningStatus: 'FAMILIAR' }],
  })
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(finished),
    'GET /api/v1/vocabulary/7': () =>
      jsonResponse({ id: 7, term: 'overwhelmed', senses: [], enrichmentStatus: 'COMPLETED', learningStatus: 'FAMILIAR', createdAt: '2026-10-20T12:00:00Z' }),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')

  expect(await screen.findByRole('heading', { name: 'Today’s study is complete' })).toBeInTheDocument()
  const studied = screen.getByRole('region', { name: 'Studied today' })
  expect(within(studied).getByRole('listitem')).toHaveTextContent('overwhelmedFamiliar')
  expect(screen.queryByRole('button', { name: 'Study more new words' })).not.toBeInTheDocument()

  await browserUser.click(within(studied).getByRole('link', { name: 'overwhelmed' }))
  await browserUser.click(await screen.findByRole('link', { name: '← Back to study' }))
  expect(await screen.findByRole('heading', { name: 'Today’s study is complete' })).toBeInTheDocument()
})

test('another batch starts from the finished page and moves focus to its first card', async () => {
  const fetchMock = stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ finished: true, moreNewWords: true, newCount: 0 })),
    'POST /api/v1/learning/study-queue/more': () => jsonResponse(queue({ nextCard: card({ term: 'figure out' }) })),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Study more new words' }))

  expect(await screen.findByRole('heading', { name: 'figure out' })).toHaveFocus()
  const post = fetchMock.mock.calls.find(([path]) => path === '/api/v1/learning/study-queue/more')
  expect(JSON.parse(post?.[1]?.body as string)).toEqual({ date: toLocalDateString(new Date()) })
})

test('ignores a second press while another batch is starting', async () => {
  let posts = 0
  let release: () => void = () => undefined
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ finished: true, moreNewWords: true, newCount: 0 })),
    'POST /api/v1/learning/study-queue/more': async () => {
      posts += 1
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return jsonResponse(queue({ nextCard: card() }))
    },
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Study more new words' }))
  await waitFor(() => expect(posts).toBe(1))
  await browserUser.click(screen.getByRole('button', { name: 'Adding words…' }))
  release()

  await screen.findByRole('heading', { name: 'overwhelmed' })
  expect(posts).toBe(1)
})

test('keeps the finished page and focus on the button when another batch cannot start', async () => {
  stubApi({
    ...signedIn(),
    'GET /api/v1/learning/study-queue': () => jsonResponse(queue({ finished: true, moreNewWords: true, newCount: 0 })),
    'POST /api/v1/learning/study-queue/more': () => errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred'),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('button', { name: 'Study more new words' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
  expect(screen.getByRole('button', { name: 'Study more new words' })).toHaveFocus()
})

test('asks for the local calendar date, not the UTC date', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 29, 23, 30))
  const fetchMock = stubApi({ ...signedIn(), 'GET /api/v1/learning/study-queue': () => jsonResponse(queue()) })

  renderApp('/app/study')

  await screen.findByRole('heading', { name: 'Study' })
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/learning/study-queue?date=2026-10-29', expect.anything())
})

test('moves on to the next day when the page is left open past midnight', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 29, 23, 59, 30))
  const fetchMock = stubApi({ ...signedIn(), 'GET /api/v1/learning/study-queue': () => jsonResponse(queue()) })

  renderApp('/app/study')
  await screen.findByRole('heading', { name: 'Study' })

  vi.setSystemTime(new Date(2026, 9, 30, 0, 0, 30))
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })

  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/learning/study-queue?date=2026-10-30', expect.anything()),
  )
})

test.each([
  [{ intervalMinutes: 1, intervalDays: null }, '1 min'],
  [{ intervalMinutes: null, intervalDays: 1 }, '1 day'],
  [{ intervalMinutes: null, intervalDays: 29 }, '29 days'],
  [{ intervalMinutes: null, intervalDays: 60 }, '2 mo'],
  [{ intervalMinutes: null, intervalDays: 730 }, '2.0 yr'],
])('formats %j as %s', (option, text) => {
  expect(formatInterval({ rating: 'GOOD', ...option })).toBe(text)
})

function signedIn() {
  return { 'GET /api/v1/auth/me': () => jsonResponse(user) }
}

function queue(overrides: Partial<StudyQueue> = {}): StudyQueue {
  return {
    date: '2026-11-01',
    learningCount: 0,
    reviewCount: 0,
    newCount: 1,
    unavailableCount: 0,
    nextCard: null,
    nextDueAt: null,
    studiedCount: 0,
    stillLearningCount: 0,
    notStartedCount: overrides.newCount ?? 1,
    newTargetCount: 10,
    goalShortfall: 0,
    finished: false,
    moreNewWords: false,
    studiedToday: [],
    ...overrides,
  }
}

function card(overrides: Partial<StudyCard> = {}): StudyCard {
  return {
    userVocabularyId: 7,
    term: 'overwhelmed',
    baseForm: null,
    type: 'WORD',
    phonetic: '/ˌoʊvərˈwelmd/',
    partOfSpeech: 'adjective',
    definition: 'Feeling unable to cope.',
    examples: ['I felt overwhelmed.'],
    collocations: ['feel overwhelmed'],
    senses: [
      {
        partOfSpeech: 'adjective',
        label: null,
        phonetic: '/ˌoʊvərˈwelmd/',
        definition: 'Feeling unable to cope.',
        examples: ['I felt overwhelmed.'],
        collocations: ['feel overwhelmed'],
      },
    ],
    state: 'NEW',
    version: 3,
    options: [
      { rating: 'AGAIN', intervalMinutes: 1, intervalDays: null },
      { rating: 'HARD', intervalMinutes: 1, intervalDays: null },
      { rating: 'GOOD', intervalMinutes: 10, intervalDays: null },
      { rating: 'EASY', intervalMinutes: null, intervalDays: 4 },
    ],
    ...overrides,
  }
}
