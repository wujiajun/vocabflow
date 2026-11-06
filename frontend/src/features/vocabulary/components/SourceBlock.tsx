import { Link } from 'react-router'
import { PronounceButton } from '../../../shared/speech/PronounceButton'
import type { WordSource } from '../types/vocabulary'
import { TappableText } from './TappableText'

// The sentence the learner met the word in, with the form they tapped in bold. Its words can be
// tapped to add, and it can be read aloud. Not shown for a word that was typed.
export function SourceBlock({ source }: { source: WordSource }) {
  return (
    <section aria-label="Source" className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
      <h2 className="text-xs font-semibold tracking-wide text-indigo-900 uppercase">Source</h2>
      <div className="mt-1 flex items-start gap-1">
        <p className="min-w-0 flex-1 text-lg leading-7 text-slate-800">
          <TappableText emphasis={source.form} sentence={source.sentence} text={source.sentence} />
        </p>
        <span className="-my-1 shrink-0">
          <PronounceButton term={source.sentence} />
        </span>
      </div>
      {source.link ? (
        <Link className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-indigo-800 underline underline-offset-4" to={source.link}>
          {source.title ? `From “${source.title}”` : 'Open the source'}
        </Link>
      ) : source.title ? (
        <p className="mt-1 text-sm text-slate-600">From “{source.title}”</p>
      ) : null}
    </section>
  )
}
