import { alignTokens, type WordStatus } from '../../../shared/speech/compareSpeech'

// A word of the text and the words of the sentence it came from. A contraction becomes two tokens, and
// several words ("six dollars and fifty cents") can become two number tokens, so a token knows which
// written words it stands for.
interface Token {
  t: string
  src: number[]
}

const units: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
}
const tens: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const exceptions: Record<string, string[]> = {
  "can't": ['can', 'not'], cannot: ['can', 'not'], "won't": ['will', 'not'], "shan't": ['shall', 'not'], "ain't": ['is', 'not'], "let's": ['let', 'us'],
}
const isWords = new Set(['it', 'he', 'she', 'that', 'there', 'here', 'what', 'who', 'where', 'how', 'when', 'why', 'this'])
const suffixes: [string, string][] = [["'m", 'am'], ["'re", 'are'], ["'ve", 'have'], ["'ll", 'will'], ["'d", 'would']]
// Small words a learner (and a recognizer) easily drops or swaps; leaving one out is not a mistake.
export const optionalWords = new Set(['a', 'an', 'the', 'of', 'to', 'and', 'or', 'so', 'but', 'um', 'uh', 'oh'])

function expand(word: string): string[] {
  if (exceptions[word]) return exceptions[word]
  if (word.endsWith("n't") && word.length > 3) return [word.slice(0, -3), 'not']
  for (const [suffix, full] of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length) return [word.slice(0, -suffix.length), full]
  }
  if (word.endsWith("'s") && word.length > 2) {
    const stem = word.slice(0, -2)
    return isWords.has(stem) ? [stem, 'is'] : [stem]
  }
  return [word.replace(/'$/, '')]
}

// "$6.50" and "6.50" are the numbers 6 and 50, as in "six fifty" and "six dollars and fifty cents".
function pieces(raw: string): string[] {
  const word = raw
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[.,!?;:"()]+$/g, '')
    .replace(/^["(]+/, '')
  const money = /^\$?(\d[\d,]*)(?:\.(\d{1,2}))?$/.exec(word)
  if (money) {
    const whole = money[1].replace(/,/g, '')
    return money[2] === undefined ? [whole] : [whole, String(Number(money[2].padEnd(2, '0')))]
  }
  return word
    .split(/[-–—]/)
    .map((part) => part.replace(/[^\p{L}\p{N}']/gu, ''))
    .filter(Boolean)
    .flatMap(expand)
    .filter(Boolean)
}

function mergeNumbers(tokens: Token[]): Token[] {
  const out: Token[] = []
  for (let i = 0; i < tokens.length; i++) {
    const first = tokens[i].t
    if (!(first in units) && !(first in tens)) {
      out.push(tokens[i])
      continue
    }
    let value = units[first] ?? tens[first]
    const src = [...tokens[i].src]
    let j = i + 1
    const next = () => tokens[j]?.t
    const take = () => src.push(...tokens[j++].src)
    if (first in tens && next() in units && units[next()!] >= 1 && units[next()!] <= 9) {
      value += units[next()!]
      take()
    } else if (next() === 'hundred') {
      value *= 100
      take()
      if (next() in tens) {
        value += tens[next()!]
        take()
        if (next() in units && units[next()!] >= 1 && units[next()!] <= 9) {
          value += units[next()!]
          take()
        }
      } else if (next() in units && units[next()!] >= 1) {
        value += units[next()!]
        take()
      }
    }
    out.push({ t: String(value), src })
    i = j - 1
  }
  return out
}

const numeric = (t: string | undefined) => t !== undefined && /^\d+$/.test(t)

export function tokensOf(words: readonly string[]): Token[] {
  const raw: Token[] = words.flatMap((word, i) => pieces(word).map((t) => ({ t, src: [i] })))
  const merged = mergeNumbers(raw)
  const out: Token[] = []
  merged.forEach((token, i) => {
    const previous = out[out.length - 1]
    const unitWord = /^(dollars?|cents?|bucks?|percent)$/.test(token.t)
    const joiner = token.t === 'and' && numeric(previous?.t) && numeric(merged[i + 1]?.t)
    if (previous && ((unitWord && numeric(previous.t)) || joiner)) {
      previous.src.push(...token.src) // it stands with the number and adds nothing to say
      return
    }
    out.push({ ...token, src: [...token.src] })
  })
  return out
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const above = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = above
    }
  }
  return row[b.length]
}

/** The same word, or a plural of it, or a one-letter spelling difference in a longer word ("licence"/"license"). */
export function similar(a: string, b: string): boolean {
  if (a === b) return true
  if (numeric(a) || numeric(b)) return false
  if (a + 's' === b || b + 's' === a || a + 'es' === b || b + 'es' === a) return a.length >= 3 && b.length >= 3
  return a.length >= 5 && b.length >= 5 && distance(a, b) <= 1
}

export interface ScoredWord {
  word: string
  status: WordStatus
  heard?: string
}

export interface LineScore {
  words: ScoredWord[]
  extra: string[]
  correct: number
  total: number
  share: number
}

/**
 * How well a line was said. Capitals and punctuation do not count; "I'd" and "I would" are the same, and
 * so are "$6.50", "six fifty" and "six dollars and fifty cents"; small words (a, the, to, …) may be left
 * out; a plural or a one-letter spelling difference in a long word is accepted.
 */
export function scoreLine(targetText: string, heardText: string): LineScore {
  const words = targetText.split(/\s+/).filter(Boolean)
  const target = tokensOf(words)
  const heard = tokensOf(heardText.split(/\s+/).filter(Boolean))
  if (heard.length === 0) {
    return { words: words.map((word) => ({ word, status: 'missed' as const })), extra: [], correct: 0, total: words.length, share: 0 }
  }

  const aligned = alignTokens(target.map((t) => t.t), heard.map((t) => t.t), similar)
  const status = aligned.target.map((a, k): WordStatus => (a.status !== 'correct' && optionalWords.has(target[k].t) ? 'correct' : a.status))
  const scored: ScoredWord[] = words.map((word, i) => {
    const mine = target.map((t, k) => ({ k, t })).filter(({ t }) => t.src.includes(i))
    if (mine.length === 0) return { word, status: 'correct' }
    if (mine.every(({ k }) => status[k] === 'correct')) return { word, status: 'correct' }
    if (mine.every(({ k }) => status[k] === 'missed')) return { word, status: 'missed' }
    const swapped = mine.find(({ k }) => aligned.target[k].heard !== undefined && status[k] === 'wrong')
    return { word, status: 'wrong', ...(swapped ? { heard: heard[aligned.target[swapped.k].heard!].t } : {}) }
  })
  const correct = scored.filter((w) => w.status === 'correct').length
  return { words: scored, extra: aligned.extra.map((k) => heard[k].t), correct, total: words.length, share: words.length === 0 ? 0 : correct / words.length }
}
