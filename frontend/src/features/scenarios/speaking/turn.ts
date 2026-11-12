import type { HeardResult } from '../../../shared/speech/useSpeechRecognition'

/**
 * After the microphone is open (`audiostart`), "Speak now" is shown only this much later: on an iPhone the
 * first words said right after audiostart are often lost.
 */
export const readyDelayMs = 500
/**
 * Said before listening when no other line comes just before the learner's (they speak first, twice in a row, or
 * try again): an iPhone listens reliably only right after the phone has spoken, and the learner's own line would
 * give the answer away. Long enough (about a second and a half) to count as the phone having spoken.
 */
export const turnCue = 'Your turn. Go ahead.'
/** A turn whose microphone has not opened after this long is offered a way out. */
export const watchdogMs = 10000

/** One voice for the first speaker and a lower one for the second, as in Listen first. */
export function pitchFor(speakers: readonly string[], speaker: string): number {
  return speakers.indexOf(speaker) % 2 === 0 ? 1 : 0.75
}

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
