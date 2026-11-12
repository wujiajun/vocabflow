import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { SpeechTestPage } from './pages/SpeechTestPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

class FakeRecognition {
  static last: FakeRecognition | undefined
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  constructor() {
    FakeRecognition.last = this
  }
  start = vi.fn()
  stop = vi.fn(() => this.onend?.())
  abort = vi.fn()
}

test('says so when the browser has no speech recognition', () => {
  render(
    <MemoryRouter>
      <SpeechTestPage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('no speech recognition')
  expect(screen.getByRole('button', { name: 'Start speaking' })).toBeDisabled()
})

test('listens on a press and compares what was heard', async () => {
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
  render(
    <MemoryRouter>
      <SpeechTestPage />
    </MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
  const rec = FakeRecognition.last!
  expect(rec.start).toHaveBeenCalled()
  expect(rec.lang).toBe('en-US')

  act(() => rec.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'I would like a cup of tea please' } }] }))
  expect(screen.getByTestId('heard')).toHaveTextContent('tea')
  const statuses = Array.from(document.querySelectorAll('[data-status]')).map((e) => e.getAttribute('data-status'))
  expect(statuses).toEqual(['correct', 'correct', 'correct', 'correct', 'correct', 'correct', 'wrong', 'correct'])

  await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
  expect(screen.getByRole('button', { name: 'Start speaking' })).toBeEnabled()
})

test('shows a clear message when the microphone is refused', async () => {
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
  render(
    <MemoryRouter>
      <SpeechTestPage />
    </MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
  act(() => FakeRecognition.last!.onerror?.({ error: 'not-allowed' }))
  expect(screen.getByRole('alert')).toHaveTextContent('refused')
})

function renderPage() {
  render(
    <MemoryRouter>
      <SpeechTestPage />
    </MemoryRouter>,
  )
}

test('Start waits while the recognizer is stopping, then works again', async () => {
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
  const first = FakeRecognition.last!
  first.stop = vi.fn() // iOS: `end` comes later

  await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
  expect(screen.getByRole('button', { name: 'Wait…' })).toBeDisabled()
  expect(FakeRecognition.last).toBe(first)

  act(() => first.onend?.())
  await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
  expect(FakeRecognition.last).not.toBe(first)
  expect(FakeRecognition.last!.start).toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
})

test('a late end or result from an earlier recognizer does not touch the new one', async () => {
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
  const first = FakeRecognition.last!
  await userEvent.click(screen.getByRole('button', { name: 'Stop' })) // the fake ends at once
  await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
  const second = FakeRecognition.last!
  expect(second).not.toBe(first)

  act(() => {
    first.onend?.()
    first.onerror?.({ error: 'network' })
    first.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'old words' } }] })
  })
  expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByTestId('heard')).toBeNull()
})

test('an error resets to Start, and a failing start() is shown', async () => {
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
  act(() => FakeRecognition.last!.onerror?.({ error: 'network' }))
  expect(screen.getByRole('alert')).toHaveTextContent('network error')
  expect(screen.getByRole('button', { name: 'Start speaking' })).toBeEnabled()

  class Throwing extends FakeRecognition {
    start = vi.fn(() => {
      throw new Error('already started')
    })
  }
  vi.stubGlobal('webkitSpeechRecognition', Throwing)
  await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
  expect(screen.getByRole('alert')).toHaveTextContent('already started')
  expect(screen.getByRole('button', { name: 'Start speaking' })).toBeEnabled()
})

test('gives up waiting for end after a few seconds', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  try {
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
    renderPage()
    act(() => screen.getByRole('button', { name: 'Start speaking' }).click())
    FakeRecognition.last!.stop = vi.fn()
    act(() => screen.getByRole('button', { name: 'Stop' }).click())
    expect(screen.getByRole('button', { name: 'Wait…' })).toBeDisabled()
    act(() => vi.advanceTimersByTime(3100))
    expect(screen.getByRole('button', { name: 'Start speaking' })).toBeEnabled()
  } finally {
    vi.useRealTimers()
  }
})
