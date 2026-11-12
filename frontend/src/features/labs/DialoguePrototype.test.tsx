import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSpeechSynthesis } from '../../test/speech'
import { SpeechTestPage } from './pages/SpeechTestPage'

class FakeRecognition {
  static instances: FakeRecognition[] = []
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn(() => this.onend?.())
  abort = vi.fn()
  constructor() {
    FakeRecognition.instances.push(this)
  }
  said(...parts: [string, boolean][]) {
    act(() => this.onresult?.({ resultIndex: 0, results: parts.map(([t, f]) => ({ isFinal: f, 0: { transcript: t } })) }))
  }
}

let speech: ReturnType<typeof installSpeechSynthesis>

beforeEach(() => {
  FakeRecognition.instances = []
  speech = installSpeechSynthesis()
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
  vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function open() {
  render(
    <MemoryRouter>
      <SpeechTestPage />
    </MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Conversation' }))
  await userEvent.click(screen.getByRole('button', { name: 'Start the conversation' }))
}

function phoneFinishesSpeaking() {
  act(() => speech.lastUtterance().onend?.())
}

const log = () => document.querySelector('details pre')!.textContent!

test('one continuous recognizer; the phone speaks first and its echo is discarded', async () => {
  await open()
  expect(FakeRecognition.instances).toHaveLength(1)
  const rec = FakeRecognition.instances[0]
  expect(rec.continuous).toBe(true)
  expect(speech.lastUtterance().text).toBe('Hi there! What can I get for you?')

  rec.said(['hi there what can I get for you', false]) // the phone's own voice
  expect(log()).toContain('discarded')
  phoneFinishesSpeaking()
  rec.said(['hi there what can I get for you', true]) // its final arrives just after: still echo
  expect(screen.getByTestId('heard-now')).toHaveTextContent('')
  expect(screen.queryByTestId('result-1')).toBeNull()

  vi.setSystemTime(Date.now() + 1500)
  rec.said(['hi there what can I get for you', true], ['can I have a medium coffee', false])
  expect(screen.getByTestId('heard-now')).toHaveTextContent('can I have a medium coffee')
  expect(FakeRecognition.instances).toHaveLength(1)
})

test('a final result judges the line and goes on; Done and Skip work without one', async () => {
  await open()
  const rec = FakeRecognition.instances[0]
  phoneFinishesSpeaking()
  vi.setSystemTime(Date.now() + 1500)

  rec.said(['can I have a medium coffee with milk please', true])
  expect(screen.getByTestId('result-1')).toHaveTextContent('100%')
  expect(speech.lastUtterance().text).toBe('Sure. Would you like anything to eat?')

  phoneFinishesSpeaking()
  vi.setSystemTime(Date.now() + 1500)
  rec.said(['can I have a medium coffee with milk please', true], ['yes I would like a muffin', false])
  await userEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(screen.getByTestId('result-3')).toHaveTextContent(/%/)
  expect(log()).toContain('judged by Done button')

  phoneFinishesSpeaking()
  vi.setSystemTime(Date.now() + 1500)
  await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
  expect(screen.getByTestId('result-5')).toHaveTextContent('skipped')
  expect(FakeRecognition.instances).toHaveLength(1)
})

test('when the phone ends the listening, it says so and promises nothing', async () => {
  await open()
  const rec = FakeRecognition.instances[0]
  act(() => rec.onend?.())
  expect(screen.getByRole('alert')).toHaveTextContent('ended the listening by itself')
  expect(screen.getByRole('alert')).toHaveTextContent('cannot promise')
  expect(log()).toContain('NOT asked by us')
})

test('finishing the conversation stops the recognizer on purpose and shows the average', async () => {
  await open()
  const rec = FakeRecognition.instances[0]
  for (let i = 0; i < 4; i++) {
    phoneFinishesSpeaking()
    vi.setSystemTime(Date.now() + 1500)
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
  }
  expect(rec.stop).toHaveBeenCalled()
  expect(screen.getByText(/Finished\./)).toBeInTheDocument()
  expect(log()).toContain('asked by us')
})
