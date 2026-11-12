import { apiClient } from '../../../shared/api/apiClient'
import type { Scenario, ScenarioSummary } from '../types/scenarios'

const scenariosPath = '/api/v1/scenarios'

export function listScenarios() {
  return apiClient<ScenarioSummary[]>(scenariosPath)
}

export function getScenario(id: string) {
  return apiClient<Scenario>(`${scenariosPath}/${encodeURIComponent(id)}`)
}

// `score` is the number of right answers, or left out when the quiz was not taken.
export function completeScenario(id: string, score?: number) {
  return apiClient<void>(`${scenariosPath}/${encodeURIComponent(id)}/complete`, {
    method: 'PUT',
    body: score === undefined ? undefined : { score },
  })
}
