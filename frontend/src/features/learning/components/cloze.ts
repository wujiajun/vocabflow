import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'
import { findTerm, maskTerm, shuffle } from './matching'

export const blank = '_____'
export const maxQuestions = 10
export const minQuestions = 3

export interface BlankQuestion {
  id: number
  term: string
  // The example sentence in two halves, with the word left out between them as it was written there.
  before: string
  after: string
  form: string
  // The meaning of that sentence, with the word itself hidden, and the sense's emoji if it has one.
  meaning: string
  emoji: string | null
}

// One question per word, from a random example of a random meaning: an example is a sentence the
// learner has seen, so it is the context the word is recalled in. Words with no example that shows
// the word (or a form of it) are left out.
export function buildBlanks(entries: readonly VocabularyEntry[], random: () => number = Math.random): BlankQuestion[] {
  const questions: BlankQuestion[] = []

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
    questions.push({
      id: entry.id,
      term: entry.term,
      before: example.slice(0, found.index),
      after: maskTerm(example.slice(found.index + found.form.length), [entry.term, entry.baseForm]),
      form: found.form,
      meaning: maskTerm(sense.definition, [entry.term, entry.baseForm]),
      emoji: sense.emoji ?? null,
    })
  }

  return shuffle(questions, random).slice(0, maxQuestions)
}

function normalize(text: string) {
  return text
    .normalize('NFC')
    .replaceAll('’', "'")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' -]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// The form in the sentence, or the word as it is listed: "walk" is not marked wrong for "walked".
export function isRight(answer: string, question: BlankQuestion) {
  const given = normalize(answer)
  return given !== '' && (given === normalize(question.form) || given === normalize(question.term))
}
