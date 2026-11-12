import { useCallback, useEffect, useRef, useState } from 'react'

// The browser's own recognizer, in the two names it goes by. Experimental and not in lib.dom, so typed by hand.
interface RecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
}
interface RecognitionEventLike {
  resultIndex: number
  results: ArrayLike<RecognitionResultLike>
}
interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: RecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onnomatch: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionConstructor = new () => RecognitionLike

export function getRecognitionConstructor(): RecognitionConstructor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export function recognitionErrorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
      return 'The microphone or speech recognition was refused. Allow it for this site (Safari: aA menu → Website Settings; iPhone Settings → Siri & Search / Dictation must be on). On plain http:// the browser may refuse without asking.'
    case 'service-not-allowed':
      return 'The browser does not allow speech recognition here (a home-screen app or a built-in browser, or Siri/Dictation is off).'
    case 'no-speech':
      return 'Nothing was heard. Try again, closer to the microphone.'
    case 'audio-capture':
      return 'No microphone was found.'
    case 'network':
      return 'The speech service could not be reached (network error).'
    case 'language-not-supported':
      return 'This language is not supported by the recognizer.'
    case 'aborted':
      return ''
    default:
      return `Recognition failed (${code}).`
  }
}

export type RecognitionState = 'idle' | 'starting' | 'listening' | 'stopping'

/**
 * Ways of driving the recognizer, to find out which one a phone's home-screen app handles reliably.
 * A: a new recognizer each time, Stop = stop(). B: Stop = abort(). C: one recognizer reused (start again
 * after its end). D: continuous, started once; Clear empties the display. E: a new recognizer, but
 * only 500 ms after the last one ended. F: each recognizer is made in a new hidden same-page frame, which is
 * removed when it has ended. G: the first Start opens the microphone with getUserMedia and keeps that stream
 * for as long as the page is open (or until it is released); then A's loop.
 */
export type Variant = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
export const variantLabels: Record<Variant, string> = {
  A: 'A · New each time, Stop uses stop() (as before)',
  B: 'B · New each time, Stop uses abort()',
  C: 'C · Reuse one recognizer, start again after it ends',
  D: 'D · Continuous: Start once, keep talking, use Clear',
  E: 'E · New each time, wait 0.5 s after the end',
  F: 'F · New each time, inside a fresh hidden frame',
  G: 'G · New each time, with the microphone kept open',
}

// iOS may never send `end` after stop(); after this long the recognizer is taken as finished.
export const stopTimeoutMs = 3000
export const cooldownMs = 500
const logLimit = 400

const plainEvents = ['start', 'audiostart', 'soundstart', 'speechstart', 'speechend', 'soundend', 'audioend', 'nomatch'] as const

function activation(target: Navigator | undefined): string {
  const active = (target as unknown as { userActivation?: { isActive: boolean } } | undefined)?.userActivation?.isActive
  return active === undefined ? 'unknown' : String(active)
}

function streamInfo(stream: MediaStream | null): string {
  if (!stream) return 'no stream'
  const tracks = stream.getTracks()
  return `${tracks.length} track(s): ${tracks.map((t) => `readyState=${t.readyState} muted=${t.muted} enabled=${t.enabled}`).join('; ')}`
}

function clock() {
  return new Date().toISOString().slice(11, 23)
}

/**
 * Starts only from a call made in a press handler. Nothing is recorded or sent by this app.
 * Every event is checked against the current recognizer, so a late event from an earlier one cannot change
 * the state of the new one. After Stop the state is 'stopping' until that recognizer ends, and a new start
 * waits for it. Each event of each recognizer goes into a log that can be copied.
 */
export interface HeardResult {
  transcript: string
  isFinal: boolean
}

/** What a user of the hook wants to know besides the display text. */
export interface RecognitionListeners {
  /** Every result of the current recognizer so far (in continuous mode they pile up), at each result event. */
  onResults?: (results: HeardResult[]) => void
  /** The recognizer is over. `requested` is false when the browser ended it on its own (or with an error). */
  onEnd?: (info: { requested: boolean }) => void
  /** Each of start, audiostart, soundstart, speechstart… as it happens (the name without `on`). */
  onEvent?: (name: string) => void
}

export function useSpeechRecognition(lang: string, variant: Variant = 'A', listeners?: RecognitionListeners) {
  const listenersRef = useRef(listeners)
  useEffect(() => {
    listenersRef.current = listeners
  })
  const stopRequested = useRef(false)
  const [state, setState] = useState<RecognitionState>('idle')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [log, setLog] = useState<string[]>([])
  const ref = useRef<RecognitionLike | null>(null)
  const reusable = useRef<RecognitionLike | null>(null)
  const ids = useRef(new Map<RecognitionLike, number>())
  const nextId = useRef(1)
  const offset = useRef(0)
  const length = useRef(0)
  const stopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const variantRef = useRef(variant)
  useEffect(() => {
    variantRef.current = variant
  }, [variant])
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pending = useRef(false)
  const [streamHeld, setStreamHeld] = useState(false)
  const supported = typeof window !== 'undefined' && getRecognitionConstructor() !== undefined

  const note = useCallback((line: string) => setLog((prev) => [...prev.slice(-(logLimit - 1)), `${clock()} ${line}`]), [])

  const destroyFrame = useCallback(() => {
    frameRef.current?.remove()
    frameRef.current = null
  }, [])

  // The microphone stream of variant G is closed only when asked, or when the page is left.
  const releaseMicrophone = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return
    stream.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setStreamHeld(false)
    note('G: microphone stream released')
  }, [note])
  const tag = (recognition: RecognitionLike) => `#${ids.current.get(recognition) ?? '?'}`

  const finish = useCallback(
    (recognition: RecognitionLike) => {
      if (ref.current !== recognition) return
      clearTimeout(stopTimer.current)
      if (variantRef.current === 'F') setTimeout(destroyFrame, 0)
      if (variantRef.current === 'G') note(`G: stream after the end: ${streamInfo(streamRef.current)}`)
      listenersRef.current?.onEnd?.({ requested: stopRequested.current })
      if (variantRef.current === 'E') {
        // The next recognizer may only start a little after this one ended.
        setState('stopping')
        clearTimeout(cooldownTimer.current)
        cooldownTimer.current = setTimeout(() => {
          if (ref.current === recognition) {
            ref.current = null
            setState('idle')
          }
        }, cooldownMs)
        return
      }
      ref.current = null
      setState('idle')
    },
    [destroyFrame, note],
  )

  const create = useCallback(
    (Ctor: RecognitionConstructor) => {
      if (variantRef.current === 'C' && reusable.current) return reusable.current
      const recognition = new Ctor()
      ids.current.set(recognition, nextId.current++)
      const id = tag(recognition)
      note(`${id} new recognizer`)
      for (const name of plainEvents) {
        ;(recognition as unknown as Record<string, unknown>)[`on${name}`] = () => {
          note(`${id} on${name}`)
          listenersRef.current?.onEvent?.(name)
        }
      }
      recognition.onresult = (event) => {
        const last = event.results[event.results.length - 1]
        const heard = Array.from({ length: Math.max(0, event.results.length - offset.current) }, (_, k) => event.results[offset.current + k][0].transcript)
          .join(' ')
          .trim()
        length.current = event.results.length
        note(`${id} onresult n=${event.results.length} final=${last?.isFinal ?? '?'} "${last?.[0].transcript ?? ''}"`)
        if (ref.current === recognition) setText(heard)
        listenersRef.current?.onResults?.(Array.from({ length: event.results.length }, (_, k) => ({ transcript: event.results[k][0].transcript, isFinal: event.results[k].isFinal })))
      }
      recognition.onerror = (event) => {
        note(`${id} onerror ${event.error}`)
        if (ref.current !== recognition) return
        setError(recognitionErrorMessage(event.error))
        finish(recognition)
      }
      recognition.onend = () => {
        note(`${id} onend${ref.current === recognition ? '' : ' (not the current one)'}`)
        finish(recognition)
      }
      if (variantRef.current === 'C') reusable.current = recognition
      return recognition
    },
    [finish, note],
  )

  const begin = useCallback(() => {
    let Ctor = getRecognitionConstructor()
    if (variantRef.current === 'F') {
      destroyFrame()
      const frame = document.createElement('iframe')
      frame.setAttribute('aria-hidden', 'true')
      frame.tabIndex = -1
      frame.title = 'speech'
      frame.setAttribute('allow', 'microphone')
      frame.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden'
      document.body.appendChild(frame)
      frameRef.current = frame
      const w = frame.contentWindow as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor; navigator?: Navigator } | null
      Ctor = w?.SpeechRecognition ?? w?.webkitSpeechRecognition
      note(`F: new hidden frame; user activation: page ${activation(navigator)}, frame ${activation(w?.navigator)}; recognizer in the frame: ${Ctor ? 'yes' : 'NO'}`)
      if (!Ctor) {
        destroyFrame()
        setError('The hidden frame has no speech recognition on this browser.')
        setState('idle')
        return
      }
    }
    if (!Ctor) return
    const recognition = create(Ctor)
    recognition.lang = lang
    recognition.continuous = variantRef.current === 'D'
    recognition.interimResults = true
    ref.current = recognition
    stopRequested.current = false
    offset.current = 0
    length.current = 0
    setText('')
    setError('')
    try {
      if (variantRef.current === 'G') note(`G: stream before start: ${streamInfo(streamRef.current)}`)
      note(`${tag(recognition)} start() called (variant ${variantRef.current}, lang ${lang}, continuous ${recognition.continuous})`)
      recognition.start()
      setState('listening')
    } catch (e) {
      ref.current = null
      setState('idle')
      note(`${tag(recognition)} start() threw: ${e instanceof Error ? e.message : String(e)}`)
      setError(e instanceof Error ? e.message : 'Could not start recognition.')
    }
  }, [create, destroyFrame, lang, note])

  const start = useCallback(() => {
    // A recognizer that is still stopping is waited for: starting another one then often fails silently.
    if (ref.current || pending.current) {
      note('start ignored: the last recognizer has not ended yet')
      return
    }
    if (variantRef.current === 'G' && !streamRef.current) {
      if (!navigator.mediaDevices?.getUserMedia) {
        note('G: this browser has no getUserMedia')
        setError('This browser cannot open the microphone for this test.')
        return
      }
      pending.current = true
      setState('starting')
      setError('')
      note(`G: getUserMedia({audio:true}) called, user activation ${activation(navigator)}`)
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          pending.current = false
          if (variantRef.current !== 'G') {
            stream.getTracks().forEach((t) => t.stop())
            setState('idle')
            return
          }
          streamRef.current = stream
          setStreamHeld(true)
          for (const track of stream.getTracks()) {
            track.addEventListener?.('ended', () => note('G: stream track ended'))
            track.addEventListener?.('mute', () => note('G: stream track muted'))
            track.addEventListener?.('unmute', () => note('G: stream track unmuted'))
          }
          note(`G: microphone stream open (${streamInfo(stream)}); user activation now ${activation(navigator)}`)
          begin()
        })
        .catch((e: unknown) => {
          pending.current = false
          setState('idle')
          note(`G: getUserMedia failed: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`)
          setError('The microphone could not be opened (refused, or not available).')
        })
      return
    }
    begin()
  }, [begin, note])

  const stop = useCallback(() => {
    const recognition = ref.current
    if (!recognition) return
    stopRequested.current = true
    setState('stopping')
    clearTimeout(stopTimer.current)
    stopTimer.current = setTimeout(() => {
      note(`${tag(recognition)} no end within ${stopTimeoutMs} ms, taken as ended`)
      finish(recognition)
    }, stopTimeoutMs)
    try {
      if (variantRef.current === 'B') {
        note(`${tag(recognition)} abort() called`)
        recognition.abort()
      } else {
        note(`${tag(recognition)} stop() called`)
        recognition.stop()
      }
    } catch (e) {
      note(`${tag(recognition)} stop/abort threw: ${e instanceof Error ? e.message : String(e)}`)
      finish(recognition)
    }
  }, [finish, note])

  // Empties the display; in continuous mode what was said before is skipped from then on.
  const clear = useCallback(() => {
    offset.current = length.current
    setText('')
    note('display cleared')
  }, [note])

  const clearLog = useCallback(() => setLog([]), [])

  // A recognizer kept for reuse belongs to one way of driving it.
  useEffect(() => {
    reusable.current = null
    if (variant !== 'G') releaseMicrophone()
  }, [variant, releaseMicrophone])

  useEffect(
    () => () => {
      clearTimeout(stopTimer.current)
      clearTimeout(cooldownTimer.current)
      const recognition = ref.current
      ref.current = null
      recognition?.abort()
      frameRef.current?.remove()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    },
    [],
  )

  return { supported, state, text, error, log, start, stop, clear, clearLog, note, streamHeld, releaseMicrophone }
}
