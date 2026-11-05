import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'
import { findTerm, type MatchPair, maskTerm, shuffle } from './matching'

export const blank = '_____'
export const maxQuestions = 10
export const minQuestions = 4

// One sentence per word, from a random example of a random meaning: an example is a sentence the
// learner has seen, so it is the context the word is placed in. The word, or a form of it, is left out
// of the sentence and out of the meaning that serves as the clue, and the sentence with the word in
// place shows once the sound is put on it. Words with no example that shows the word are left out, and
// so are sentences that read the same as one already taken.
export function buildSoundPairs(entries: readonly VocabularyEntry[], random: () => number = Math.random): MatchPair[] {
  const pairs: MatchPair[] = []
  const taken = new Set<string>()

  for (const entry of entries) {
    const options = entry.senses.flatMap((sense) =>
      (sense.examples ?? []).flatMap((example) => {
        const found = findTerm(example, [entry.term, entry.baseForm])
        return found ? [{ sense, example, found }] : []
      }),
    )
    if (options.length === 0) {
      continue
    }
    const { sense, example, found } = options[Math.floor(random() * options.length)]
    const sentence =
      example.slice(0, found.index) + blank + maskTerm(example.slice(found.index + found.form.length), [entry.term, entry.baseForm])
    if (taken.has(sentence.toLowerCase())) {
      continue
    }
    taken.add(sentence.toLowerCase())
    const meaning = maskTerm(sense.definition, [entry.term, entry.baseForm])
    pairs.push({
      id: entry.id,
      term: entry.term,
      definition: sentence,
      hint: `${sense.emoji ? `${sense.emoji} ` : ''}${meaning}`,
      filled: example,
    })
  }

  return shuffle(pairs, random).slice(0, maxQuestions)
}
