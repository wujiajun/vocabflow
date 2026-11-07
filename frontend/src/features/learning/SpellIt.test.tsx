import { cleanup, screen } from '@testing-library/react'
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

const words = ['cope', 'budget', "don't", 'take off', 'rent']

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
    senses: [{ partOfSpeech: null, label: null, phonetic: null, definition: `Number ${id} means ${term}.`, examples: null, collocations: null, emoji: '🧊', scene: `A scene with ${term}.` }],
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
    'GET /api/v1/learning/study-queue': () => jsonResponse({ ...emptyStudyQueue, finished: true, studiedCount: count, studiedToday: studied }),
    ...Object.fromEntries(words.map((term, index) => [`GET /api/v1/vocabulary/${index + 1}`, () => jsonResponse(entry(index + 1, term))])),
  }
}

// The word being asked is read from the meaning on the card, as the learner would never see it.
function currentWord() {
  const meaning = screen.getByText(/^Number \d+ means /).textContent!
  return words[Number(/Number (\d+)/.exec(meaning)![1]) - 1]
}

function slotStates() {
  return [...document.querySelectorAll('[data-state]')].map((slot) => slot.getAttribute('data-state'))
}

async function start() {
  const browserUser = userEvent.setup()
  renderApp('/app/study/spell')
  await browserUser.click(await screen.findByRole('button', { name: 'Start' }))
  return browserUser
}

test('the study-complete page offers the game with four words studied', async () => {
  stubApi(routes(3))
  renderApp('/app/study')
  await screen.findByRole('heading', { name: 'Today’s study is complete' })
  expect(screen.queryByRole('link', { name: 'Spell it' })).not.toBeInTheDocument()
  cleanup()

  stubApi(routes(4))
  renderApp('/app/study')
  expect(await screen.findByRole('link', { name: 'Spell it' })).toHaveAttribute('href', '/app/study/spell')
})

test('with fewer than four words it says how many to study', async () => {
  stubApi(routes(3))
  renderApp('/app/study/spell')
  expect(await screen.findByText(/Study at least 4 words today/)).toBeInTheDocument()
})

test('shows a slot per letter, turns a wrong letter red until it is fixed, and finishes with stars', async () => {
  installSpeechSynthesis([voice('Samantha', 'en-US')])
  stubApi(routes())
  const browserUser = await start()

  for (let number = 1; number <= 5; number += 1) {
    await screen.findByRole('region', { name: `Word ${number} of 5` })
    const word = currentWord()
    const letters = [...word].filter((char) => /[a-z]/.test(char))
    // The word itself is never on the card.
    expect(screen.queryByText(new RegExp(`“${word}”`))).not.toBeInTheDocument()
    expect(slotStates().length).toBe(letters.length)
    const input = screen.getByRole('textbox', { name: 'Type the word' })
    expect(input).toHaveFocus()

    if (number === 1) {
      // A wrong letter first: it stays, red, and the word cannot finish over it.
      const wrong = letters[0] === 'z' ? 'y' : 'z'
      await browserUser.keyboard(wrong)
      expect(slotStates()[0]).toBe('wrong')
      expect(screen.getByRole('status')).toHaveTextContent('A red letter is wrong')
      await browserUser.keyboard('{Backspace}')
      expect(slotStates()[0]).toBe('empty')
      await browserUser.keyboard(letters.join('').toUpperCase())
    } else {
      await browserUser.keyboard(letters.join(''))
    }

    expect(screen.getByRole('status')).toHaveTextContent(`The word is “${word}”.`)
    expect(slotStates().every((state) => state === 'done')).toBe(true)
    await browserUser.click(screen.getByRole('button', { name: number === 5 ? 'See results' : 'Next' }))
  }

  // One mistake costs one star on the first word: 2 + 3 + 3 + 3 + 3 = 14 of 15.
  expect(screen.getByRole('heading', { name: 'Nicely done! 14 of 15 stars' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
})

test('a full word with a wrong letter stays open, and retyping the end fixes it', async () => {
  stubApi(routes())
  const browserUser = await start()
  const word = currentWord()
  const letters = [...word].filter((char) => /[a-z]/.test(char))
  await browserUser.keyboard(`${letters.slice(0, -1).join('')}${letters.at(-1) === 'q' ? 'x' : 'q'}`)

  expect(slotStates().at(-1)).toBe('wrong')
  expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
  await browserUser.keyboard('{Backspace}')
  await browserUser.keyboard(letters.at(-1)!)
  expect(screen.getByRole('button', { name: /Next|See results/ })).toBeInTheDocument()
})

test('Show a letter writes the next right letter, replacing a wrong one, and costs a star', async () => {
  stubApi(routes())
  const browserUser = await start()
  const word = currentWord()
  const letters = [...word].filter((char) => /[a-z]/.test(char))
  await browserUser.keyboard(letters[0] === 'q' ? 'x' : 'q')
  await browserUser.click(screen.getByRole('button', { name: /Show a letter/ }))

  expect(slotStates()[0]).toBe('right')
  expect(screen.getByRole('textbox', { name: 'Type the word' })).toHaveValue(letters[0])
  await browserUser.keyboard(letters.slice(1).join(''))
  expect(screen.getByRole('status')).toHaveTextContent('Correct!')
  // One mistake and one shown letter: two stars minus one is one.
  expect(document.body.textContent).toContain('⭐')
  expect(screen.getByLabelText('1 stars so far')).toBeInTheDocument()
})

test('Skip shows the word, earns nothing and moves on; the memory hook opens on request', async () => {
  stubApi(routes())
  const browserUser = await start()
  const word = currentWord()

  expect(screen.queryByRole('region', { name: 'Memory hook' })).not.toBeInTheDocument()
  await browserUser.click(screen.getByRole('button', { name: /Memory hook/ }))
  expect(screen.getByRole('region', { name: 'Memory hook' })).toHaveTextContent('A scene with _____.')
  await browserUser.click(screen.getByRole('button', { name: 'Skip' }))

  expect(screen.getByRole('status')).toHaveTextContent(`Skipped. The word was “${word}”.`)
  expect(screen.getByLabelText('0 stars so far')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
})
