import type { StudiedWord, StudyQueue } from './types/study'
import { shuffle } from './shuffle'

// One number for every practice game: a round has this many words, and a game is offered once the pool
// (today's words and the last week's) has at least `minGameWords`.
export const wordsPerRound = 10
export const minGameWords = 5
// Days back that the pool reaches. The server decides it (`recentlyStudied`); this is for the messages.
export const recentDays = 7
// Words fetched beyond a round's worth, because some turn out to have no usable meaning or example.
const spareWords = 5

export const notEnoughWords = `Study at least ${minGameWords} words, today or in the last ${recentDays} days, to play this.`

export function poolSize(queue: Pick<StudyQueue, 'studiedToday' | 'recentlyStudied'>) {
  return queue.studiedToday.length + queue.recentlyStudied.length
}

export function hasEnoughWords(queue: Pick<StudyQueue, 'studiedToday' | 'recentlyStudied'>) {
  return poolSize(queue) >= minGameWords
}

// The words a game fetches, best first: today's words in a random order, and only when they do not fill the
// fetch, the most recent older ones (random among those, so the game is not always the same). A game keeps
// this order when it takes its `wordsPerRound`, so today's words are in whenever they number that many or
// fewer. This is the one place that chooses words for the games; a later "hard words first" starts here.
export function pickGameWordIds(
  queue: Pick<StudyQueue, 'studiedToday' | 'recentlyStudied'>,
  random: () => number = Math.random,
): number[] {
  const wanted = wordsPerRound + spareWords
  const ids: number[] = []
  const seen = new Set<number>()
  const add = (words: StudiedWord[]) => {
    for (const word of words) {
      if (ids.length < wanted && !seen.has(word.userVocabularyId)) {
        seen.add(word.userVocabularyId)
        ids.push(word.userVocabularyId)
      }
    }
  }
  add(shuffle(queue.studiedToday, random))
  add(shuffle(queue.recentlyStudied, random))
  return ids
}
