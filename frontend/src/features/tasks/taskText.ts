import type { DailyTask } from './types/tasks'

const gameNames: Record<string, { name: string; path: string }> = {
  'quick-review': { name: 'Quick review', path: '/app/study/review' },
  'fill-blank': { name: 'Fill in the blank', path: '/app/study/fill' },
  'listen-choose': { name: 'Listen and choose', path: '/app/study/listen' },
  'spell-it': { name: 'Spell it', path: '/app/study/spell' },
}

export function taskTitle(task: DailyTask) {
  switch (task.type) {
    case 'STUDY_PLAN':
      return 'Finish today’s study plan'
    case 'RATE_CARDS':
      return `Rate ${task.target} cards`
    case 'CLEAR_REVIEWS':
      return 'Clear all due reviews'
    case 'ADD_WORDS':
      return `Add ${task.target} words to your list`
    case 'ADD_WORD_FROM_ARTICLE':
      return 'Add a word by tapping it in an article'
    case 'READ_ARTICLE':
      return 'Read an article to the end'
    case 'WATCH_VIDEO':
      return 'Watch a video to the end'
    case 'PLAY_ROUND':
      return 'Play a practice game'
    case 'PLAY_GAME':
      return `Play ${gameNames[task.game ?? '']?.name ?? 'a game'}`
    case 'STARS_ROUND':
      return 'Win 2 stars in a game'
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
      return '/app/reading/articles'
    case 'WATCH_VIDEO':
      return '/app/reading/videos'
    case 'PLAY_GAME':
      return gameNames[task.game ?? '']?.path ?? '/app/study/review'
    case 'PLAY_ROUND':
    case 'STARS_ROUND':
      return '/app/study/review'
  }
}
