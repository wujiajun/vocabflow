import type { HeardResult } from '../../../shared/speech/useSpeechRecognition'

/** After Done, a result that is not final yet is waited for this long. The final one often comes 1 to 2 s late. */
export const settleMs = 1500
/** When a result is final and nothing more comes for this long, the learner has finished the line. */
export const quietMs = 1200
/** A step that has not moved for this long is offered a way out. */
export const watchdogMs = 10000

/**
 * What the learner has said in this turn. In continuous mode the results pile up for the whole practice, so
 * only those from `baseline` (how many there were when the turn began) on belong to this turn. A late final
 * result of the line before updates an earlier entry, so it does not get in.
 */
export function turnText(results: readonly HeardResult[], baseline: number): { text: string; final: boolean } {
  const mine = results.slice(baseline)
  return {
    text: mine
      .map((r) => r.transcript.trim())
      .filter(Boolean)
      .join(' '),
    final: mine.length > 0 && mine[mine.length - 1].isFinal,
  }
}

/** How long the other person's line is shown before the page moves on by itself. */
export function readingMs(text: string): number {
  return Math.max(2500, 1500 + text.split(/\s+/).length * 400)
}

export type SelfRating = 'good' | 'okay' | 'hard'
export const selfShare: Record<SelfRating, number> = { good: 1, okay: 0.7, hard: 0.4 }
export const selfLabel: Record<SelfRating, string> = { good: 'Went well', okay: 'So-so', hard: 'Need practice' }
