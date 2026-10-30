import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { ApiClientError } from '../../../shared/api/apiClient'
import { getCurrentUser, login, logout, register } from '../api/authApi'
import type { LoginRequest, RegisterRequest } from '../types/auth'
import { useAuthToken } from './authTokenContext'

export const currentUserQueryKey = ['auth', 'current-user'] as const

export type AuthStatus = 'authenticated' | 'loading' | 'unauthenticated' | 'unknown'

export function useAuth() {
  const { token, clearAuthToken } = useAuthToken()
  const queryClient = useQueryClient()
  const currentUserQuery = useQuery({
    queryKey: currentUserQueryKey,
    queryFn: getCurrentUser,
    enabled: token !== null,
    retry: false,
  })

  const staleToken = currentUserQuery.error instanceof ApiClientError && currentUserQuery.error.status === 401

  useEffect(() => {
    if (staleToken) {
      clearAuthToken()
      queryClient.removeQueries({ queryKey: currentUserQueryKey })
    }
  }, [clearAuthToken, queryClient, staleToken])

  if (!token || staleToken) {
    return { status: 'unauthenticated' as const, user: undefined }
  }

  if (currentUserQuery.isPending) {
    return { status: 'loading' as const, user: undefined }
  }

  if (currentUserQuery.data) {
    return { status: 'authenticated' as const, user: currentUserQuery.data }
  }

  return { status: 'unknown' as const, user: undefined }
}

export function useLoginMutation() {
  const { storeToken } = useAuthToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: LoginRequest) => login(request),
    onSuccess: async ({ accessToken, user }) => {
      storeToken(accessToken)
      queryClient.setQueryData(currentUserQueryKey, user)
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey })
    },
  })
}

export function useRegisterMutation() {
  return useMutation({ mutationFn: (request: RegisterRequest) => register(request) })
}

export function useLogoutMutation() {
  const { clearAuthToken } = useAuthToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      clearAuthToken()
      queryClient.removeQueries({ queryKey: currentUserQueryKey })
    },
  })
}
