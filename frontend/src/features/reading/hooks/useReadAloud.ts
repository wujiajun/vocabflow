import { useCallback, useEffect, useRef, useState } from 'react'
import { chooseVoice, isSpeechSupported } from '../../../shared/speech/pronunciation'
import { useVoiceAccent } from '../../../shared/speech/usePronunciation'

export type ReadAloudState = 'idle' | 'playing' | 'paused'
export type ReadingSpeed = 'normal' | 'slow'

const rates: Record<ReadingSpeed, number> = { normal: 0.9, slow: 0.7 }
const speedKey = 'vocabflow.readingSpeed'

function savedSpeed(): ReadingSpeed {
  try {
    return window.localStorage.getItem(speedKey) === 'slow' ? 'slow' : 'normal'
  } catch {
    return 'normal'
  }
}

// Reads the sentences aloud one after another with the browser's voice. A long text handed over in
// one piece is cut off by some browsers, and pausing the browser's own queue is unreliable, so each
// sentence is its own utterance and pausing stops the current one and starts it again on resume.
export function useReadAloud(sentences: string[]) {
  const [state, setState] = useState<ReadAloudState>('idle')
  const [current, setCurrent] = useState<number | null>(null)
  const [speed, setSpeedState] = useState<ReadingSpeed>(savedSpeed)
  const accent = useVoiceAccent()
  const supported = isSpeechSupported()
  // Bumped whenever reading is stopped or restarted, so that the events of an utterance that was
  // cancelled are ignored.
  const run = useRef(0)
  const index = useRef(0)
  const stateRef = useRef<ReadAloudState>('idle')
  const speedRef = useRef(speed)

  const update = useCallback((next: ReadAloudState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const finish = useCallback(() => {
    index.current = 0
    setCurrent(null)
    update('idle')
  }, [update])

  const speakFrom = useCallback(
    (start: number) => {
      const synth = window.speechSynthesis
      synth.cancel()
      const token = ++run.current

      function speak(position: number) {
        if (token !== run.current) {
          return
        }
        if (position >= sentences.length) {
          finish()
          return
        }
        index.current = position
        setCurrent(position)
        const { voice } = chooseVoice(synth.getVoices())
        const utterance = new SpeechSynthesisUtterance(sentences[position])
        utterance.lang = voice?.lang ?? 'en-US'
        if (voice) {
          utterance.voice = voice
        }
        utterance.rate = rates[speedRef.current]
        utterance.onend = () => speak(position + 1)
        utterance.onerror = () => {
          if (token === run.current) {
            run.current += 1
            finish()
          }
        }
        synth.speak(utterance)
      }

      update('playing')
      speak(start)
    },
    [finish, sentences, update],
  )

  const start = useCallback(() => speakFrom(0), [speakFrom])

  const pause = useCallback(() => {
    run.current += 1
    window.speechSynthesis.cancel()
    update('paused')
  }, [update])

  const resume = useCallback(() => speakFrom(index.current), [speakFrom])

  const stop = useCallback(() => {
    run.current += 1
    window.speechSynthesis.cancel()
    finish()
  }, [finish])

  const setSpeed = useCallback(
    (next: ReadingSpeed) => {
      speedRef.current = next
      setSpeedState(next)
      try {
        window.localStorage.setItem(speedKey, next)
      } catch {
        // The choice then lasts only for this visit.
      }
      // Reading carries on from the start of the sentence it is in, at the new speed.
      if (stateRef.current === 'playing') {
        speakFrom(index.current)
      }
    },
    [speakFrom],
  )

  // Leaving the page must not leave it reading to an empty screen.
  useEffect(
    () => () => {
      if (stateRef.current !== 'idle') {
        run.current += 1
        window.speechSynthesis.cancel()
      }
    },
    [],
  )

  return { supported, state, current, speed, accent, start, pause, resume, stop, setSpeed }
}
