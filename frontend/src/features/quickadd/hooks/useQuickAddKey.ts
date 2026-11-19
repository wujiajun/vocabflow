import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createQuickAddKey, getQuickAddKeyStatus, revokeQuickAddKey } from '../api/quickAddApi'

const statusKey = ['quick-add', 'key'] as const

export function useQuickAddKey() {
  const queryClient = useQueryClient()
  const status = useQuery({ queryKey: statusKey, queryFn: getQuickAddKeyStatus })
  const refresh = () => queryClient.invalidateQueries({ queryKey: statusKey })
  const create = useMutation({ mutationFn: createQuickAddKey, onSuccess: refresh })
  const revoke = useMutation({ mutationFn: revokeQuickAddKey, onSuccess: refresh })
  return { status, create, revoke }
}
