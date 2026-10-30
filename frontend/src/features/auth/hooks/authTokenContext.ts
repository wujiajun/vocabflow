import { createContext, useContext } from 'react'

export interface AuthTokenContextValue {
  token: string | null
  // True when the backend rejected the stored token and the user was signed out without asking to be.
  signedOutUnexpectedly: boolean
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
