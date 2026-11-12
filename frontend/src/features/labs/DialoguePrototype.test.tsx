import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSpeechSynthesis } from '../../test/speech'
import { readingMs } from './dialogue'
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
  fire(name: string) {
    act(() => (this as unknown as Record<string, (() => void) | undefined>)[`on${name}`]?.())
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

// The microphone is ready (the permission question, if any, is answered): now the phone may speak.
async function openAndReady() {
  await open()
  FakeRecognition.instances[0].fire('audiostart')
}

function phoneFinishesSpeaking() {
  act(() => {
    speech.lastUtterance().onstart?.()
    speech.lastUtterance().onend?.()
  })
}

const failure = (error: string) => Object.assign(new Event('error'), { error })

const log = () => document.querySelector('details pre')!.textContent!

test('nothing is spoken until the microphone is ready; then the phone speaks', async () => {
  await open()
  expect(speech.spoken).toHaveLength(0)
  expect(screen.getByText(/Starting the microphone/)).toBeInTheDocument()
  FakeRecognition.instances[0].fire('audiostart')
  expect(speech.lastUtterance().text).toBe('Hi there! What can I get for you?')
  expect(log()).toContain('microphone ready (onaudiostart)')
})

test('a refused microphone is shown, nothing is spoken, and the way back is offered', async () => {
  const onBack = vi.fn()
  await open()
  const rec = FakeRecognition.instances[0]
  act(() => rec.onerror?.({ error: 'not-allowed' }))
  act(() => rec.onend?.())
  expect(speech.spoken).toHaveLength(0)
  expect(screen.getAllByRole('alert').map((a) => a.textContent).join(' ')).toMatch(/refused/)
  expect(screen.getByRole('button', { name: 'Back to the one-sentence test' })).toBeInTheDocument()
  expect(onBack).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Back to the one-sentence test' }))
  expect(screen.getByRole('button', { name: 'Start speaking' })).toBeInTheDocument()
})

test('a speech cut off by the system is tried once more, then skipped', async () => {
  await openAndReady()
  const first = speech.lastUtterance()
  act(() => {
    (first.onerror as unknown as (e: Event) => void)(failure('interrupted'))
  })
  expect(log()).toContain('onerror: interrupted')
  await vi.waitFor(() => expect(speech.spoken).toHaveLength(2))
  const second = speech.lastUtterance()
  act(() => {
    (second.onerror as unknown as (e: Event) => void)(failure('canceled'))
  })
  expect(log()).toContain('skipped after a second failure')
  expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument() // on to the learner's turn
})

function renderFaked() {
  render(
    <MemoryRouter>
      <SpeechTestPage />
    </MemoryRouter>,
  )
  act(() => screen.getByRole('button', { name: 'Conversation' }).click())
}

test('waiting for the microphone too long shows Cancel, and the log says where it stopped', () => {
  vi.useRealTimers()
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
  renderFaked()
  act(() => screen.getByRole('button', { name: 'Start the conversation' }).click())
  act(() => void vi.advanceTimersByTime(10100))
  expect(screen.getByRole('alert')).toHaveTextContent('Nothing has moved')
  expect(log()).toContain('STUCK: no progress for 10 s at "waiting for the microphone to start"')
  expect(speech.spoken).toHaveLength(0)
  act(() => screen.getByRole('button', { name: 'Cancel' }).click())
  expect(screen.getByRole('button', { name: 'Start the conversation' })).toBeInTheDocument()
})

test('a speech that starts but never ends while the microphone is on is cancelled and the lines become text', () => {
  vi.useRealTimers()
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
  renderFaked()
  act(() => screen.getByRole('button', { name: 'Start the conversation' }).click())
  FakeRecognition.instances[0].fire('audiostart')
  act(() => speech.lastUtterance().onstart?.()) // started, and then silence
  act(() => void vi.advanceTimersByTime(5000))
  expect(log()).toContain('TTS BLOCKED')
  expect(log()).toContain('synth:')
  expect(speech.synth.cancel).toHaveBeenCalled()
  expect(screen.getByText(/did not speak while the microphone was on/)).toBeInTheDocument()
  act(() => screen.getByRole('button', { name: 'I read it' }).click())
  expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
})

test('Text only shows the partner lines without speaking, and moves on by itself after a time', () => {
  vi.useRealTimers()
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
  renderFaked()
  act(() => {
    const select = screen.getByLabelText('Partner lines') as HTMLSelectElement
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'text')
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  act(() => screen.getByRole('button', { name: 'Start the conversation' }).click())
  FakeRecognition.instances[0].fire('audiostart')
  expect(speech.spoken).toHaveLength(0)
  expect(screen.getByRole('button', { name: 'I read it' })).toBeInTheDocument()
  act(() => void vi.advanceTimersByTime(readingMs('Hi there! What can I get for you?') + 100))
  expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
  expect(log()).toContain('read (time)')
})

test('the log records the speech state when the microphone starts and when a line is spoken', async () => {
  await openAndReady()
  expect(log()).toContain('speech state at audiostart: speaking=false paused=undefined')
  expect(log()).toMatch(/tts line 1 speak, attempt 1, recognizer \w+, synth before: speaking=/)
})

test('one continuous recognizer; the phone speaks first and its echo is discarded', async () => {
  await openAndReady()
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
  await openAndReady()
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
  await openAndReady()
  const rec = FakeRecognition.instances[0]
  act(() => rec.onend?.())
  expect(screen.getByRole('alert')).toHaveTextContent('ended the listening by itself')
  expect(screen.getByRole('alert')).toHaveTextContent('cannot promise')
  expect(log()).toContain('NOT asked by us')
})

test('finishing the conversation stops the recognizer on purpose and shows the average', async () => {
  await openAndReady()
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
