import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { errorResponse, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'

beforeEach(() => {
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

const base = { 'GET /api/v1/auth/me': () => jsonResponse(user) }
const key = 'vfq_ExampleKeyThatIsLongEnoughToLookReal0123456789ab'

async function card() {
  return within(await screen.findByRole('region', { name: 'Add words from other apps' }))
}

test('with no key yet it offers to make one, and shows the key once with a copy button', async () => {
  let made = false
  stubApi({
    ...base,
    'GET /api/v1/quick-add/key': () => jsonResponse(made ? { exists: true, createdAt: '2026-11-19T12:00:00Z', lastUsedAt: null } : { exists: false, createdAt: null, lastUsedAt: null }),
    'POST /api/v1/quick-add/key': () => {
      made = true
      return jsonResponse({ key, createdAt: '2026-11-19T12:00:00Z' })
    },
  })
  const browserUser = userEvent.setup()
  renderApp('/app/settings')

  const quick = await card()
  expect(await quick.findByText('No key yet.')).toBeInTheDocument()
  await browserUser.click(quick.getByRole('button', { name: 'Make a key' }))

  expect(await quick.findByLabelText('Your new key')).toHaveValue(key)
  expect(quick.getByText(/shown only this once/)).toBeInTheDocument()
  await browserUser.click(quick.getByRole('button', { name: 'Copy the key' }))
  expect(await quick.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  expect(await navigator.clipboard.readText()).toBe(key)
})

test('an existing key shows when it was made and last used, and never the key itself', async () => {
  stubApi({
    ...base,
    'GET /api/v1/quick-add/key': () => jsonResponse({ exists: true, createdAt: '2026-11-19T12:00:00Z', lastUsedAt: '2026-11-20T09:00:00Z' }),
  })
  renderApp('/app/settings')

  const quick = await card()
  expect(await quick.findByText(/A key was made on/)).toHaveTextContent('Last used on')
  expect(quick.queryByLabelText('Your new key')).not.toBeInTheDocument()
  expect(quick.getByRole('button', { name: 'Make a new key' })).toBeInTheDocument()
  expect(quick.getByRole('button', { name: 'Revoke the key' })).toBeInTheDocument()
})

test('a key that was never used says so', async () => {
  stubApi({ ...base, 'GET /api/v1/quick-add/key': () => jsonResponse({ exists: true, createdAt: '2026-11-19T12:00:00Z', lastUsedAt: null }) })
  renderApp('/app/settings')

  expect(await (await card()).findByText(/has not been used yet/)).toBeInTheDocument()
})

test('revoking asks first, then removes the key', async () => {
  let exists = true
  const fetchMock = stubApi({
    ...base,
    'GET /api/v1/quick-add/key': () => jsonResponse({ exists, createdAt: exists ? '2026-11-19T12:00:00Z' : null, lastUsedAt: null }),
    'DELETE /api/v1/quick-add/key': () => {
      exists = false
      return new Response(null, { status: 204 })
    },
  })
  const browserUser = userEvent.setup()
  renderApp('/app/settings')

  const quick = await card()
  await browserUser.click(await quick.findByRole('button', { name: 'Revoke the key' }))
  expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(false)
  await browserUser.click(quick.getByRole('button', { name: 'Keep it' }))
  expect(quick.getByRole('button', { name: 'Revoke the key' })).toBeInTheDocument()

  await browserUser.click(quick.getByRole('button', { name: 'Revoke the key' }))
  await browserUser.click(quick.getByRole('button', { name: 'Yes, revoke it' }))
  expect(await quick.findByText('No key yet.')).toBeInTheDocument()
  expect(quick.getByRole('button', { name: 'Make a key' })).toBeInTheDocument()
})

test('making a new key replaces the old one, and a failure is said', async () => {
  let fail = true
  stubApi({
    ...base,
    'GET /api/v1/quick-add/key': () => jsonResponse({ exists: true, createdAt: '2026-11-19T12:00:00Z', lastUsedAt: null }),
    'POST /api/v1/quick-add/key': () => (fail ? errorResponse(500, 'INTERNAL_ERROR', 'boom') : jsonResponse({ key, createdAt: '2026-11-19T13:00:00Z' })),
  })
  const browserUser = userEvent.setup()
  renderApp('/app/settings')

  const quick = await card()
  await browserUser.click(await quick.findByRole('button', { name: 'Make a new key' }))
  expect(await quick.findByRole('alert')).toHaveTextContent('did not work')

  fail = false
  await browserUser.click(quick.getByRole('button', { name: 'Make a new key' }))
  expect(await quick.findByLabelText('Your new key')).toHaveValue(key)
})
