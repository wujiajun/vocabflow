import { type ReactNode, useCallback, useMemo, useState } from 'react'
import { clearToken, getToken, setToken } from '../../../shared/api/tokenStorage'
import { AuthTokenContext } from './authTokenContext'

export function AuthTokenProvider({ children }: { children: ReactNode }) {
  const [token, setStoredToken] = useState(getToken)

  const storeToken = useCallback((nextToken: string) => {
    setToken(nextToken)
    setStoredToken(nextToken)
  }, [])

  const clearAuthToken = useCallback(() => {
    clearToken()
    setStoredToken(null)
  }, [])

  const value = useMemo(
    () => ({ token, storeToken, clearAuthToken }),
    [clearAuthToken, storeToken, token],
  )

  return <AuthTokenContext.Provider value={value}>{children}</AuthTokenContext.Provider>
}
