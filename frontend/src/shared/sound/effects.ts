const key = 'vocabflow.gameSound'

// Sounds made in the browser, so there are no files to load (and the CSP, which only allows our own
// files, has nothing to object to).
type AudioContextConstructor = typeof AudioContext

let context: AudioContext | undefined

function audio() {
  try {
    const Constructor: AudioContextConstructor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext
    if (!Constructor) {
      return undefined
    }
    // Made on first use, which is inside a press: browsers keep audio silent until the page has had one.
    context ??= new Constructor()
    if (context.state === 'suspended') {
      void context.resume()
    }
    return context
  } catch {
    return undefined
  }
}

// Whether the games make sounds. On unless turned off; kept in this browser.
export function getGameSound() {
  try {
    return window.localStorage.getItem(key) !== 'off'
  } catch {
    return true
  }
}

export function setGameSound(on: boolean) {
  try {
    window.localStorage.setItem(key, on ? 'on' : 'off')
  } catch {
    // The choice then lasts only until the page is closed.
  }
}

// A short, low, falling buzz: plainly "no", and not loud. Where the phone supports it, it also buzzes.
export function playWrong() {
  if (!getGameSound()) {
    return
  }

  navigator.vibrate?.(90)
  const sound = audio()
  if (!sound) {
    return
  }

  const start = sound.currentTime
  const oscillator = sound.createOscillator()
  const volume = sound.createGain()
  oscillator.type = 'square'
  oscillator.frequency.setValueAtTime(220, start)
  oscillator.frequency.exponentialRampToValueAtTime(110, start + 0.25)
  volume.gain.setValueAtTime(0.0001, start)
  volume.gain.linearRampToValueAtTime(0.12, start + 0.02)
  volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.3)
  oscillator.connect(volume)
  volume.connect(sound.destination)
  oscillator.start(start)
  oscillator.stop(start + 0.32)
}
