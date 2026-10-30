const TOKEN_STORAGE_KEY = 'vocabflow.access-token'

// Temporary bearer-token storage. Revisit this during production authentication hardening.
export function getToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}
