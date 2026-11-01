import { apiClient } from '../../../shared/api/apiClient'
import type { ReadingPage, ReadingPassage, ReadingToday } from '../types/reading'

const readingPath = '/api/v1/reading'

export function generatePassage(date: string) {
  return apiClient<ReadingPassage>(`${readingPath}/passages`, { method: 'POST', body: { date } })
}

export function getToday(date: string) {
  return apiClient<ReadingToday>(`${readingPath}/today?date=${date}`)
}

export function listPassages(page: number, size: number, filter = '') {
  return apiClient<ReadingPage>(`${readingPath}/passages?page=${page}&size=${size}${filter}`)
}

export function getPassage(id: number) {
  return apiClient<ReadingPassage>(`${readingPath}/passages/${id}`)
}

export function setPassageRead(id: number, read: boolean) {
  return apiClient<ReadingPassage>(`${readingPath}/passages/${id}/read`, { method: 'PUT', body: { read } })
}
