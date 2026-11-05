import { PronounceButton } from '../../../shared/speech/PronounceButton'
import type { VocabularySense } from '../types/vocabulary'
import { TappableText } from './TappableText'

// The part of an entry a learner leans on to remember the word: emoji that show a scene, the scene
// in one plain sentence, and how the word is built. It sits right under the definition on a tinted
// card so it reads apart from the lists below. `parts` is written for the whole word (on its first
// meaning), so the caller passes it in for every meaning.
export function MemoryHook({
  sense,
  parts,
  speak,
  headingLevel: Heading,
}: {
  sense: VocabularySense
  parts: string | null | undefined
  speak: boolean
  headingLevel: 'h2' | 'h3'
}) {
  const { scene, emoji } = sense
  if (!scene && !emoji && !parts) {
    return null
  }

  return (
    <section className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
      <Heading className="text-sm font-semibold tracking-wide text-indigo-900 uppercase">Memory hook</Heading>
      {emoji ? <p className="mt-2 text-4xl leading-none">{emoji}</p> : null}
      {scene ? (
        <div className="mt-3 flex items-start gap-1">
          <p className="min-w-0 flex-1 text-lg leading-7 font-medium text-indigo-950">
            <TappableText text={scene} />
          </p>
          {speak ? (
            <span className="-my-2 shrink-0">
              <PronounceButton term={scene} />
            </span>
          ) : null}
        </div>
      ) : null}
      {parts ? (
        <p className="mt-3 text-sm leading-6 text-indigo-900">
          <span className="font-semibold">Word parts: </span>
          {parts}
        </p>
      ) : null}
    </section>
  )
}
