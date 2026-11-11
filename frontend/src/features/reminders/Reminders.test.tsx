import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { emptyStudyQueue, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'

const endpoint = 'https://push.example.test/abc'
let subscribed: boolean
let permission: NotificationPermission
let stored: Array<{ endpoint: string; remindAt: string }>
const subscription = {
  endpoint,
  toJSON: () => ({ endpoint, keys: { p256dh: 'p-key', auth: 'a-key' } }),
  unsubscribe: vi.fn(async () => {
    subscribed = false
    return true
  }),
}
const pushManager = {
  getSubscription: vi.fn(async () => (subscribed ? subscription : null)),
  subscribe: vi.fn(async () => {
    subscribed = true
    return subscription
  }),
}
const registration = { pushManager }

function installPush() {
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('PushManager', class {})
  vi.stubGlobal('Notification', {
    get permission() {
      return permission
    },
    requestPermission: vi.fn(async () => permission),
  })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: vi.fn(async () => registration),
      getRegistration: vi.fn(async () => registration),
      ready: Promise.resolve(registration),
    },
  })
}

function routes(enabled = true) {
  return {
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/push/config': () => jsonResponse({ enabled, publicKey: enabled ? 'BAQB' : null }),
    'GET /api/v1/push/subscription': () => jsonResponse(stored),
    'POST /api/v1/push/subscription': ({ init }: { init: RequestInit }) => {
      const body = JSON.parse(String(init.body)) as { endpoint: string; remindAt: string }
      stored = [{ endpoint: body.endpoint, remindAt: body.remindAt }]
      return new Response(null, { status: 204 })
    },
    'DELETE /api/v1/push/subscription': () => {
      stored = []
      return new Response(null, { status: 204 })
    },
    'GET /api/v1/learning/study-queue': () => jsonResponse(emptyStudyQueue),
    'GET /api/v1/reading/today': () => jsonResponse({ passageId: null }),
  }
}

beforeEach(() => {
  subscribed = false
  permission = 'default'
  stored = []
  pushManager.subscribe.mockClear()
  subscription.unsubscribe.mockClear()
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'serviceWorker')
  expectNoUnexpectedRequests()
})

test('switching it on asks for permission, subscribes and saves the time', async () => {
  installPush()
  permission = 'granted'
  const fetchMock = stubApi(routes())
  const browserUser = userEvent.setup()

  renderApp('/app/settings')
  const toggle = await screen.findByRole('checkbox', { name: 'Remind me to study' })
  await waitFor(() => expect(toggle).toBeEnabled())
  expect(screen.getByLabelText('Reminder time')).toHaveValue('19:00')
  await browserUser.click(toggle)

  await waitFor(() => expect(toggle).toBeChecked())
  expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }))
  const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST' && String(init.body).includes('endpoint'))
  expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ endpoint, p256dh: 'p-key', auth: 'a-key', remindAt: '19:00' })
})

test('a saved reminder shows its time, can be moved and switched off', async () => {
  installPush()
  permission = 'granted'
  subscribed = true
  stored = [{ endpoint, remindAt: '20:30' }]
  const fetchMock = stubApi(routes())
  const browserUser = userEvent.setup()

  renderApp('/app/settings')
  const toggle = await screen.findByRole('checkbox', { name: 'Remind me to study' })
  await waitFor(() => expect(toggle).toBeChecked())
  const time = screen.getByLabelText('Reminder time')
  expect(time).toHaveValue('20:30')

  fireEvent.change(time, { target: { value: '18:15' } })
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST' && String(init.body).includes('"remindAt":"18:15"'))).toBe(true),
  )

  await browserUser.click(toggle)
  await waitFor(() => expect(toggle).not.toBeChecked())
  expect(subscription.unsubscribe).toHaveBeenCalled()
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true)
})

test('refusing the permission leaves it off and explains how to allow it', async () => {
  installPush()
  permission = 'denied'
  stubApi(routes())
  const browserUser = userEvent.setup()

  renderApp('/app/settings')
  const toggle = await screen.findByRole('checkbox', { name: 'Remind me to study' })
  await screen.findByText(/Notifications are blocked/)

  expect(toggle).toBeDisabled()
  expect(toggle).not.toBeChecked()
  await browserUser.click(toggle)
  expect(pushManager.subscribe).not.toHaveBeenCalled()
})

test('says so when the server has no keys', async () => {
  installPush()
  stubApi(routes(false))

  renderApp('/app/settings')

  expect(await screen.findByText('Reminders are not set up on this server yet.')).toBeInTheDocument()
  expect(screen.queryByRole('checkbox', { name: 'Remind me to study' })).not.toBeInTheDocument()
})

test('explains that plain http cannot do reminders, without asking the server', async () => {
  vi.stubGlobal('isSecureContext', false)
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/learning/study-queue': () => jsonResponse(emptyStudyQueue),
    'GET /api/v1/reading/today': () => jsonResponse({ passageId: null }),
  })

  renderApp('/app/settings')

  expect(await screen.findByText(/need a secure \(https\) address/)).toBeInTheDocument()
})

test('an iPhone outside the Home Screen is told to add the app', async () => {
  vi.stubGlobal('isSecureContext', true)
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/learning/study-queue': () => jsonResponse(emptyStudyQueue),
    'GET /api/v1/reading/today': () => jsonResponse({ passageId: null }),
  })

  renderApp('/app/settings')

  expect(await screen.findByText(/added to the Home Screen/)).toBeInTheDocument()
})
