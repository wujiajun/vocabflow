import { useQueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { AppProviders } from './AppProviders'

function QueryClientProbe() {
  const queryClient = useQueryClient()
  return <output>{queryClient ? 'query-provider-ready' : 'query-provider-missing'}</output>
}

test('provides a QueryClient to the application tree', () => {
  render(
    <AppProviders>
      <QueryClientProbe />
    </AppProviders>,
  )

  expect(screen.getByText('query-provider-ready')).toBeInTheDocument()
})
