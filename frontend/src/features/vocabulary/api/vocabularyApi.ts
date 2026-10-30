import { apiClient } from '../../../shared/api/apiClient'
import type { CreateVocabularyRequest, VocabularyEntry, VocabularyPage } from '../types/vocabulary'

const vocabularyPath = '/api/v1/vocabulary'

export function createVocabulary(request: CreateVocabularyRequest) {
  return apiClient<VocabularyEntry>(vocabularyPath, {
    method: 'POST',
    body: request,
  })
}

export function listVocabulary(page: number, size: number) {
  return apiClient<VocabularyPage>(`${vocabularyPath}?page=${page}&size=${size}`)
}

export function getVocabulary(id: number) {
  return apiClient<VocabularyEntry>(`${vocabularyPath}/${id}`)
}
