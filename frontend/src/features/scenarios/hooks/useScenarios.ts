import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { completeScenario, getScenario, listScenarios } from '../api/scenariosApi'

export const scenarioKeys = {
  all: ['scenarios'] as const,
  list: () => [...scenarioKeys.all, 'list'] as const,
  detail: (id: string) => [...scenarioKeys.all, 'scenario', id] as const,
}

export function useScenarios() {
  return useQuery({ queryKey: scenarioKeys.list(), queryFn: listScenarios })
}

export function useScenario(id: string | undefined) {
  return useQuery({ queryKey: scenarioKeys.detail(id ?? ''), queryFn: () => getScenario(id as string), enabled: id !== undefined })
}

export function useCompleteScenario(id: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (score?: number) => completeScenario(id as string, score),
    onSettled: () => queryClient.invalidateQueries({ queryKey: scenarioKeys.all }),
  })
}
