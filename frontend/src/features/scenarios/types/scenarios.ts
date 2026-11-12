export interface ScenarioSummary {
  id: string
  title: string
  titleZh: string
  clb: number
  readingMinutes: number
  summary: string
  summaryZh: string
  keywordCount: number
  completed: boolean
  bestScore: number | null
  quizSize: number
  // The latest Speak this scene result, 0-100, and when; null until the learner has spoken it.
  speakingScore: number | null
  spokenAt: string | null
}

export interface ScenarioKeyword {
  word: string
  zh: string
  definition: string
  example: string
}

export interface ScenarioQuestion {
  question: string
  options: string[]
  // The index of the right option.
  answer: number
  explainZh: string
}

export interface Scenario {
  id: string
  title: string
  titleZh: string
  clb: number
  readingMinutes: number
  summary: string
  summaryZh: string
  canadaNoteZh: string
  // Paragraphs separated by a blank line; a spoken line starts with the speaker's name and a colon.
  text: string
  keywords: ScenarioKeyword[]
  quiz: ScenarioQuestion[]
  completed: boolean
  completedAt: string | null
  bestScore: number | null
  speakingScore: number | null
  spokenAt: string | null
}
