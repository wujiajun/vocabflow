import { apiClient } from '../../../shared/api/apiClient'
import type { CreateVocabularyRequest, VocabularyEntry, VocabularyPage } from '../types/vocabulary'

const vocabularyPath = '/api/v1/vocabulary'

export function createVocabulary(request: CreateVocabularyRequest) {
  return apiClient<VocabularyEntry>(vocabularyPath, {
    method: 'POST',
    body: request,
  })
}

export function listVocabulary(page: number, size: number, filter = '') {
  return apiClient<VocabularyPage>(`${vocabularyPath}?page=${page}&size=${size}${filter}`)
}

export function retryEnrichment(id: number) {
  return apiClient<VocabularyEntry>(`${vocabularyPath}/${id}/enrichment/retry`, { method: 'POST' })
}

export function removeVocabulary(id: number) {
  return apiClient<void>(`${vocabularyPath}/${id}`, { method: 'DELETE' })
}

export function getVocabulary(id: number) {
  return apiClient<VocabularyEntry>(`${vocabularyPath}/${id}`)
}
