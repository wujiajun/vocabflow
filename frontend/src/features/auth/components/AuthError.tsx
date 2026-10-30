import { ApiClientError } from '../../../shared/api/apiClient'

export function authErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback
}
