import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { SpeechTestPage } from './pages/SpeechTestPage'

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(navigator, 'mediaDevices')
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

async function choose(variant: string) {
  await userEvent.selectOptions(screen.getByLabelText('Way of listening (for testing)'), variant)
}

function logText() {
  return document.querySelector('details pre')!.textContent!
}

test('the log lists every event with the recognizer it came from, and can be cleared', async () => {
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
  const rec = FakeRecognition.last!
  act(() => {
    ;(rec as unknown as Record<string, () => void>).onaudiostart()
    rec.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: 'hello' } }] })
  })
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
  const text = logText()
  expect(text).toContain('#1 new recognizer')
  expect(text).toContain('#1 start() called (variant A')
  expect(text).toContain('#1 onaudiostart')
  expect(text).toContain('#1 onresult n=1 final=false "hello"')
  expect(text).toContain('#1 stop() called')
  expect(text).toContain('#1 onend')
  await userEvent.click(screen.getByRole('button', { name: 'Clear log' }))
  expect(logText()).not.toContain('#1')
})

test('B stops with abort()', async () => {
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
  renderPage()
  await choose('B')
  await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
  const rec = FakeRecognition.last!
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
  expect(rec.abort).toHaveBeenCalled()
  expect(rec.stop).not.toHaveBeenCalled()
})

test('C starts the same recognizer again after it ended', async () => {
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
  renderPage()
  await choose('C')
  await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
  const rec = FakeRecognition.last!
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
  await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
  expect(FakeRecognition.last).toBe(rec)
  expect(rec.start).toHaveBeenCalledTimes(2)
})

test('D is continuous and Clear skips what was said before', async () => {
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
  renderPage()
  await choose('D')
  await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
  const rec = FakeRecognition.last!
  expect(rec.continuous).toBe(true)
  const one = { isFinal: true, 0: { transcript: 'I would like a cup of tea' } }
  const two = { isFinal: true, 0: { transcript: 'where is the bus stop' } }
  act(() => rec.onresult?.({ resultIndex: 0, results: [one] }))
  expect(screen.getByTestId('heard')).toHaveTextContent('cup of tea')
  await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
  expect(screen.queryByTestId('heard')).toBeNull()
  act(() => rec.onresult?.({ resultIndex: 1, results: [one, two] }))
  expect(screen.getByTestId('heard')).toHaveTextContent(/^where is the bus stop$/)
})

test('E makes a new recognizer only after a pause following the end', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  try {
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
    renderPage()
    act(() => void 0)
    await act(async () => {
      screen.getByLabelText('Way of listening (for testing)').focus()
    })
    const select = screen.getByLabelText('Way of listening (for testing)') as HTMLSelectElement
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!
      setter.call(select, 'E')
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    act(() => screen.getByRole('button', { name: 'Start speaking' }).click())
    const first = FakeRecognition.last!
    act(() => screen.getByRole('button', { name: 'Stop' }).click()) // the fake ends at once
    expect(screen.getByRole('button', { name: 'Wait…' })).toBeDisabled()
    act(() => vi.advanceTimersByTime(600))
    act(() => screen.getByRole('button', { name: 'Start speaking' }).click())
    expect(FakeRecognition.last).not.toBe(first)
  } finally {
    vi.useRealTimers()
  }
})

test('F makes each recognizer in a fresh hidden frame and removes the frame when it has ended', async () => {
  const frames: unknown[] = []
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    configurable: true,
    get() {
      const w = { webkitSpeechRecognition: FakeRecognition, navigator: { userActivation: { isActive: true } } }
      frames.push(w)
      return w
    },
  })
  try {
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
    renderPage()
    await choose('F')
    await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
    const first = FakeRecognition.last!
    expect(document.querySelectorAll('iframe')).toHaveLength(1)
    expect(document.querySelector('iframe')!.getAttribute('allow')).toBe('microphone')
    expect(logText()).toContain('F: new hidden frame; user activation: page')
    expect(logText()).toContain('recognizer in the frame: yes')

    await userEvent.click(screen.getByRole('button', { name: 'Stop' })) // the fake ends at once
    await vi.waitFor(() => expect(document.querySelectorAll('iframe')).toHaveLength(0))
    await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
    expect(FakeRecognition.last).not.toBe(first)
    expect(document.querySelectorAll('iframe')).toHaveLength(1)
    cleanup()
    expect(document.querySelectorAll('iframe')).toHaveLength(0)
  } finally {
    delete (HTMLIFrameElement.prototype as unknown as Record<string, unknown>).contentWindow
  }
})

test('F says so when the frame has no speech recognition', async () => {
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', { configurable: true, get: () => ({ navigator: {} }) })
  try {
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
    renderPage()
    await choose('F')
    await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
    expect(screen.getByRole('alert')).toHaveTextContent('hidden frame has no speech recognition')
    expect(screen.getByRole('button', { name: 'Start speaking' })).toBeEnabled()
  } finally {
    delete (HTMLIFrameElement.prototype as unknown as Record<string, unknown>).contentWindow
  }
})

function setMedia(getUserMedia: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
}

function fakeStream() {
  const track = { readyState: 'live', muted: false, enabled: true, stop: vi.fn(), addEventListener: vi.fn() }
  return { track, stream: { getTracks: () => [track] } as unknown as MediaStream }
}

test('G opens the microphone once, keeps the stream over Start and Stop, and closes it when released', async () => {
  const { track, stream } = fakeStream()
  const getUserMedia = vi.fn(async () => stream)
  setMedia(getUserMedia)
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
  renderPage()
  await choose('G')
  await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
  await vi.waitFor(() => expect(FakeRecognition.last).toBeDefined())
  expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
  expect(logText()).toContain('G: microphone stream open (1 track(s): readyState=live muted=false enabled=true)')
  expect(logText()).toContain('G: stream before start: 1 track(s)')
  const first = FakeRecognition.last!

  await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
  expect(logText()).toContain('G: stream after the end: 1 track(s)')
  await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
  expect(getUserMedia).toHaveBeenCalledTimes(1) // the stream is kept
  expect(FakeRecognition.last).not.toBe(first)
  expect(track.stop).not.toHaveBeenCalled()

  await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
  await userEvent.click(screen.getByRole('button', { name: 'Release microphone' }))
  expect(track.stop).toHaveBeenCalled()
  expect(logText()).toContain('G: microphone stream released')
})

test('G shows a refused microphone and leaving the page closes the stream', async () => {
  const refused = vi.fn(async () => {
    throw new DOMException('no', 'NotAllowedError')
  })
  setMedia(refused)
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
  renderPage()
  await choose('G')
  await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
  await vi.waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('could not be opened'))
  expect(logText()).toContain('G: getUserMedia failed: NotAllowedError')
  expect(screen.getByRole('button', { name: 'Start speaking' })).toBeEnabled()

  const { track, stream } = fakeStream()
  setMedia(vi.fn(async () => stream))
  await userEvent.click(screen.getByRole('button', { name: 'Start speaking' }))
  await vi.waitFor(() => expect(FakeRecognition.last).toBeDefined())
  cleanup()
  expect(track.stop).toHaveBeenCalled()
})
