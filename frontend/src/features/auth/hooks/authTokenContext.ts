import { createContext, useContext } from 'react'

export interface AuthTokenContextValue {
  token: string | null
  storeToken: (token: string) => void
  clearAuthToken: () => void
}

export const AuthTokenContext = createContext<AuthTokenContextValue | undefined>(undefined)

export function useAuthToken() {
  const context = useContext(AuthTokenContext)
  if (!context) {
    throw new Error('useAuthToken must be used within AuthTokenProvider')
  }
  return context
}
