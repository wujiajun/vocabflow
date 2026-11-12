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
