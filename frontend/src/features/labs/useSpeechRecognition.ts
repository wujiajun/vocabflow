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

export type RecognitionState = 'idle' | 'listening'

/** Starts only from a call made in a press handler. Nothing is recorded or sent by this app. */
export function useSpeechRecognition(lang: string) {
  const [state, setState] = useState<RecognitionState>('idle')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const ref = useRef<RecognitionLike | null>(null)
  const supported = typeof window !== 'undefined' && getRecognitionConstructor() !== undefined

  const start = useCallback(() => {
    const Ctor = getRecognitionConstructor()
    if (!Ctor) return
    ref.current?.abort()
    const recognition = new Ctor()
    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let heard = ''
      for (let i = 0; i < event.results.length; i++) heard += `${event.results[i][0].transcript} `
      setText(heard.trim())
    }
    recognition.onerror = (event) => setError(recognitionErrorMessage(event.error))
    recognition.onend = () => {
      setState('idle')
      if (ref.current === recognition) ref.current = null
    }
    ref.current = recognition
    setText('')
    setError('')
    try {
      recognition.start()
      setState('listening')
    } catch (e) {
      ref.current = null
      setError(e instanceof Error ? e.message : 'Could not start recognition.')
    }
  }, [lang])

  const stop = useCallback(() => ref.current?.stop(), [])

  useEffect(() => () => ref.current?.abort(), [])

  return { supported, state, text, error, start, stop }
}
