import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { AuthTokenProvider } from '../../auth/hooks/AuthTokenProvider'
import { clearToken } from '../../../shared/api/tokenStorage'
import { jsonResponse, stubApi } from '../../../test/utils'
import { PairGame } from './PairGame'
import type { MatchPair } from './matching'

afterEach(() => {
  cleanup()
  clearToken()
  vi.unstubAllGlobals()
})

const pairs: MatchPair[] = Array.from({ length: 7 }, (_, index) => ({ id: index + 1, term: `word${index + 1}`, definition: `Meaning ${index + 1}.` }))

async function place(browserUser: ReturnType<typeof userEvent.setup>, ids: number[]) {
  for (const id of ids) {
    await browserUser.click(screen.getByRole('button', { name: `word${id}` }))
    await browserUser.click(screen.getByRole('button', { name: `Meaning ${id}.` }))
  }
}

test('a game of two rounds carries the score, the streak and the bar from the first round into the second', async () => {
  const browserUser = userEvent.setup()
  const fetchMock = stubApi({
    'POST /api/v1/learning/game-rounds': () => jsonResponse({ id: 1 }),
  })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthTokenProvider>
        <MemoryRouter>
          <PairGame game="fill-blank" intro={{ icon: '🧩', title: 'Ready?', text: ({ words, rounds }) => `${words} words in ${rounds} rounds` }} minimum={4} notEnough={<p>none</p>} onAgain={vi.fn()} pairs={pairs} />
        </MemoryRouter>
      </AuthTokenProvider>
    </QueryClientProvider>,
  )

  expect(screen.getByText('7 words in 2 rounds')).toBeInTheDocument()
  await browserUser.click(screen.getByRole('button', { name: 'Start' }))
  expect(screen.getByRole('heading', { name: 'Round 1 of 2' })).toBeInTheDocument()

  // The first round holds four words, all right the first time.
  await place(browserUser, [1, 2, 3, 4])
  expect(screen.getByRole('heading', { name: 'All matched on the first try!' })).toBeInTheDocument()
  await browserUser.click(screen.getByRole('button', { name: 'Next round' }))

  expect(screen.getByRole('heading', { name: 'Round 2 of 2' })).toBeInTheDocument()
  expect(screen.getByLabelText('4 right on the first try')).toBeInTheDocument()
  expect(screen.getByLabelText('4 in a row')).toBeInTheDocument()
  const bar = screen.getByRole('progressbar', { name: 'Progress' })
  expect(bar).toHaveAttribute('aria-valuenow', '4')
  expect(bar).toHaveAttribute('aria-valuemax', '7')

  await place(browserUser, [5, 6, 7])
  expect(screen.getByLabelText('7 in a row')).toBeInTheDocument()
  await browserUser.click(screen.getByRole('button', { name: 'See results' }))

  expect(screen.getByRole('heading', { name: 'Perfect! 7 of 7 on the first try' })).toBeInTheDocument()
  expect(screen.getByText(/Longest streak: 7 in a row/)).toBeInTheDocument()

  // The finished round is sent once, with the game, the stars shown and the words that missed first time.
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/v1/learning/game-rounds')
  expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ game: 'fill-blank', stars: 3, mistakes: 0, wordCount: 7 })
})
