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

export type RecognitionState = 'idle' | 'listening' | 'stopping'

// iOS may never send `end` after stop(); after this long the recognizer is taken as finished.
export const stopTimeoutMs = 3000

/**
 * Starts only from a call made in a press handler. Nothing is recorded or sent by this app.
 * Every event is checked against the current instance, so a late event from an earlier one (iOS sends
 * `end` and `error` after the next start) cannot change the state of the new one. After Stop the
 * state is 'stopping' until that instance ends, and a new start waits for it.
 */
export function useSpeechRecognition(lang: string) {
  const [state, setState] = useState<RecognitionState>('idle')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const ref = useRef<RecognitionLike | null>(null)
  const stopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const supported = typeof window !== 'undefined' && getRecognitionConstructor() !== undefined

  const finish = useCallback((recognition: RecognitionLike) => {
    if (ref.current !== recognition) return
    ref.current = null
    clearTimeout(stopTimer.current)
    setState('idle')
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionConstructor()
    // A recognizer that is still stopping is waited for: starting another one then often fails silently.
    if (!Ctor || ref.current) return
    const recognition = new Ctor()
    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onresult = (event) => {
      if (ref.current !== recognition) return
      let heard = ''
      for (let i = 0; i < event.results.length; i++) heard += `${event.results[i][0].transcript} `
      setText(heard.trim())
    }
    recognition.onerror = (event) => {
      if (ref.current !== recognition) return
      setError(recognitionErrorMessage(event.error))
      finish(recognition)
    }
    recognition.onend = () => finish(recognition)
    ref.current = recognition
    setText('')
    setError('')
    try {
      recognition.start()
      setState('listening')
    } catch (e) {
      ref.current = null
      setState('idle')
      setError(e instanceof Error ? e.message : 'Could not start recognition.')
    }
  }, [finish, lang])

  const stop = useCallback(() => {
    const recognition = ref.current
    if (!recognition) return
    setState('stopping')
    clearTimeout(stopTimer.current)
    stopTimer.current = setTimeout(() => finish(recognition), stopTimeoutMs)
    try {
      recognition.stop()
    } catch {
      finish(recognition)
    }
  }, [finish])

  useEffect(
    () => () => {
      clearTimeout(stopTimer.current)
      const recognition = ref.current
      ref.current = null
      recognition?.abort()
    },
    [],
  )

  return { supported, state, text, error, start, stop }
}
