import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { PairGame } from './PairGame'
import type { MatchPair } from './matching'

afterEach(() => cleanup())

const pairs: MatchPair[] = Array.from({ length: 7 }, (_, index) => ({ id: index + 1, term: `word${index + 1}`, definition: `Meaning ${index + 1}.` }))

async function place(browserUser: ReturnType<typeof userEvent.setup>, ids: number[]) {
  for (const id of ids) {
    await browserUser.click(screen.getByRole('button', { name: `word${id}` }))
    await browserUser.click(screen.getByRole('button', { name: `Meaning ${id}.` }))
  }
}

test('a game of two rounds carries the score, the streak and the bar from the first round into the second', async () => {
  const browserUser = userEvent.setup()
  render(
    <MemoryRouter>
      <PairGame intro={{ icon: '🧩', title: 'Ready?', text: ({ words, rounds }) => `${words} words in ${rounds} rounds` }} minimum={4} notEnough={<p>none</p>} onAgain={vi.fn()} pairs={pairs} />
    </MemoryRouter>,
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
})
