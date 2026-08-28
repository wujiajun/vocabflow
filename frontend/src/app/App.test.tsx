import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import { App } from './App'
import { AppProviders } from './providers/AppProviders'

test('renders the foundation and navigates to the login placeholder', async () => {
  const user = userEvent.setup()

  render(
    <AppProviders>
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    </AppProviders>,
  )

  expect(screen.getByRole('heading', { name: 'Frontend foundation ready' })).toBeInTheDocument()

  await user.click(screen.getByRole('link', { name: 'View login placeholder' }))

  expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
})
