import { apiClient } from '../../../shared/api/apiClient'
import type { AuthUser, LoginRequest, LoginResponse, RegisterRequest } from '../types/auth'

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
  })
}

export function logout() {
  return apiClient<void>(`${authPath}/logout`, { method: 'POST' })
}

export function getCurrentUser() {
  return apiClient<AuthUser>(`${authPath}/me`)
}
