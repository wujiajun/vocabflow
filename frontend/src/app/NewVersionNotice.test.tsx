import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { latestBundle } from '../shared/appVersion'
import { expectNoAxeViolations } from '../test/axe'
import { NewVersionNotice } from './NewVersionNotice'

const page = (script: string) =>
  `<!doctype html><html><head><script type="module" crossorigin src="${script}"></script><link rel="stylesheet" href="/assets/index-X.css"></head><body><div id="root"></div></body></html>`

function loadedWith(src: string | null) {
  document.head.querySelectorAll('script[data-test]').forEach((element) => element.remove())
  if (src) {
    const script = document.createElement('script')
    script.setAttribute('src', src)
    script.setAttribute('data-test', 'true')
    document.head.append(script)
  }
}

function serverHas(script: string | null, ok = true) {
  return vi.fn(async () => new Response(script ? page(script) : 'not a page', { status: ok ? 200 : 500 }))
}

async function comeBack() {
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => {
  cleanup()
  loadedWith(null)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('offers a reload when the app comes back into view and the server has a newer build', async () => {
  document.title = 'VocabFlow'
  loadedWith('/assets/index-OLD.js')
  const fetchMock = serverHas('/assets/index-NEW.js')
  vi.stubGlobal('fetch', fetchMock)
  const onReload = vi.fn()
  vi.useRealTimers()
  const browserUser = userEvent.setup()

  render(
    <main>
      <h1>VocabFlow</h1>
      <NewVersionNotice onReload={onReload} />
    </main>,
  )
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  await comeBack()

  expect(await screen.findByRole('status')).toHaveTextContent('A new version is available.')
  expect(fetchMock).toHaveBeenCalledWith('/', expect.objectContaining({ cache: 'no-store' }))
  await expectNoAxeViolations()
  await browserUser.click(screen.getByRole('button', { name: 'Reload' }))
  expect(onReload).toHaveBeenCalledTimes(1)
})

test('says nothing while the server has the same build, or cannot be read', async () => {
  loadedWith('/assets/index-OLD.js')
  render(<NewVersionNotice />)

  vi.stubGlobal('fetch', serverHas('/assets/index-OLD.js'))
  await comeBack()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()

  vi.setSystemTime(Date.now() + 60_000)
  vi.stubGlobal('fetch', serverHas('/assets/index-NEW.js', false))
  await comeBack()
  vi.setSystemTime(Date.now() + 120_000)
  vi.stubGlobal('fetch', serverHas(null))
  await comeBack()
  vi.setSystemTime(Date.now() + 180_000)
  vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
  await comeBack()

  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('looks at most once in half a minute, and not at all when there is no built script to compare', async () => {
  loadedWith('/assets/index-OLD.js')
  const fetchMock = serverHas('/assets/index-OLD.js')
  vi.stubGlobal('fetch', fetchMock)
  render(<NewVersionNotice />)

  await comeBack()
  await comeBack()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  vi.setSystemTime(Date.now() + 31_000)
  await comeBack()
  expect(fetchMock).toHaveBeenCalledTimes(2)

  cleanup()
  loadedWith('/src/main.tsx')
  const unusedFetch = serverHas('/assets/index-NEW.js')
  vi.stubGlobal('fetch', unusedFetch)
  render(<NewVersionNotice />)
  await comeBack()
  expect(unusedFetch).not.toHaveBeenCalled()
})

test('reads the script out of the page the way vite builds it', async () => {
  vi.stubGlobal('fetch', serverHas('/assets/index-D6QIeAsr.js'))

  expect(await latestBundle()).toBe('/assets/index-D6QIeAsr.js')
})
