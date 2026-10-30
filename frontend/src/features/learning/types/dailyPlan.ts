import type { VocabularyType } from '../../vocabulary/types/vocabulary'

export interface DailyPlanItem {
  userVocabularyId: number
  vocabularyItemId: number
  term: string
  type: VocabularyType | null
}

export interface DailyPlan {
  date: string
  newVocabularyGoal: number
  newItems: DailyPlanItem[]
  reviewItems: DailyPlanItem[]
}
