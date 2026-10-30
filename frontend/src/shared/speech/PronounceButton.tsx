import { usePronunciation } from './usePronunciation'

export function PronounceButton({ term }: { term: string }) {
  const { supported, speaking, accent, toggle } = usePronunciation(term)

  if (!supported) {
    return null
  }

  return (
    <button
      aria-label={`Play pronunciation of ${term}`}
      aria-pressed={speaking}
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 aria-pressed:bg-indigo-50 aria-pressed:text-indigo-700"
      onClick={toggle}
      title={
        accent === 'other'
          ? 'Plays with an English voice; no American English voice was found on this device'
          : 'Play pronunciation'
      }
      type="button"
    >
      <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20">
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </button>
  )
}
