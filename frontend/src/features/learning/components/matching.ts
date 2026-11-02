import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'

export interface MatchPair {
  id: number
  term: string
  // The meaning with the word itself blanked out, so it does not give the answer away.
  definition: string
}

// Words in a round, and words in a game: the game is one or two rounds.
export const roundSize = 5
export const maxPairs = 10
export const minPairs = 5
// Characters: about two lines on a phone.
const shortMeaning = 90

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}

const blank = '_____'

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// The forms a word is likely to take in its own meaning: "lease" hides "leased", "leases" and "leasing",
// "carry" hides "carries" and "carried", and a phrase is hidden as it stands (its first word bending).
function endings(term: string) {
  const forms = [`${escapeRegExp(term)}(?:s|es|d|ed|ing)?`]
  if (/[^aeiou]e$/i.test(term)) {
    forms.push(`${escapeRegExp(term.slice(0, -1))}ing`)
  } else if (/[^aeiou]y$/i.test(term)) {
    forms.push(`${escapeRegExp(term.slice(0, -1))}i(?:es|ed)`)
  }
  return forms.join('|')
}

export function maskTerm(definition: string, terms: (string | null)[]) {
  const wanted = [...new Set(terms.filter((term): term is string => Boolean(term?.trim())).map((term) => term.trim()))].sort(
    (first, second) => second.length - first.length,
  )
  return wanted.reduce(
    (text, term) => text.replace(new RegExp(`(?<![\\w])(?:${endings(term)})(?![\\w])`, 'gi'), blank),
    definition,
  )
}

// One meaning per word, picked at random: a word with several is practised on a different one each time.
// Words without a meaning, and meanings that read the same as one already taken, are left out.
export function buildPairs(entries: readonly VocabularyEntry[], random: () => number = Math.random): MatchPair[] {
  const pairs: MatchPair[] = []
  const taken = new Set<string>()

  for (const entry of entries) {
    const definitions =
      entry.senses.length > 0 ? entry.senses.map((sense) => sense.definition) : entry.definition ? [entry.definition] : []
    const usable = definitions.filter((definition) => definition.trim() !== '')
    if (usable.length === 0) {
      continue
    }

    // A long meaning makes a tall card, and five of them push the words off a phone's screen, so a short
    // one is taken when the word has one.
    const short = usable.filter((definition) => definition.length <= shortMeaning)
    const choices = short.length > 0 ? short : usable
    const definition = maskTerm(choices[Math.floor(random() * choices.length)], [entry.term, entry.baseForm])
    if (taken.has(definition.toLowerCase())) {
      continue
    }
    taken.add(definition.toLowerCase())
    pairs.push({ id: entry.id, term: entry.term, definition })
  }

  return pairs
}

// Up to ten words in as few rounds as hold them, shared out evenly (7 words are 4 and 3, never 5 and 2).
export function planRounds(pairs: readonly MatchPair[]): MatchPair[][] {
  const chosen = pairs.slice(0, maxPairs)
  const rounds = Math.ceil(chosen.length / roundSize)
  const plan: MatchPair[][] = []
  let start = 0

  for (let round = 0; round < rounds; round += 1) {
    const size = Math.ceil((chosen.length - start) / (rounds - round))
    plan.push(chosen.slice(start, start + size))
    start += size
  }

  return plan
}
