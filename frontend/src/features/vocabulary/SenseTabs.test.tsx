import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test } from 'vitest'
import { SenseTabs } from './components/SenseTabs'
import type { VocabularySense } from './types/vocabulary'

afterEach(() => cleanup())

function sense(partOfSpeech: string | null, label: string | null, definition: string): VocabularySense {
  return { partOfSpeech, label, phonetic: `/${definition}/`, definition, examples: [`${definition} example`], collocations: [`${definition} combination`] }
}

const senses = [sense('noun', 'document', 'first'), sense('verb', 'start again', 'second'), sense('noun', 'third one', 'third')]

test('shows only the first meaning at the start, linked to its tab', () => {
  render(<SenseTabs headingLevel="h2" senses={senses} />)

  expect(screen.getByText('3 meanings')).toBeInTheDocument()
  expect(within(screen.getByRole('tablist', { name: 'Meanings' })).getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
    'noun · document',
    'verb · start again',
    'noun · third one',
  ])
  const panel = screen.getByRole('tabpanel', { name: 'noun · document' })
  expect(panel).toHaveTextContent('first example')
  expect(panel).toHaveTextContent('first combination')
  expect(panel).toHaveTextContent('/first/')
  expect(screen.queryByText('second')).not.toBeInTheDocument()
})

test('clicking a tab shows its meaning', async () => {
  const browserUser = userEvent.setup()
  render(<SenseTabs headingLevel="h2" senses={senses} />)

  await browserUser.click(screen.getByRole('tab', { name: 'verb · start again' }))

  expect(screen.getByRole('tabpanel', { name: 'verb · start again' })).toHaveTextContent('second example')
  expect(screen.getByRole('tab', { name: 'noun · document' })).toHaveAttribute('aria-selected', 'false')
})

test('the keyboard reaches only the selected tab, and arrows, Home and End move between tabs', async () => {
  const browserUser = userEvent.setup()
  render(<SenseTabs headingLevel="h2" senses={senses} />)
  const [first, second, third] = screen.getAllByRole('tab')

  await browserUser.tab()
  expect(first).toHaveFocus()
  expect(second).toHaveAttribute('tabindex', '-1')

  await browserUser.keyboard('{ArrowRight}')
  expect(second).toHaveFocus()
  expect(second).toHaveAttribute('aria-selected', 'true')
  expect(second).toHaveAttribute('tabindex', '0')

  await browserUser.keyboard('{End}')
  expect(third).toHaveFocus()
  await browserUser.keyboard('{ArrowRight}')
  expect(first).toHaveFocus()
  await browserUser.keyboard('{ArrowLeft}')
  expect(third).toHaveFocus()
  await browserUser.keyboard('{Home}')
  expect(first).toHaveFocus()
  expect(screen.getByRole('tabpanel', { name: 'noun · document' })).toBeInTheDocument()
})

test('a single meaning has no tabs and no count', () => {
  render(<SenseTabs headingLevel="h2" senses={[sense('noun', null, 'only')]} />)

  expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  expect(screen.queryByText(/meanings/)).not.toBeInTheDocument()
  expect(screen.getByText('only')).toBeInTheDocument()
})

test('a tab without a part of speech or label still has a name', () => {
  render(<SenseTabs headingLevel="h2" senses={[sense(null, null, 'one'), sense(null, null, 'two')]} />)

  expect(screen.getByRole('tab', { name: 'Meaning 2' })).toBeInTheDocument()
})

test('uses the heading level the page needs', () => {
  render(<SenseTabs headingLevel="h3" senses={senses} />)

  expect(screen.getByRole('heading', { level: 3, name: 'Examples' })).toBeInTheDocument()
})
