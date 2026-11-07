import type { VocabularyEntry } from '../../vocabulary/types/vocabulary'
import { maskTerm, shuffle } from './matching'

export const minSpellWords = 4
export const maxSpellWords = 6

// A slot is one place in the word: a letter to type, a mark that is filled in (apostrophe, hyphen), or the
// gap between the words of a phrase.
export type Slot = { kind: 'letter'; char: string } | { kind: 'fixed'; char: string } | { kind: 'gap' }

// Letters and digits are typed; everything else (apostrophes, hyphens, dots) is shown as it is.
export function isTyped(char: string) {
  return /[\p{L}\p{N}]/u.test(char)
}

// Capitals and accents do not matter: "Cafe" is right for "café".
function plain(char: string) {
  return char.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function sameLetter(first: string, second: string) {
  return plain(first) === plain(second)
}

export function slotsFor(term: string): Slot[] {
  const slots: Slot[] = []
  for (const char of term.trim()) {
    if (/\s/u.test(char)) {
      if (slots.length > 0 && slots[slots.length - 1].kind !== 'gap') {
        slots.push({ kind: 'gap' })
      }
    } else {
      slots.push(isTyped(char) ? { kind: 'letter', char } : { kind: 'fixed', char })
    }
  }
  return slots
}

export function lettersOf(term: string): string[] {
  return slotsFor(term).flatMap((slot) => (slot.kind === 'letter' ? [slot.char] : []))
}

// What the field holds after a change, and whether a new wrong letter was typed. Each letter is judged the
// moment it is typed. Letters are only added at the end and taken from the end, wherever the caret was. A wrong
// letter stays (red) as the last letter: the next letter typed replaces it, so the learner can simply type again,
// and nothing is ever typed beyond a wrong letter. `composing` is for a keyboard that is still building a word
// (its text is not final yet): the field's text is then read as it stands.
export function applyInput(
  previous: readonly string[],
  value: string,
  answer: readonly string[],
  composing = false,
): { typed: string[]; mistake: boolean } {
  const next = [...value].filter(isTyped)
  const untilWrong = (letters: readonly string[]) => {
    const wrong = check(answer, letters).indexOf(false)
    return letters.slice(0, Math.min(answer.length, wrong === -1 ? letters.length : wrong + 1))
  }
  const endsWrong = (letters: readonly string[]) => letters.length > 0 && !check(answer, letters)[letters.length - 1]

  if (composing) {
    const typed = untilWrong(next)
    return { typed, mistake: typed.length > previous.length && endsWrong(typed) }
  }
  // A shorter field is a deletion; anything else that adds no letter (a symbol typed) changes nothing.
  if ([...value].length < previous.length) {
    return { typed: previous.slice(0, next.length), mistake: false }
  }
  if (next.length <= previous.length) {
    return { typed: [...previous], mistake: false }
  }
  let common = 0
  while (common < previous.length && previous[common] === next[common]) {
    common += 1
  }
  // Inserted text is taken as typed at the end, whichever place in the field it landed.
  const added = next.slice(common, common + (next.length - previous.length))
  const wrongAt = check(answer, previous).indexOf(false)
  const base = wrongAt === -1 ? [...previous] : previous.slice(0, wrongAt)
  const typed = untilWrong([...base, ...added])
  return { typed, mistake: typed.length > base.length && endsWrong(typed) }
}

// Which of the typed letters are right, one per typed letter.
export function check(answer: readonly string[], typed: readonly string[]): boolean[] {
  return typed.map((char, index) => index < answer.length && sameLetter(char, answer[index]))
}

export function isComplete(answer: readonly string[], typed: readonly string[]) {
  return typed.length === answer.length && check(answer, typed).every(Boolean)
}

// Three stars for a word without a mistake, two for one or two, one for more; a shown letter costs one, but a
// word that was spelled is never worth less than one. A skipped word earns none.
export function starsFor({ mistakes, hints, skipped }: { mistakes: number; hints: number; skipped: boolean }) {
  if (skipped) {
    return 0
  }
  const base = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1
  return Math.max(1, base - hints)
}

export interface SpellItem {
  id: number
  term: string
  // The clues: the meaning with the word hidden, and the memory hook of that meaning when it has one.
  definition: string
  emoji: string | null
  scene: string | null
  parts: string | null
}

// Which of today's words are played: the ones with something to spell and a meaning to show. Kept apart so that
// the choice can change later (for example to start with the hard words).
export function pickSpellWords(entries: readonly VocabularyEntry[], random: () => number = Math.random): VocabularyEntry[] {
  return shuffle(
    entries.filter((entry) => entry.enrichmentStatus === 'COMPLETED' && lettersOf(entry.term).length >= 2 && hasMeaning(entry)),
    random,
  ).slice(0, maxSpellWords)
}

function hasMeaning(entry: VocabularyEntry) {
  return entry.senses.some((sense) => sense.definition.trim() !== '') || Boolean(entry.definition?.trim())
}

export function buildSpellItems(entries: readonly VocabularyEntry[], random: () => number = Math.random): SpellItem[] {
  const picked = pickSpellWords(entries, random)
  if (picked.length < minSpellWords) {
    return []
  }

  return picked.map((entry) => {
    const senses = entry.senses.filter((sense) => sense.definition.trim() !== '')
    // A meaning with a memory hook is taken when the word has one, so the hook is there to open.
    const hooked = senses.filter((sense) => sense.scene || sense.emoji)
    const pool = hooked.length > 0 ? hooked : senses
    const sense = pool.length > 0 ? pool[Math.floor(random() * pool.length)] : null
    const hide = (text: string | null | undefined) => (text ? maskTerm(text, [entry.term, entry.baseForm]) : null)
    return {
      id: entry.id,
      term: entry.term,
      definition: hide(sense ? sense.definition : entry.definition) ?? '',
      emoji: sense?.emoji ?? null,
      scene: hide(sense?.scene),
      parts: hide(entry.senses[0]?.parts),
    }
  })
}
