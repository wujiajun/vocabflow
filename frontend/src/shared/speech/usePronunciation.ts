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
