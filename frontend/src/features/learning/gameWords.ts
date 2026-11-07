import type { StudyQueue } from './types/study'

// One number for every practice game: a round has this many words, and a game is offered once the pool
// (today's words and those of the last 30 days) has at least `minGameWords`.
export const wordsPerRound = 10
export const minGameWords = 5
// Days back that the pool reaches. The server decides it (`recentlyStudied`); this is for the messages.
export const recentDays = 30
// Words fetched beyond a round's worth, because some turn out to have no usable meaning or example.
const spareWords = 5

export const notEnoughWords = `Study at least ${minGameWords} words, today or in the last ${recentDays} days, to play this.`

export function poolSize(queue: Pick<StudyQueue, 'studiedToday' | 'recentlyStudied'>) {
  return queue.studiedToday.length + queue.recentlyStudied.length
}

export function hasEnoughWords(queue: Pick<StudyQueue, 'studiedToday' | 'recentlyStudied'>) {
  return poolSize(queue) >= minGameWords
}

// The words a game fetches, best first. The server ranks the pool (`GET /learning/game-words`): words never
// played in any game first, then the longest ago, hard and today's words a little ahead; this keeps what a
// game fetches (a round's worth and spares). A game keeps this order when it takes its `wordsPerRound`.
// This is the one place that decides how many words a game fetches.
export function pickGameWordIds(ranked: number[]): number[] {
  return [...new Set(ranked)].slice(0, wordsPerRound + spareWords)
}
