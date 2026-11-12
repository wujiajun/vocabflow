import { useState } from 'react'
import {
  chooseSecondVoice,
  chooseVoice,
  getVoiceChoice,
  isUsableVoice,
  setVoiceChoice,
  speakText,
  voiceQuality,
  type VoiceRole,
} from '../../../shared/speech/pronunciation'
import { useVoices } from '../../../shared/speech/usePronunciation'

const samples: Record<VoiceRole, string> = {
  first: 'Hi, I’m calling about the apartment for rent. Is it still available?',
  second: 'Yes, it is. Would you like to come and see it this weekend?',
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
        const value = english.some((voice) => voice.voiceURI === picked[role]) ? picked[role] : ''
        return (
          <div className={role === 'second' ? 'mt-3' : undefined} key={role}>
            <label className="block text-sm font-medium text-slate-800" htmlFor={id}>
              {role === 'first' ? 'Voice' : 'Other person in conversations'}
            </label>
            <div className="flex items-end gap-2">
              <select className={selectClass} id={id} onChange={(event) => pick(role, event.target.value)} value={value}>
                <option value="">{auto ? `Automatic (${voiceLabel(auto)})` : 'Automatic (same voice, lower)'}</option>
                {english.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voiceLabel(voice)}
                  </option>
                ))}
              </select>
              <button
                aria-label={role === 'first' ? 'Play the voice' : 'Play the other person’s voice'}
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
        {hasNatural
          ? 'Premium and Enhanced voices sound the most natural. '
          : 'This device has no Premium or Enhanced English voice yet. '}
        On an iPhone, download one in Settings → Accessibility → Spoken Content → Voices → English (for example Ava or Zoe,
        Premium), then close VocabFlow and open it again.
      </p>
    </div>
  )
}
