import { cleanup, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { installSpeechSynthesis, voice } from '../../test/speech'
import { emptyStudyQueue, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'

const sounds = vi.hoisted(() => ({ playRight: vi.fn(), playWrong: vi.fn(), unlockGameSound: vi.fn() }))
vi.mock('../../shared/sound/effects', async (original) => ({ ...(await original<typeof import('../../shared/sound/effects')>()), ...sounds }))

beforeEach(() => {
  sounds.playRight.mockClear()
  sounds.playWrong.mockClear()
  sounds.unlockGameSound.mockClear()
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
    senses: [{ partOfSpeech: null, label: null, phonetic: null, definition: `Number ${id} means ${term}.`, examples: null, collocations: null, chinese: `中文${id}`, ...(id === 5 ? {} : { emoji: '🧊', scene: `Scene ${id} with ${term}.` }) }],
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

// The word being asked, found from what is on the card (a hook scene or a meaning, each with its number), as
// the learner would never see the word itself. Only before the word is finished.
function currentWord() {
  const text = document.body.textContent ?? ''
  const id = /Scene (\d+) with/.exec(text)?.[1] ?? /Number (\d+) means/.exec(text)![1]
  return words[Number(id) - 1]
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

test('the study-complete page offers the game with five words studied', async () => {
  stubApi(routes(4))
  renderApp('/app/study')
  await screen.findByRole('heading', { name: 'Today’s study is complete' })
  expect(screen.queryByRole('link', { name: 'Spell it' })).not.toBeInTheDocument()
  cleanup()

  stubApi(routes(5))
  renderApp('/app/study')
  expect(await screen.findByRole('link', { name: 'Spell it' })).toHaveAttribute('href', '/app/study/spell')
})

test('with fewer than five words it says how many to study', async () => {
  stubApi(routes(4))
  renderApp('/app/study/spell')
  expect(await screen.findByText(/Study at least 5 words, today or in the last 7 days/)).toBeInTheDocument()
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
      // A wrong first letter: nothing is red until the row is full, then it is, and the word cannot finish over it.
      const wrong = letters[0] === 'z' ? 'y' : 'z'
      await browserUser.keyboard(`${wrong}${letters.slice(1).join('')}`)
      expect(slotStates()[0]).toBe('wrong')
      expect(screen.getByRole('status')).toHaveTextContent('The red letters are wrong')
      await browserUser.keyboard('{Backspace}'.repeat(letters.length))
      expect(slotStates().every((state) => state === 'empty')).toBe(true)
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

test('Show a letter replaces a wrong letter with the right one, and costs a star', async () => {
  stubApi(routes())
  const browserUser = await start()
  const word = currentWord()
  const letters = [...word].filter((char) => /[a-z]/.test(char))
  await browserUser.keyboard(letters[0] === 'q' ? 'x' : 'q')
  expect(slotStates()[0]).toBe('filled')
  await browserUser.click(screen.getByRole('button', { name: /Show a letter/ }))

  expect(slotStates()[0]).toBe('filled')
  expect(screen.getByRole('textbox', { name: 'Type the word' })).toHaveValue(letters[0])
  await browserUser.keyboard(letters.slice(1).join(''))
  expect(screen.getByRole('status')).toHaveTextContent('Correct!')
  // No wrong row was ever full, and one letter was shown: three stars minus one.
  expect(screen.getByLabelText('2 stars so far')).toBeInTheDocument()
})

test('the memory hook is the clue and the meanings come after the word: English and Chinese', async () => {
  stubApi(routes())
  const browserUser = await start()

  for (let number = 1; number <= 5; number += 1) {
    await screen.findByRole('region', { name: `Word ${number} of 5` })
    const word = currentWord()
    const id = words.indexOf(word) + 1
    const letters = [...word].filter((char) => /[a-z]/.test(char))

    // While spelling: a word with a hook shows only the hook (the scene with the word hidden), and the word
    // without one shows its meaning (word hidden) as its only clue. The Chinese is never shown yet.
    if (id === 5) {
      expect(screen.queryByRole('region', { name: 'Memory hook' })).not.toBeInTheDocument()
      expect(screen.getByText('Number 5 means _____.')).toBeInTheDocument()
    } else {
      expect(screen.getByRole('region', { name: 'Memory hook' })).toHaveTextContent(`Scene ${id} with _____.`)
      expect(screen.queryByText(/Number \d+ means/)).not.toBeInTheDocument()
    }
    expect(screen.queryByRole('region', { name: 'Meaning' })).not.toBeInTheDocument()
    expect(screen.queryByText(/中文/)).not.toBeInTheDocument()

    if (number === 2) {
      // Skipping reveals them too.
      await browserUser.click(screen.getByRole('button', { name: 'Skip' }))
      expect(screen.getByRole('status')).toHaveTextContent(`Skipped. The word was “${word}”.`)
    } else {
      await browserUser.keyboard(letters.join(''))
    }

    const meaning = screen.getByRole('region', { name: 'Meaning' })
    expect(meaning).toHaveTextContent(`Number ${id} means ${word}.`)
    expect(meaning).toHaveTextContent(`中文${id}`)
    await browserUser.click(screen.getByRole('button', { name: number === 5 ? 'See results' : 'Next' }))
  }
})

test('nothing is judged until the row is full; then a wrong row is red with a buzz, and refilling it right gives the ding', async () => {
  stubApi(routes())
  const browserUser = await start()
  // The sound is unlocked by the press of Start, because a typed letter is not a press.
  expect(sounds.unlockGameSound).toHaveBeenCalled()
  const word = currentWord()
  const letters = [...word].filter((char) => /[a-z]/.test(char))
  const wrong = letters.at(-1) === 'q' ? 'x' : 'q'

  // Wrong letters on the way are plain letters: no red, no sound, and Backspace changes them.
  await browserUser.keyboard(`${letters.slice(0, -2).join('')}${wrong}`)
  expect(slotStates().includes('wrong')).toBe(false)
  expect(sounds.playWrong).not.toHaveBeenCalled()
  await browserUser.keyboard('{Backspace}')
  await browserUser.keyboard(letters.at(-2)!)

  // The last slot is filled with a wrong letter: judged now.
  await browserUser.keyboard(wrong)
  expect(slotStates().at(-1)).toBe('wrong')
  expect(slotStates().slice(0, -1).every((state) => state === 'right')).toBe(true)
  expect(sounds.playWrong).toHaveBeenCalledTimes(1)
  expect(sounds.playRight).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: /Next|See results/ })).not.toBeInTheDocument()

  // Fixed by Backspace and the right letter: judged again, and right.
  await browserUser.keyboard('{Backspace}')
  expect(slotStates().includes('wrong')).toBe(false)
  await browserUser.keyboard(letters.at(-1)!)
  expect(sounds.playRight).toHaveBeenCalledTimes(1)
  expect(sounds.playWrong).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('status')).toHaveTextContent('Correct! 1 wrong try.')
})

test('a row filled while the keyboard is still building the word is judged at once', async () => {
  stubApi(routes())
  await start()
  const word = currentWord()
  const letters = [...word].filter((char) => /[a-z]/.test(char))
  const input = screen.getByRole('textbox', { name: 'Type the word' })
  const wrong = letters[0] === 'q' ? 'x' : 'q'

  fireEvent.compositionStart(input)
  fireEvent.change(input, { target: { value: letters.slice(0, -1).join('') } })
  expect(slotStates().includes('wrong')).toBe(false)
  fireEvent.change(input, { target: { value: `${wrong}${letters.slice(1).join('')}` } })

  expect(slotStates()[0]).toBe('wrong')
  expect(sounds.playWrong).toHaveBeenCalledTimes(1)
})
