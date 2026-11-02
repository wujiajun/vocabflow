import { cleanup, createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { expectNoAxeViolations } from '../../test/axe'
import { installSpeechSynthesis, voice } from '../../test/speech'
import { emptyStudyQueue, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'
import type { StudiedWord } from './types/study'

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
  { id: 1, term: 'cope', definition: 'To deal with something difficult.' },
  { id: 2, term: 'budget', definition: 'A plan for how to spend money.' },
  { id: 3, term: 'lease', definition: 'To rent a home for a fixed time, as in a lease.' },
  { id: 4, term: 'tenant', definition: 'A person who rents a home.' },
  { id: 5, term: 'deposit', definition: 'Money paid first to keep something.' },
]

function entry(word: { id: number; term: string; definition: string }) {
  return {
    id: word.id,
    term: word.term,
    type: 'WORD',
    phonetic: null,
    partOfSpeech: null,
    definition: word.definition,
    examples: null,
    collocations: null,
    senses: [{ partOfSpeech: null, label: null, phonetic: null, definition: word.definition, examples: null, collocations: null }],
    baseForm: null,
    spellingSuggestion: null,
    enrichmentStatus: 'COMPLETED',
    failureReason: null,
    learningStatus: 'LEARNING',
    createdAt: '2026-11-01T00:00:00Z',
  }
}

function studied(count: number): StudiedWord[] {
  return words.slice(0, count).map((word) => ({ userVocabularyId: word.id, term: word.term, learningStatus: 'LEARNING' }))
}

function routes(count = 5) {
  return {
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/reading/today': () => jsonResponse({ passageId: null }),
    'GET /api/v1/learning/study-queue': () =>
      jsonResponse({ ...emptyStudyQueue, finished: true, studiedCount: count, studiedToday: studied(count) }),
    ...Object.fromEntries(words.map((word) => [`GET /api/v1/vocabulary/${word.id}`, () => jsonResponse(entry(word))])),
  }
}

const meaning = (word: (typeof words)[number]) => new RegExp(`^${word.definition.replace('lease', '_____').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)

test('the study-complete page offers the game once five words were studied', async () => {
  stubApi(routes(4))
  renderApp('/app/study')
  await screen.findByRole('heading', { name: 'Today’s study is complete' })
  expect(screen.queryByRole('link', { name: 'Quick review game' })).not.toBeInTheDocument()
  cleanup()

  stubApi(routes(5))
  renderApp('/app/study')
  expect(await screen.findByRole('link', { name: 'Quick review game' })).toHaveAttribute('href', '/app/study/review')
})

test('with too few words studied the game says so', async () => {
  stubApi(routes(4))
  renderApp('/app/study/review')

  expect(await screen.findByText('Study at least 5 words today to play this game.')).toBeInTheDocument()
})

test('tapping a word and then its meaning places it, a wrong meaning shakes it back, and the results name the slips', async () => {
  stubApi(routes())
  const browserUser = userEvent.setup()
  renderApp('/app/study/review')

  expect(await screen.findByRole('heading', { name: 'Round 1 of 1' })).toBeInTheDocument()
  await expectNoAxeViolations()
  const tray = screen.getByRole('group', { name: 'Words' })

  // A wrong meaning first for "cope", which is then not counted as a first-try match.
  await browserUser.click(within(tray).getByRole('button', { name: 'cope' }))
  expect(within(tray).getByRole('button', { name: 'cope' })).toHaveAttribute('aria-pressed', 'true')
  await browserUser.click(screen.getByRole('button', { name: meaning(words[1]) }))
  expect(screen.getByRole('status')).toHaveTextContent('Not that one')
  expect(within(tray).getByRole('button', { name: 'cope' })).toHaveAttribute('aria-pressed', 'false')

  for (const word of words) {
    await browserUser.click(within(screen.getByRole('group', { name: 'Words' })).getByRole('button', { name: word.term }))
    await browserUser.click(screen.getByRole('button', { name: meaning(word) }))
  }

  expect(screen.getByRole('heading', { name: 'All matched!' })).toHaveFocus()
  // Placed words sit on their meanings, with the answer's own word blanked out where it was in it.
  expect(screen.getByText('To rent a home for a fixed time, as in a _____.')).toBeInTheDocument()

  await browserUser.click(screen.getByRole('button', { name: 'See results' }))
  expect(screen.getByRole('heading', { name: /4 of 5 on the first try/ })).toBeInTheDocument()
  expect(screen.getByText('Worth another look: cope.')).toBeInTheDocument()

  await browserUser.click(screen.getByRole('button', { name: 'Play again' }))
  expect(await screen.findByRole('heading', { name: 'Round 1 of 1' })).toBeInTheDocument()
})

// Stands in for the browser's audio, which jsdom does not have: counts the sounds started.
function installAudio() {
  const started: number[] = []
  class FakeAudioContext {
    currentTime = 0
    state = 'running'
    destination = {}
    resume = vi.fn()
    createOscillator() {
      return {
        type: '',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: () => started.push(1),
        stop: vi.fn(),
      }
    }
    createGain() {
      return { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() }
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext)
  return started
}

test('a right match says the word aloud; a wrong one turns the meaning and the word red and buzzes, until the sound is switched off', async () => {
  const speech = installSpeechSynthesis([voice('Samantha', 'en-US')])
  const buzzes = installAudio()
  window.localStorage.removeItem('vocabflow.gameSound')
  stubApi(routes())
  const browserUser = userEvent.setup()
  renderApp('/app/study/review')
  await screen.findByRole('heading', { name: 'Round 1 of 1' })
  const chip = (term: string) => within(screen.getByRole('group', { name: 'Words' })).getByRole('button', { name: term })

  await browserUser.click(chip('cope'))
  await browserUser.click(screen.getByRole('button', { name: meaning(words[1]) }))

  expect(buzzes).toHaveLength(1)
  expect(speech.spoken).toHaveLength(0)
  expect(screen.getByRole('button', { name: meaning(words[1]) })).toHaveAttribute('data-wrong', 'true')
  expect(chip('cope')).toHaveClass('bg-rose-100')
  expect(screen.getByRole('status')).toHaveClass('text-rose-700')

  await browserUser.click(chip('cope'))
  await browserUser.click(screen.getByRole('button', { name: meaning(words[0]) }))
  expect(speech.spoken.map((utterance) => utterance.text)).toEqual(['cope'])
  // A right answer clears the red at once.
  expect(screen.getByRole('button', { name: meaning(words[1]) })).not.toHaveAttribute('data-wrong')

  // Without sound effects a wrong answer is only red.
  await browserUser.click(screen.getByRole('checkbox', { name: 'Sound effects' }))
  expect(window.localStorage.getItem('vocabflow.gameSound')).toBe('off')
  await browserUser.click(chip('budget'))
  await browserUser.click(screen.getByRole('button', { name: meaning(words[2]) }))
  expect(buzzes).toHaveLength(1)
  window.localStorage.removeItem('vocabflow.gameSound')
})

test('the red goes away by itself', async () => {
  stubApi(routes())
  const browserUser = userEvent.setup()
  renderApp('/app/study/review')
  await screen.findByRole('heading', { name: 'Round 1 of 1' })

  await browserUser.click(within(screen.getByRole('group', { name: 'Words' })).getByRole('button', { name: 'cope' }))
  await browserUser.click(screen.getByRole('button', { name: meaning(words[1]) }))
  expect(screen.getByRole('button', { name: meaning(words[1]) })).toHaveAttribute('data-wrong', 'true')

  await waitFor(() => expect(screen.getByRole('button', { name: meaning(words[1]) })).not.toHaveAttribute('data-wrong'), { timeout: 2000 })
})

test('choosing a meaning before a word asks for a word first', async () => {
  stubApi(routes())
  const browserUser = userEvent.setup()
  renderApp('/app/study/review')

  await browserUser.click(await screen.findByRole('button', { name: meaning(words[0]) }))

  expect(screen.getByRole('status')).toHaveTextContent('Choose a word first')
})

test('a word dragged onto its meaning is placed, and one dropped on the wrong meaning or nowhere is not', async () => {
  const speech = installSpeechSynthesis([voice('Samantha', 'en-US')])
  stubApi(routes())
  renderApp('/app/study/review')
  await screen.findByRole('heading', { name: 'Round 1 of 1' })
  const tray = () => screen.getByRole('group', { name: 'Words' })

  // jsdom does no layout, so what lies under the pointer is whatever the test says it is.
  let under: Element[] = []
  vi.stubGlobal('document', document)
  document.elementsFromPoint = () => under

  async function drag(term: string, onto: Element | null) {
    const chip = within(tray()).getByRole('button', { name: term })
    under = onto ? [onto] : []
    fireEvent(chip, pointerEvent('pointerdown', 100, 100))
    fireEvent(chip, pointerEvent('pointermove', 100, 160))
    fireEvent(chip, pointerEvent('pointerup', 100, 160))
    await waitFor(() => expect(swallowedClicks()).toBeDefined())
  }

  const cope = screen.getByRole('button', { name: meaning(words[0]) })
  const budget = screen.getByRole('button', { name: meaning(words[1]) })

  await drag('cope', budget)
  expect(screen.getByRole('status')).toHaveTextContent('Not that one')
  expect(within(tray()).getByRole('button', { name: 'cope' })).toBeInTheDocument()

  await drag('cope', null)
  expect(within(tray()).getByRole('button', { name: 'cope' })).toBeInTheDocument()

  await drag('cope', cope)
  expect(screen.getByRole('status')).toHaveTextContent('Correct: cope.')
  expect(within(tray()).queryByRole('button', { name: 'cope' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: meaning(words[0]) })).not.toBeInTheDocument()
  expect(speech.spoken.map((utterance) => utterance.text)).toEqual(['cope'])
})

test('a small movement is a tap, not a drag', async () => {
  stubApi(routes())
  renderApp('/app/study/review')
  await screen.findByRole('heading', { name: 'Round 1 of 1' })
  const chip = within(screen.getByRole('group', { name: 'Words' })).getByRole('button', { name: 'cope' })

  fireEvent(chip, pointerEvent('pointerdown', 100, 100))
  fireEvent(chip, pointerEvent('pointermove', 102, 101))
  fireEvent(chip, pointerEvent('pointerup', 102, 101))
  fireEvent.click(chip)

  expect(chip).toHaveAttribute('aria-pressed', 'true')
})

function pointerEvent(type: string, clientX: number, clientY: number) {
  const event = createEvent(type, document.body, { bubbles: true, clientX, clientY, button: 0 })
  Object.assign(event, { pointerId: 1, pointerType: 'touch', clientX, clientY, button: 0 })
  return event
}

// The click after a drag is dropped by a timer; give it its turn.
function swallowedClicks() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}
