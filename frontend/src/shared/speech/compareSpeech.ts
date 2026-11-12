export type WordStatus = 'correct' | 'missed' | 'wrong'

export interface TargetWord {
  word: string
  status: WordStatus
  /** What was heard in this word's place, for a wrong word. */
  heard?: string
}

export interface SpeechComparison {
  target: TargetWord[]
  /** Words that were said but have no place in the target. */
  extra: string[]
  correct: number
  total: number
  /** correct / total, 0 when the target is empty. */
  share: number
}

/** Lower case, no punctuation; apostrophes inside a word stay ("don't"), curly ones become straight. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').replace(/[^\p{L}\p{N}']/gu, ''))
    .filter((w) => w.length > 0)
}

export interface Alignment {
  /** For each target token: what became of it. `heard` is the index of the heard token in its place. */
  target: { status: WordStatus; heard?: number }[]
  /** Indexes of heard tokens that have no place in the target. */
  extra: number[]
}

/**
 * Lines up two lists of words with the cheapest edit path (a match is free, a miss, an extra word or a swap
 * costs 1), so one missed word does not turn every later word wrong. `same` says when two words match.
 */
export function alignTokens(target: readonly string[], heard: readonly string[], same: (a: string, b: string) => boolean = (a, b) => a === b): Alignment {
  const n = target.length
  const m = heard.length
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = 0; i <= n; i++) cost[i][0] = i
  for (let j = 0; j <= m; j++) cost[0][j] = j
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const swap = cost[i - 1][j - 1] + (same(target[i - 1], heard[j - 1]) ? 0 : 1)
      cost[i][j] = Math.min(swap, cost[i - 1][j] + 1, cost[i][j - 1] + 1)
    }
  }

  const words: Alignment['target'] = new Array(n)
  const extraReversed: number[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const ok = same(target[i - 1], heard[j - 1])
      if (cost[i][j] === cost[i - 1][j - 1] + (ok ? 0 : 1)) {
        words[i - 1] = ok ? { status: 'correct', heard: j - 1 } : { status: 'wrong', heard: j - 1 }
        i--
        j--
        continue
      }
    }
    if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      words[i - 1] = { status: 'missed' }
      i--
    } else {
      extraReversed.push(j - 1)
      j--
    }
  }
  return { target: words, extra: extraReversed.reverse() }
}

export function compareSpeech(targetText: string, heardText: string): SpeechComparison {
  const originals = targetText.split(/\s+/).filter((w) => tokenize(w).length > 0)
  const target = originals.map((w) => tokenize(w).join(''))
  const heard = tokenize(heardText)
  const aligned = alignTokens(target, heard)

  const words: TargetWord[] = aligned.target.map((t, i) => ({
    word: originals[i],
    status: t.status,
    ...(t.status === 'wrong' && t.heard !== undefined ? { heard: heard[t.heard] } : {}),
  }))
  const correct = words.filter((w) => w.status === 'correct').length
  return { target: words, extra: aligned.extra.map((k) => heard[k]), correct, total: target.length, share: target.length === 0 ? 0 : correct / target.length }
}
