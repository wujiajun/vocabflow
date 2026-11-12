import type { DailyTask } from './types/tasks'

const gameNames: Record<string, { name: string; path: string }> = {
  'quick-review': { name: 'Quick review', path: '/app/study/review' },
  'fill-blank': { name: 'Fill in the blank', path: '/app/study/fill' },
  'listen-choose': { name: 'Listen and choose', path: '/app/study/listen' },
  'spell-it': { name: 'Spell it', path: '/app/study/spell' },
}

export function taskTitle(task: DailyTask) {
  const n = task.target
  const game = gameNames[task.game ?? '']?.name ?? 'a game'
  switch (task.type) {
    case 'STUDY_PLAN':
      return 'Finish today’s study plan'
    case 'RATE_CARDS':
      return `Rate ${n} cards`
    case 'CLEAR_REVIEWS':
      return 'Clear all due reviews'
    case 'ADD_WORDS':
      return `Add ${n} words to your list`
    case 'ADD_WORD_FROM_ARTICLE':
      return n === 1 ? 'Add a word by tapping it in an article' : `Add ${n} words by tapping them in articles`
    case 'READ_ARTICLE':
      return n === 1 ? 'Read an article to the end' : `Read ${n} articles to the end`
    case 'READ_LONG_ARTICLE':
      return 'Read a long article to the end'
    case 'WATCH_VIDEO':
      return n === 1 ? 'Watch a video to the end' : `Watch ${n} videos to the end`
    case 'WATCH_GRAMMAR_VIDEO':
      return 'Watch a grammar video to the end'
    case 'PLAY_ROUND':
      return n === 1 ? 'Play a practice game' : `Play ${n} practice games`
    case 'PLAY_GAME':
      return n === 1 ? `Play ${game}` : `Play ${game} ${n} times`
    case 'STARS_ROUND':
      return 'Win 2 stars in a game'
    case 'SPELL_STARS':
      return 'Win 3 stars in Spell it'
    case 'PERFECT_ROUND':
      return 'Play a game with no mistakes'
    case 'DIFFERENT_GAMES':
      return `Play ${n} different games`
    case 'CHALLENGE_GAMES':
      return `Win 2 stars in ${n} different games`
    case 'CHALLENGE_PERFECT':
      return `Play ${n} games with no mistakes`
    case 'CHALLENGE_READ':
      return `Read ${n} articles, one of them long`
    case 'READ_SCENARIO':
      return 'Finish a new Life in Canada scenario'
    case 'SPEAK_SCENARIO':
      return 'Speak a Life in Canada scene'
  }
}

// Where the learner goes to do the task.
export function taskPath(task: DailyTask) {
  switch (task.type) {
    case 'STUDY_PLAN':
    case 'RATE_CARDS':
    case 'CLEAR_REVIEWS':
      return '/app/study'
    case 'ADD_WORDS':
      return '/app/vocabulary'
    case 'ADD_WORD_FROM_ARTICLE':
    case 'READ_ARTICLE':
    case 'READ_LONG_ARTICLE':
    case 'CHALLENGE_READ':
      return '/app/reading/articles'
    case 'WATCH_VIDEO':
    case 'WATCH_GRAMMAR_VIDEO':
      return '/app/reading/videos'
    case 'READ_SCENARIO':
    case 'SPEAK_SCENARIO':
      return '/app/reading/scenarios'
    case 'SPELL_STARS':
      return gameNames['spell-it'].path
    case 'PLAY_GAME':
      return gameNames[task.game ?? '']?.path ?? '/app/study/review'
    case 'PLAY_ROUND':
    case 'STARS_ROUND':
    case 'PERFECT_ROUND':
    case 'DIFFERENT_GAMES':
    case 'CHALLENGE_GAMES':
    case 'CHALLENGE_PERFECT':
      return '/app/study/review'
  }
}
