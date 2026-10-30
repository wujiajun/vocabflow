import { screen } from '@testing-library/react'
import axe from 'axe-core'
import { expect } from 'vitest'

// jsdom does no layout or painting, so axe cannot compute colors there; contrast has to be
// checked in a real browser. It also never loads index.html, so the page language is checked
// against that file directly (see AxeScan.test.tsx) instead of by axe.
export async function expectNoAxeViolations() {
  // axe's heading rules accept a page whose first heading is an h3, so check the h1 ourselves.
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)

  const results = await axe.run(document, {
    rules: { 'color-contrast': { enabled: false }, 'html-has-lang': { enabled: false } },
  })

  expect(
    results.violations.map(
      (violation) => `${violation.id} (${violation.impact}): ${violation.help} -> ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([])
}
