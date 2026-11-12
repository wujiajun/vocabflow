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

// Browsers (iPhone above all) let the page start audio only from inside a press, and typing a letter is not one:
// the field's input event does not count. A game whose sounds come from typing calls this from a press (Start,
// Next, a tap on the letters) so the sound that follows a typed letter is allowed. It plays one silent sample.
export function unlockGameSound() {
  const sound = audio()
  if (!sound) {
    return
  }
  try {
    const source = sound.createBufferSource()
    source.buffer = sound.createBuffer(1, 1, 22050)
    source.connect(sound.destination)
    source.start(0)
  } catch {
    // The sound then plays only if the browser allows it anyway.
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

// A short, bright two-note "ding": plainly "yes", and not loud.
export function playRight() {
  if (!getGameSound()) {
    return
  }

  const sound = audio()
  if (!sound) {
    return
  }

  const start = sound.currentTime
  const oscillator = sound.createOscillator()
  const volume = sound.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(660, start)
  oscillator.frequency.setValueAtTime(880, start + 0.09)
  volume.gain.setValueAtTime(0.0001, start)
  volume.gain.linearRampToValueAtTime(0.1, start + 0.02)
  volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.3)
  oscillator.connect(volume)
  volume.connect(sound.destination)
  oscillator.start(start)
  oscillator.stop(start + 0.32)
}

// Two soft blips for spoken practice: rising when the phone starts listening ("speak now"), falling when it has
// stopped by itself. Web Audio, not an audio element: on iOS 27 an audio element that plays leaves the next speech
// recognizer deaf (WebKit bug 321436), while Web Audio beeps are reported not to.
function blip(from: number, to: number) {
  if (!getGameSound()) {
    return
  }
  const sound = audio()
  if (!sound) {
    return
  }
  const start = sound.currentTime
  const oscillator = sound.createOscillator()
  const volume = sound.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(from, start)
  oscillator.frequency.exponentialRampToValueAtTime(to, start + 0.12)
  volume.gain.setValueAtTime(0.0001, start)
  volume.gain.linearRampToValueAtTime(0.09, start + 0.015)
  volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.18)
  oscillator.connect(volume)
  volume.connect(sound.destination)
  oscillator.start(start)
  oscillator.stop(start + 0.2)
}

export function playListenStart() {
  blip(520, 880)
}

export function playListenEnd() {
  blip(880, 520)
}
