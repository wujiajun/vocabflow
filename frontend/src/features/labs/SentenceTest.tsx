import { useState } from 'react'
import { compareSpeech } from '../../shared/speech/compareSpeech'
import { DiagnosticLog } from './DiagnosticLog'
import { type Variant, useSpeechRecognition, variantLabels } from '../../shared/speech/useSpeechRecognition'

const speechTestSentences = [
  { level: 'Easy', text: 'I would like a cup of coffee, please.' },
  { level: 'Easy', text: 'Where is the nearest bus stop?' },
  { level: 'Medium', text: "I'd like to make an appointment with my family doctor." },
  { level: 'Medium', text: 'Could you tell me how to get to the library?' },
  { level: 'Medium', text: 'My son has a fever and a sore throat.' },
  { level: 'Hard', text: 'I need to renew my health card and my driver’s licence before the end of the month.' },
  { level: 'Hard', text: 'Is there a pharmacy nearby that is open on Sunday afternoon?' },
]

const statusClass = {
  correct: 'bg-emerald-100 text-emerald-900',
  missed: 'bg-amber-100 text-amber-900 line-through',
  wrong: 'bg-rose-100 text-rose-900',
} as const

export function SentenceTest() {
  const [index, setIndex] = useState(0)
  const [lang, setLang] = useState('en-US')
  const [variant, setVariant] = useState<Variant>('A')
  const { supported, state, text, error, log, start, stop, clear, clearLog, note, streamHeld, releaseMicrophone } = useSpeechRecognition(lang, variant)
  const sentence = speechTestSentences[index]
  const comparison = text ? compareSpeech(sentence.text, text) : null
  const secure = window.isSecureContext

  return (
    <div>

      <dl className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <div>Secure page (https): <strong>{secure ? 'yes' : 'no'}</strong></div>
        <div>Speech recognition in this browser: <strong>{supported ? 'available' : 'not available'}</strong></div>
      </dl>
      {!secure && (
        <p className="mt-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="note">
          This page is not on https, so the phone may refuse the microphone.
        </p>
      )}
      {!supported && (
        <p className="mt-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          This browser has no speech recognition. Try Safari (not a home-screen app) or Chrome.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Sentence">
        {speechTestSentences.map((s, i) => (
          <button
            aria-pressed={i === index}
            className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${i === index ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-800'}`}
            key={s.text}
            onClick={() => setIndex(i)}
            type="button"
          >
            {i + 1} · {s.level}
          </button>
        ))}
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        Language
        <select className="min-h-11 rounded-lg border border-slate-300 bg-white px-2" onChange={(e) => setLang(e.target.value)} value={lang}>
          <option value="en-US">en-US</option>
          <option value="en-CA">en-CA</option>
        </select>
      </label>

      <label className="mt-3 flex flex-col gap-1 text-sm text-slate-700">
        Way of listening (for testing)
        <select
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-2"
          disabled={state !== 'idle'}
          onChange={(e) => setVariant(e.target.value as Variant)}
          value={variant}
        >
          {(Object.keys(variantLabels) as Variant[]).map((v) => (
            <option key={v} value={v}>
              {variantLabels[v]}
            </option>
          ))}
        </select>
      </label>

      <p className="mt-4 text-xl font-semibold leading-snug">{sentence.text}</p>

      <button
        className="mt-4 min-h-11 w-full rounded-xl bg-indigo-700 px-4 text-base font-semibold text-white disabled:opacity-50 sm:w-auto"
        disabled={!supported || state === 'stopping' || state === 'starting'}
        onClick={state === 'listening' ? stop : start}
        type="button"
      >
        {state === 'listening' ? 'Stop' : state === 'stopping' || state === 'starting' ? 'Wait…' : 'Start speaking'}
      </button>
      {variant === 'G' && streamHeld && (
        <button className="mt-2 ml-2 min-h-11 rounded-xl bg-slate-100 px-4 text-base font-semibold text-slate-800" onClick={releaseMicrophone} type="button">
          Release microphone
        </button>
      )}
      {variant === 'D' && (
        <button className="mt-2 ml-2 min-h-11 rounded-xl bg-slate-100 px-4 text-base font-semibold text-slate-800" onClick={clear} type="button">
          Clear
        </button>
      )}
      {state === 'listening' && (
        <p className="mt-2 text-sm text-slate-600" role="status">
          {variant === 'D' ? 'Listening… keep talking; tap Clear between sentences.' : 'Listening… read the sentence, then tap Stop.'}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {error}
        </p>
      )}

      {comparison && (
        <section className="mt-4" aria-label="Result">
          <h2 className="text-sm font-semibold text-slate-700">Heard</h2>
          <p className="mt-1" data-testid="heard">{text}</p>
          <h2 className="mt-3 text-sm font-semibold text-slate-700">
            Compared: {comparison.correct} of {comparison.total} words ({Math.round(comparison.share * 100)}%)
          </h2>
          <p className="mt-1 flex flex-wrap gap-1.5 text-lg">
            {comparison.target.map((w, i) => (
              <span className={`rounded px-1.5 py-0.5 ${statusClass[w.status]}`} data-status={w.status} key={i}>
                {w.word}
                {w.heard ? <span className="ml-1 text-xs">({w.heard})</span> : null}
              </span>
            ))}
          </p>
          {comparison.extra.length > 0 && <p className="mt-2 text-sm text-slate-600">Extra words heard: {comparison.extra.join(', ')}</p>}
          <p className="mt-2 text-xs text-slate-500">Green = right, red = a different word heard, struck-through = left out. Capitals and punctuation are ignored.</p>
        </section>
      )}

      <DiagnosticLog lang={lang} lines={log} onClear={clearLog} onNote={note} variant={variant} />
    </div>
  )
}
