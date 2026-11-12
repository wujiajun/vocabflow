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

/**
 * Words are lined up with the cheapest edit path (a match is free, a miss, an extra word or a swap costs 1),
 * so one missed word does not turn every later word wrong.
 */
export function compareSpeech(targetText: string, heardText: string): SpeechComparison {
  const originals = targetText.split(/\s+/).filter((w) => tokenize(w).length > 0)
  const target = originals.map((w) => tokenize(w).join(''))
  const heard = tokenize(heardText)
  const n = target.length
  const m = heard.length

  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = 0; i <= n; i++) cost[i][0] = i
  for (let j = 0; j <= m; j++) cost[0][j] = j
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const swap = cost[i - 1][j - 1] + (target[i - 1] === heard[j - 1] ? 0 : 1)
      cost[i][j] = Math.min(swap, cost[i - 1][j] + 1, cost[i][j - 1] + 1)
    }
  }

  const words: TargetWord[] = new Array(n)
  const extraReversed: string[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const same = target[i - 1] === heard[j - 1]
      if (cost[i][j] === cost[i - 1][j - 1] + (same ? 0 : 1)) {
        words[i - 1] = same
          ? { word: originals[i - 1], status: 'correct' }
          : { word: originals[i - 1], status: 'wrong', heard: heard[j - 1] }
        i--
        j--
        continue
      }
    }
    if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      words[i - 1] = { word: originals[i - 1], status: 'missed' }
      i--
    } else {
      extraReversed.push(heard[j - 1])
      j--
    }
  }

  const correct = words.filter((w) => w.status === 'correct').length
  return { target: words, extra: extraReversed.reverse(), correct, total: n, share: n === 0 ? 0 : correct / n }
}
