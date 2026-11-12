import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { currentVoiceAccent, isSpeechSupported, speakText, stopSpeaking, type VoiceAccent } from './pronunciation'

function subscribeToVoices(onChange: () => void) {
  if (!isSpeechSupported()) {
    return () => {}
  }

  const synth = window.speechSynthesis
  synth.addEventListener('voiceschanged', onChange)
  return () => synth.removeEventListener('voiceschanged', onChange)
}

export function useVoiceAccent(): VoiceAccent {
  return useSyncExternalStore(subscribeToVoices, currentVoiceAccent, () => 'unknown')
}

// getVoices() may hand back a new list on every call; the same voices must give the same snapshot.
let lastVoices: readonly SpeechSynthesisVoice[] = []
let lastKey = ''
const noVoices: readonly SpeechSynthesisVoice[] = []
function voicesSnapshot() {
  if (!isSpeechSupported()) return noVoices
  const voices = window.speechSynthesis.getVoices()
  const key = voices.map((voice) => `${voice.voiceURI}|${voice.lang}`).join('\n')
  if (key !== lastKey) {
    lastKey = key
    lastVoices = voices
  }
  return lastVoices
}

/** This device's voices, kept up to date as the browser loads them. */
export function useVoices(): readonly SpeechSynthesisVoice[] {
  return useSyncExternalStore(subscribeToVoices, voicesSnapshot, () => noVoices)
}

export function usePronunciation(text: string) {
  const [speaking, setSpeaking] = useState(false)
  const speakingRef = useRef(false)
  const accent = useVoiceAccent()
  const supported = isSpeechSupported()

  const setSpeakingState = useCallback((value: boolean) => {
    speakingRef.current = value
    setSpeaking(value)
  }, [])

  const toggle = useCallback(() => {
    if (speakingRef.current) {
      stopSpeaking()
      setSpeakingState(false)
      return
    }

    speakText(text, { onStart: () => setSpeakingState(true), onEnd: () => setSpeakingState(false) })
  }, [setSpeakingState, text])

  // Leaving the page must not leave a word being read out.
  useEffect(
    () => () => {
      if (speakingRef.current) {
        stopSpeaking()
      }
    },
    [],
  )

  return { supported, speaking, accent, toggle }
}
