import { apiClient } from '../../../shared/api/apiClient'
import type { ReviewRequest, StudyQueue } from '../types/study'

export function getStudyQueue(date: string) {
  return apiClient<StudyQueue>(`/api/v1/learning/study-queue?date=${date}`)
}

export function submitReview({ userVocabularyId, rating, version, date }: ReviewRequest) {
  return apiClient<StudyQueue>(`/api/v1/learning/cards/${userVocabularyId}/reviews`, {
    method: 'POST',
    body: { rating, version, date },
  })
}
