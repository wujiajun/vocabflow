import { act, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { expectNoAxeViolations } from '../../test/axe'
import { installSpeechSynthesis, voice } from '../../test/speech'
import { expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'
import type { ReadingPassage } from './types/reading'

beforeEach(() => {
  window.localStorage.clear()
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

const american = voice('Samantha', 'en-US')

function passage(): ReadingPassage {
  return {
    id: 11,
    studyDate: '2026-11-01',
    createdAt: '2026-11-01T22:00:00Z',
    title: 'Signing the lease',
    text: 'Maya read the [[lease]] twice.\n\nHer [[landlord]] waited, then left.',
    words: ['lease', 'landlord'],
    read: false,
    readAt: null,
  }
}

function api() {
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/reading/passages/11': () => jsonResponse(passage()),
    'GET /api/v1/reading/passages': () => jsonResponse({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
  })
}

async function open() {
  renderApp('/app/reading/11')
  await screen.findByRole('heading', { name: 'Signing the lease' })
}

test('the passage can be listened to only where the browser can speak', async () => {
  api()

  await open()

  expect(screen.queryByRole('button', { name: 'Listen' })).not.toBeInTheDocument()
})

test('Listen reads the passage sentence by sentence, marks the one being read, and ends where it began', async () => {
  const speech = installSpeechSynthesis([american])
  api()
  const browserUser = userEvent.setup()
  await open()
  await expectNoAxeViolations()

  await browserUser.click(screen.getByRole('button', { name: 'Listen' }))

  expect(speech.lastUtterance()).toMatchObject({ text: 'Maya read the lease twice.', lang: 'en-US', voice: american, rate: 0.9 })
  expect(document.querySelector('[data-reading]')).toHaveTextContent('Maya read the lease twice.')
  expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  await expectNoAxeViolations()

  act(() => speech.lastUtterance().onend?.())
  expect(speech.lastUtterance().text).toBe('Her landlord waited, then left.')
  expect(document.querySelector('[data-reading]')).toHaveTextContent('Her landlord waited, then left.')
  // The studied words stay highlighted inside the sentence being read.
  expect(within(document.querySelector('[data-reading]') as HTMLElement).getByText('landlord', { selector: 'mark' })).toBeInTheDocument()

  act(() => speech.lastUtterance().onend?.())
  expect(screen.getByRole('button', { name: 'Listen' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument()
  expect(document.querySelector('[data-reading]')).toBeNull()
  expect(speech.spoken.map((utterance) => utterance.text).join(' ')).not.toContain('[[')
})

test('Pause stops where it is and Resume starts that sentence again; Stop starts over', async () => {
  const speech = installSpeechSynthesis([american])
  api()
  const browserUser = userEvent.setup()
  await open()

  await browserUser.click(screen.getByRole('button', { name: 'Listen' }))
  act(() => speech.lastUtterance().onend?.())
  await browserUser.click(screen.getByRole('button', { name: 'Pause' }))

  expect(speech.synth.cancel).toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
  const spokenBefore = speech.spoken.length
  // The cancelled sentence reports an error; that must not move reading on or end it.
  act(() => speech.lastUtterance().onerror?.())
  expect(speech.spoken).toHaveLength(spokenBefore)
  expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()

  await browserUser.click(screen.getByRole('button', { name: 'Resume' }))
  expect(speech.lastUtterance().text).toBe('Her landlord waited, then left.')
  expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()

  await browserUser.click(screen.getByRole('button', { name: 'Stop' }))
  expect(screen.getByRole('button', { name: 'Listen' })).toBeInTheDocument()
  expect(document.querySelector('[data-reading]')).toBeNull()
  await browserUser.click(screen.getByRole('button', { name: 'Listen' }))
  expect(speech.lastUtterance().text).toBe('Maya read the lease twice.')
})

test('a slower speed applies at once and is remembered', async () => {
  const speech = installSpeechSynthesis([american])
  api()
  const browserUser = userEvent.setup()
  await open()

  expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'true')
  await browserUser.click(screen.getByRole('button', { name: 'Listen' }))
  await browserUser.click(screen.getByRole('button', { name: 'Slow' }))

  expect(screen.getByRole('button', { name: 'Slow' })).toHaveAttribute('aria-pressed', 'true')
  expect(speech.lastUtterance()).toMatchObject({ text: 'Maya read the lease twice.', rate: 0.7 })

  cleanup()
  await open()
  expect(screen.getByRole('button', { name: 'Slow' })).toHaveAttribute('aria-pressed', 'true')
})

test('leaving the page stops the reading', async () => {
  const speech = installSpeechSynthesis([american])
  api()
  const browserUser = userEvent.setup()
  await open()

  await browserUser.click(screen.getByRole('button', { name: 'Listen' }))
  speech.synth.cancel.mockClear()
  await browserUser.click(screen.getByRole('link', { name: '← Back to reading' }))

  expect(speech.synth.cancel).toHaveBeenCalled()
})

test('it says when only a non-American voice is available', async () => {
  installSpeechSynthesis([voice('Daniel', 'en-GB')])
  api()

  await open()

  expect(screen.getByText(/No American English voice was found/)).toBeInTheDocument()
})
