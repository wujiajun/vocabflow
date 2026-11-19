import { apiClient } from '../../../shared/api/apiClient'

export interface QuickAddKeyStatus {
  exists: boolean
  createdAt: string | null
  lastUsedAt: string | null
}

export interface NewQuickAddKey {
  key: string
  createdAt: string
}

export function getQuickAddKeyStatus() {
  return apiClient<QuickAddKeyStatus>('/api/v1/quick-add/key')
}

// The key is in the answer only this once; the server keeps nothing but its hash.
export function createQuickAddKey() {
  return apiClient<NewQuickAddKey>('/api/v1/quick-add/key', { method: 'POST' })
}

export function revokeQuickAddKey() {
  return apiClient<void>('/api/v1/quick-add/key', { method: 'DELETE' })
}
