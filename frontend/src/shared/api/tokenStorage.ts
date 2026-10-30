export const TOKEN_STORAGE_KEY = 'vocabflow.access-token'

// Used only when the browser refuses to persist the token (storage disabled or full). The tab
// keeps working, but the session is lost on reload and other tabs cannot see it.
let fallbackToken: string | null = null

// Temporary bearer-token storage. Revisit this during production authentication hardening.
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) ?? fallbackToken
  } catch {
    return fallbackToken
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
    fallbackToken = null
  } catch {
    fallbackToken = token
  }
}

export function clearToken() {
  fallbackToken = null
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // Nothing persisted that we could remove.
  }
}
