import { apiClient } from '../../../shared/api/apiClient'

export interface PushConfig {
  enabled: boolean
  publicKey: string | null
}

export interface PushSubscriptionInfo {
  endpoint: string
  remindAt: string
}

export interface SaveSubscriptionRequest {
  endpoint: string
  p256dh: string
  auth: string
  remindAt: string
  deviceZone?: string
}

export function getPushConfig() {
  return apiClient<PushConfig>('/api/v1/push/config')
}

export function listPushSubscriptions() {
  return apiClient<PushSubscriptionInfo[]>('/api/v1/push/subscription')
}

export function savePushSubscription(request: SaveSubscriptionRequest) {
  return apiClient<void>('/api/v1/push/subscription', { method: 'POST', body: request })
}

export function deletePushSubscription(endpoint: string) {
  return apiClient<void>('/api/v1/push/subscription', { method: 'DELETE', body: { endpoint } })
}
