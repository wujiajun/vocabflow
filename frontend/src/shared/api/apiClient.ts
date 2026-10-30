import { notifyTokenRejected } from './sessionEvents'
import { getToken } from './tokenStorage'

export interface ApiErrorResponse {
  code: string
  message: string
  timestamp: string
}

export class ApiClientError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
  }
}

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  // Set to false for requests that sign the user in or out, where a 401 does not mean the stored
  // token went stale.
  notifyOnUnauthorized?: boolean
}

export async function apiClient<T>(
  path: string,
  { body, headers: requestHeaders, notifyOnUnauthorized = true, ...options }: ApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers(requestHeaders)
  headers.set('Accept', 'application/json')

  const token = getToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(path, {
      ...options,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiClientError('Unable to reach VocabFlow. Please try again.', 0)
  }

  if (!response.ok) {
    if (response.status === 401 && token && notifyOnUnauthorized) {
      notifyTokenRejected(token)
    }
    throw await toApiClientError(response)
  }

  if (response.status === 204 || !response.headers.get('content-type')?.includes('application/json')) {
    return undefined as T
  }

  try {
    return (await response.json()) as T
  } catch {
    throw new ApiClientError('Received an unexpected response from VocabFlow. Please try again.', response.status)
  }
}

async function toApiClientError(response: Response) {
  const error = await parseApiError(response)
  const message =
    response.status >= 500
      ? 'Something went wrong. Please try again.'
      : error?.message || 'Your request could not be completed. Please try again.'

  return new ApiClientError(message, response.status, error?.code)
}

async function parseApiError(response: Response): Promise<ApiErrorResponse | undefined> {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    return undefined
  }

  try {
    const body: unknown = await response.json()
    return isApiErrorResponse(body) ? body : undefined
  } catch {
    return undefined
  }
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!value || typeof value !== 'object') {
    return false
  }

  const error = value as Partial<ApiErrorResponse>
  return typeof error.code === 'string' && typeof error.message === 'string'
}
