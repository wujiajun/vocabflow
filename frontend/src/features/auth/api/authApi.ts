import { apiClient } from '../../../shared/api/apiClient'
import type { AuthUser, LoginRequest, LoginResponse, RegisterRequest, UpdateSettingsRequest } from '../types/auth'

const authPath = '/api/v1/auth'

export function register(request: RegisterRequest) {
  return apiClient<AuthUser>(`${authPath}/register`, {
    method: 'POST',
    body: request,
  })
}

export function login(request: LoginRequest) {
  return apiClient<LoginResponse>(`${authPath}/login`, {
    method: 'POST',
    body: request,
    notifyOnUnauthorized: false,
  })
}

export function logout() {
  return apiClient<void>(`${authPath}/logout`, { method: 'POST', notifyOnUnauthorized: false })
}

export function updateSettings(settings: UpdateSettingsRequest) {
  return apiClient<AuthUser>(`${authPath}/me`, { method: 'PATCH', body: settings })
}

export function getCurrentUser() {
  return apiClient<AuthUser>(`${authPath}/me`)
}
