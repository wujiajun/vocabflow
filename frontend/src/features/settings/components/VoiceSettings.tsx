import { useState } from 'react'
import {
  chooseSecondVoice,
  chooseVoice,
  getVoiceChoice,
  isAppleMobile,
  isUsableVoice,
  setVoiceChoice,
  speakText,
  systemVoice,
  voiceQuality,
  type VoiceRole,
} from '../../../shared/speech/pronunciation'
import { useVoices } from '../../../shared/speech/usePronunciation'

const samples: Record<VoiceRole, string> = {
  first: 'Good morning, this is the rental office. How can I help you?',
  second: 'Hi, I’m calling about the apartment for rent. Is it still available?',
}

const qualityTag = ['', 'Enhanced', 'Premium'] as const

/** "Ava (Premium) · en-US": the quality is added when the name does not already say it. */
function voiceLabel(voice: SpeechSynthesisVoice) {
  const tag = qualityTag[voiceQuality(voice)]
  const name = tag && !voice.name.toLowerCase().includes(tag.toLowerCase()) ? `${voice.name} (${tag})` : voice.name
  return `${name} · ${voice.lang.replace('_', '-')}`
}

const selectClass =
  'mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200'
const playClass =
  'inline-flex min-h-11 shrink-0 items-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700'

// Which of this device's voices reads aloud, and which plays the other person in a conversation.
export function VoiceSettings() {
  const voices = useVoices()
  const [picked, setPicked] = useState<Record<VoiceRole, string>>(() => ({
    first: getVoiceChoice('first'),
    second: getVoiceChoice('second'),
  }))
  const english = voices
    .filter(isUsableVoice)
    .sort(
      (a, b) =>
        voiceQuality(b) - voiceQuality(a) ||
        Number(b.lang.replace('_', '-') === 'en-US') - Number(a.lang.replace('_', '-') === 'en-US') ||
        a.name.localeCompare(b.name),
    )
  const automatic: Record<VoiceRole, SpeechSynthesisVoice | undefined> = {
    first: chooseVoice(voices, '').voice,
    second: chooseSecondVoice(voices, ''),
  }
  const hasNatural = english.some((voice) => voiceQuality(voice) > 0)

  function pick(role: VoiceRole, uri: string) {
    setVoiceChoice(role, uri)
    setPicked((current) => ({ ...current, [role]: uri }))
  }

  if (english.length === 0) return null

  return (
    <div className="mt-4">
      {(['first', 'second'] as const).map((role) => {
        const id = `settings-voice-${role}`
        const auto = automatic[role]
        // A choice this device no longer has shows as automatic.
        const value =
          (role === 'first' && picked[role] === systemVoice) || english.some((voice) => voice.voiceURI === picked[role])
            ? picked[role]
            : ''
        return (
          <div className={role === 'second' ? 'mt-3' : undefined} key={role}>
            <label className="block text-sm font-medium text-slate-800" htmlFor={id}>
              {role === 'first' ? 'Voice' : 'Your lines in conversations'}
            </label>
            <div className="flex items-end gap-2">
              <select className={selectClass} id={id} onChange={(event) => pick(role, event.target.value)} value={value}>
                <option value="">
                  {auto
                    ? `Automatic (${voiceLabel(auto)})`
                    : role === 'first'
                      ? 'Automatic (this phone’s own English voice)'
                      : 'Automatic (same voice, lower)'}
                </option>
                {role === 'first' && !isAppleMobile() ? <option value={systemVoice}>This phone’s own English voice</option> : null}
                {english.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voiceLabel(voice)}
                  </option>
                ))}
              </select>
              <button
                aria-label={role === 'first' ? 'Play the voice' : 'Play the voice of your lines'}
                className={playClass}
                onClick={() => speakText(samples[role], { role, onStart: () => undefined, onEnd: () => undefined })}
                type="button"
              >
                ▶ Play
              </button>
            </div>
          </div>
        )
      })}
      <p className="mt-2 text-sm leading-6 text-slate-600">
        In a conversation the other person speaks with Voice, and your own lines, when read to you, with the second.{' '}
        {isAppleMobile()
          ? 'On this phone, Automatic uses the English voice chosen in Settings → Accessibility → Spoken Content → Voices → English; a downloaded Premium or Enhanced voice there sounds the most natural, though it is not listed here.'
          : hasNatural
            ? 'Premium and Enhanced voices sound the most natural.'
            : 'This device has no Premium or Enhanced English voice yet.'}
      </p>
    </div>
  )
}
