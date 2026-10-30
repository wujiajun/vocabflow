import type { QueryClient } from '@tanstack/react-query'

// Every cached query belongs to the signed-in user, so none may outlive their session.
export function clearSessionCache(queryClient: QueryClient) {
  queryClient.getQueryCache().clear()
}
