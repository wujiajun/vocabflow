import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { onTokenRejected } from '../../../shared/api/sessionEvents'
import { clearToken, getToken, setToken } from '../../../shared/api/tokenStorage'
import { AuthTokenContext } from './authTokenContext'
import { clearSessionCache } from './sessionCache'

export function AuthTokenProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setStoredToken] = useState(getToken)
  const [signedOutUnexpectedly, setSignedOutUnexpectedly] = useState(false)

  const storeToken = useCallback((nextToken: string) => {
    setToken(nextToken)
    setStoredToken(nextToken)
    setSignedOutUnexpectedly(false)
  }, [])

  const clearAuthToken = useCallback(() => {
    clearToken()
    setStoredToken(null)
  }, [])

  const clearSignedOutNotice = useCallback(() => setSignedOutUnexpectedly(false), [])

  useEffect(
    () =>
      onTokenRejected((rejectedToken) => {
        // A late 401 for a token that was already replaced must not end the newer session.
        if (getToken() !== rejectedToken) {
          return
        }

        clearAuthToken()
        clearSessionCache(queryClient)
        setSignedOutUnexpectedly(true)
      }),
    [clearAuthToken, queryClient],
  )

  const value = useMemo(
    () => ({ token, signedOutUnexpectedly, storeToken, clearAuthToken, clearSignedOutNotice }),
    [clearAuthToken, clearSignedOutNotice, signedOutUnexpectedly, storeToken, token],
  )

  return <AuthTokenContext.Provider value={value}>{children}</AuthTokenContext.Provider>
}
