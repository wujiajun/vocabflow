import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { ApiClientError } from '../../../shared/api/apiClient'
import { getCurrentUser, login, logout, register, updateDailyGoal } from '../api/authApi'
import type { LoginRequest, RegisterRequest } from '../types/auth'
import { useAuthToken } from './authTokenContext'
import { clearSessionCache } from './sessionCache'

export const currentUserQueryKey = ['auth', 'current-user'] as const

export type AuthStatus = 'authenticated' | 'error' | 'loading' | 'unauthenticated'

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
      clearSessionCache(queryClient)
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

  return {
    status: 'error' as const,
    user: undefined,
    error: currentUserQuery.error,
    isRetrying: currentUserQuery.isFetching,
    retry: () => {
      void currentUserQuery.refetch()
    },
    discardSession: () => {
      clearAuthToken()
      clearSessionCache(queryClient)
    },
  }
}

export function useLoginMutation() {
  const { storeToken } = useAuthToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: LoginRequest) => login(request),
    onSuccess: async ({ accessToken, user }) => {
      clearSessionCache(queryClient)
      storeToken(accessToken)
      queryClient.setQueryData(currentUserQueryKey, user)
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey })
    },
  })
}

export function useUpdateDailyGoal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (goal: number) => updateDailyGoal(goal),
    onSuccess: (user) => queryClient.setQueryData(currentUserQueryKey, user),
  })
}

export function useRegisterMutation() {
  const { clearSignedOutNotice } = useAuthToken()

  return useMutation({
    mutationFn: (request: RegisterRequest) => register(request),
    onSuccess: clearSignedOutNotice,
  })
}

export function useLogoutMutation() {
  const { clearAuthToken } = useAuthToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      clearAuthToken()
      clearSessionCache(queryClient)
    },
  })
}
