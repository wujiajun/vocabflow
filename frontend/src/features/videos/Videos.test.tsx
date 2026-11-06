import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { expectNoAxeViolations } from '../../test/axe'
import { errorResponse, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'
import { playerTimings } from './components/youtubeApi'

beforeEach(() => {
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  playerTimings.saveEveryMs = 15000
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

interface Fixture {
  id: string
  title: string
  clbMin: number
  clbMax: number
  videos: { id: string; title: string; durationSeconds: number }[]
}

const fixtures: Fixture[] = [
  { id: 'starter', title: 'Starter lessons', clbMin: 1, clbMax: 3, videos: [{ id: 'AAAAAAAAA01', title: 'First steps', durationSeconds: 60 }, { id: 'AAAAAAAAA02', title: 'Second steps', durationSeconds: 200 }] },
  {
    id: 'middle',
    title: 'Middle lessons',
    clbMin: 3,
    clbMax: 5,
    videos: [
      { id: 'BBBBBBBBB01', title: 'Greetings', durationSeconds: 120 },
      { id: 'BBBBBBBBB02', title: 'At the bank', durationSeconds: 300 },
      { id: 'BBBBBBBBB03', title: 'A long talk', durationSeconds: 1800 },
      { id: 'BBBBBBBBB04', title: 'Shopping', durationSeconds: 90 },
    ],
  },
  { id: 'upper', title: 'Upper lessons', clbMin: 6, clbMax: 8, videos: [{ id: 'CCCCCCCCC01', title: 'Debate', durationSeconds: 1834 }] },
]

// A small stand-in for the server that remembers what was marked and where each video stands. It applies
// the rules of the real one: below ten seconds nothing is kept, and nine tenths counts as watched.
function server(watched = new Set<string>(), seen: string[] = [], places = new Map<string, number>(), times = new Map<string, string>()) {
  let clock = 0
  const detail = (fixture: Fixture) => {
    const videos = fixture.videos.map((video) => ({ ...video, channel: 'A channel', watched: watched.has(video.id), positionSeconds: places.get(video.id) ?? null, positionUpdatedAt: places.has(video.id) ? (times.get(video.id) ?? '2026-11-01T00:00:00Z') : null }))
    return { id: fixture.id, title: fixture.title, source: 'A source', description: `About ${fixture.title}.`, clbMin: fixture.clbMin, clbMax: fixture.clbMax, watchedCount: videos.filter((video) => video.watched).length, videos }
  }
  const routes: Record<string, (request: { init: RequestInit }) => Response> = {
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/videos/albums': () =>
      jsonResponse(
        fixtures.map((fixture) => {
          const full = detail(fixture)
          return { id: full.id, title: full.title, source: full.source, description: full.description, clbMin: full.clbMin, clbMax: full.clbMax, videoCount: full.videos.length, watchedCount: full.watchedCount, coverVideoId: full.videos[0].id }
        }),
      ),
  }
  for (const fixture of fixtures) {
    routes[`GET /api/v1/videos/albums/${fixture.id}`] = () => jsonResponse(detail(fixture))
    for (const video of fixture.videos) {
      routes[`PUT /api/v1/videos/${video.id}/watched`] = () => {
        watched.add(video.id)
        places.delete(video.id)
        seen.push(`PUT ${video.id}`)
        return new Response(null, { status: 204 })
      }
      routes[`DELETE /api/v1/videos/${video.id}/watched`] = () => {
        watched.delete(video.id)
        places.delete(video.id)
        seen.push(`DELETE ${video.id}`)
        return new Response(null, { status: 204 })
      }
      routes[`PUT /api/v1/videos/${video.id}/position`] = ({ init }) => {
        const seconds = (JSON.parse(String(init.body)) as { seconds: number }).seconds
        seen.push(`POSITION ${video.id} ${seconds}${init.keepalive ? ' keepalive' : ''}`)
        if (seconds >= video.durationSeconds * 0.9) {
          watched.add(video.id)
          places.delete(video.id)
        } else if (seconds < 10) {
          places.delete(video.id)
        } else {
          places.set(video.id, seconds)
          clock += 1
          times.set(video.id, `2026-11-05T12:00:${String(clock).padStart(2, '0')}Z`)
        }
        return new Response(null, { status: 204 })
      }
    }
  }
  return routes
}

// Stands in for YouTube's script: remembers the players made, so a test can set their clock and change their state.
interface FakePlayerHandle {
  events: { onStateChange: (event: { data: number }) => void }
  time: number
}

function installYouTube() {
  const players: FakePlayerHandle[] = []
  class FakePlayer {
    handle: FakePlayerHandle
    constructor(_frame: HTMLIFrameElement, options: { events: FakePlayerHandle['events'] }) {
      this.handle = { events: options.events, time: 0 }
      players.push(this.handle)
    }
    getCurrentTime() {
      return this.handle.time
    }
  }
  vi.stubGlobal('YT', { Player: FakePlayer, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 } })
  return players
}

const titles = (list: HTMLElement) => within(list).getAllByRole('listitem').map((item) => within(item).getAllByRole('button')[0].textContent)

test('shows the albums for the learner’s own CLB level, and every level when asked, filtered by band', async () => {
  stubApi(server(new Set(['BBBBBBBBB01'])))
  const browserUser = userEvent.setup()
  renderApp('/app/reading/videos')

  await screen.findByRole('heading', { name: 'Middle lessons' })
  expect(screen.getByText(/Showing the albums for your level, CLB 4\./)).toBeInTheDocument()
  const albums = screen.getByRole('region', { name: 'Video albums' })
  expect(within(albums).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Middle lessons'])
  expect(within(albums).getByText('CLB 3–5')).toBeInTheDocument()
  expect(within(albums).getByText('1 of 4 watched')).toBeInTheDocument()
  expect(within(albums).getByRole('link', { name: /Middle lessons/ })).toHaveAttribute('href', '/app/reading/videos/middle')
  await expectNoAxeViolations()

  await browserUser.click(screen.getByRole('link', { name: 'Show all levels' }))
  expect(within(screen.getByRole('region', { name: 'Video albums' })).getAllByRole('heading', { level: 2 })).toHaveLength(3)
  const filter = screen.getByRole('navigation', { name: 'Filter by level' })
  expect(within(filter).getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'true')

  // 6–7 holds only the upper album; 1–3 holds the starter one and the middle one that reaches down to 3.
  await browserUser.click(within(filter).getByRole('link', { name: 'CLB 6–7' }))
  expect(within(screen.getByRole('region', { name: 'Video albums' })).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Upper lessons'])
  await browserUser.click(within(filter).getByRole('link', { name: 'CLB 1–3' }))
  expect(within(screen.getByRole('region', { name: 'Video albums' })).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Starter lessons', 'Middle lessons'])
  await browserUser.click(screen.getByRole('link', { name: 'Show only my level' }))
  expect(await screen.findByText(/Showing the albums for your level/)).toBeInTheDocument()
})

test('the reading tab offers passages and videos side by side', async () => {
  stubApi(server())
  renderApp('/app/reading/videos')

  const nav = await screen.findByRole('navigation', { name: 'Reading sections' })
  expect(within(nav).getByRole('link', { name: 'Videos' })).toHaveAttribute('aria-current', 'true')
  expect(within(nav).getByRole('link', { name: 'Passages' })).toHaveAttribute('href', '/app/reading')
})

test('an album splits its videos into short and long, the ones not yet watched first', async () => {
  stubApi(server(new Set(['BBBBBBBBB01'])))
  const browserUser = userEvent.setup()
  renderApp('/app/reading/videos/middle')

  expect(await screen.findByRole('heading', { name: 'Middle lessons' })).toBeInTheDocument()
  expect(screen.getByText('1 of 4 watched')).toBeInTheDocument()
  await expectNoAxeViolations()

  const group = screen.getByRole('group', { name: 'Length of the videos' })
  expect(within(group).getByRole('button', { name: 'Short · 3' })).toHaveAttribute('aria-pressed', 'true')
  // Greetings is watched, so it goes last; the others keep the album's order.
  const short = screen.getByRole('list', { name: 'Short videos' })
  expect(titles(short).map((text) => text?.replace(/\d+:\d+/, '').replace(/^.*?(At the bank|Shopping|Greetings).*$/, '$1'))).toEqual(['At the bank', 'Shopping', 'Greetings'])
  expect(within(short).getAllByText('✓ Watched')).toHaveLength(1)

  await browserUser.click(within(group).getByRole('button', { name: 'Long · 1' }))
  expect(within(screen.getByRole('list', { name: 'Long videos' })).getAllByRole('listitem')).toHaveLength(1)
  expect(screen.getByText('30:00')).toBeInTheDocument()
})

test('an album with only one length shows no switch, and a missing album says so', async () => {
  stubApi({ ...server(), 'GET /api/v1/videos/albums/nope': () => errorResponse(404, 'NOT_FOUND', 'Album was not found') })
  renderApp('/app/reading/videos/upper')

  expect(await screen.findByRole('heading', { name: 'Upper lessons' })).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Length of the videos' })).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Long videos (over 10 minutes)' })).toBeInTheDocument()
  cleanup()

  stubApi({ ...server(), 'GET /api/v1/videos/albums/nope': () => errorResponse(404, 'NOT_FOUND', 'Album was not found') })
  renderApp('/app/reading/videos/nope')
  expect(await screen.findByRole('heading', { name: 'We couldn’t find that album' })).toBeInTheDocument()
})

test('a video is marked and unmarked as watched by hand, and the server is told', async () => {
  const seen: string[] = []
  stubApi(server(new Set(), seen))
  const browserUser = userEvent.setup()
  renderApp('/app/reading/videos/starter')
  await screen.findByRole('heading', { name: 'Starter lessons' })

  await browserUser.click(screen.getAllByRole('button', { name: 'Mark as watched' })[0])
  await waitFor(() => expect(seen).toEqual(['PUT AAAAAAAAA01']))
  expect(await screen.findByText('1 of 2 watched')).toBeInTheDocument()

  await browserUser.click(screen.getByRole('button', { name: 'Mark as not watched' }))
  await waitFor(() => expect(seen).toEqual(['PUT AAAAAAAAA01', 'DELETE AAAAAAAAA01']))
  expect(await screen.findByText('0 of 2 watched')).toBeInTheDocument()
})

test('playing a video opens YouTube’s player, which marks it as watched when it ends', async () => {
  const players = installYouTube()
  const seen: string[] = []
  stubApi(server(new Set(), seen))
  const browserUser = userEvent.setup()
  renderApp('/app/reading/videos/starter')
  await screen.findByRole('heading', { name: 'Starter lessons' })

  await browserUser.click(screen.getByRole('button', { name: /First steps/ }))

  const frame = await screen.findByTitle('Video: First steps')
  const source = new URL(frame.getAttribute('src') ?? '')
  expect(source.origin + source.pathname).toBe('https://www.youtube-nocookie.com/embed/AAAAAAAAA01')
  expect(source.searchParams.get('enablejsapi')).toBe('1')
  expect(source.searchParams.get('playsinline')).toBe('1')
  expect(source.searchParams.get('cc_load_policy')).toBe('1')
  // The app sends no referrer, so this frame carries its own policy.
  expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
  await waitFor(() => expect(players).toHaveLength(1))

  // Not the end yet.
  act(() => players[0].events.onStateChange({ data: 1 }))
  expect(seen).toEqual([])
  act(() => players[0].events.onStateChange({ data: 0 }))
  await waitFor(() => expect(seen).toEqual(['PUT AAAAAAAAA01']))

  // Opening another video closes the first, and pressing the open one closes it.
  await browserUser.click(screen.getByRole('button', { name: /Second steps/ }))
  expect(screen.queryByTitle('Video: First steps')).not.toBeInTheDocument()
  expect(screen.getByTitle('Video: Second steps')).toBeInTheDocument()
  await browserUser.click(screen.getByRole('button', { name: /Second steps/ }))
  expect(screen.queryByTitle('Video: Second steps')).not.toBeInTheDocument()
})

test('the video that is playing keeps its place when it ends and is marked', async () => {
  const players = installYouTube()
  stubApi(server())
  const browserUser = userEvent.setup()
  renderApp('/app/reading/videos/starter')
  await screen.findByRole('heading', { name: 'Starter lessons' })
  const list = screen.getByRole('list', { name: 'Short videos' })

  await browserUser.click(screen.getByRole('button', { name: /First steps/ }))
  await waitFor(() => expect(players).toHaveLength(1))
  act(() => players[0].events.onStateChange({ data: 0 }))
  expect(await screen.findByText('✓ Watched')).toBeInTheDocument()

  expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('First steps')
  await browserUser.click(screen.getByRole('button', { name: /First steps/ }))
  expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Second steps')
})

test('when YouTube’s script cannot load, the video still plays and the learner is told to mark it by hand', async () => {
  stubApi(server())
  const browserUser = userEvent.setup()
  renderApp('/app/reading/videos/starter')
  await screen.findByRole('heading', { name: 'Starter lessons' })

  await browserUser.click(screen.getByRole('button', { name: /First steps/ }))
  expect(await screen.findByTitle('Video: First steps')).toBeInTheDocument()
  const script = await waitFor(() => {
    const found = document.head.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]')
    expect(found).not.toBeNull()
    return found as HTMLScriptElement
  })
  act(() => {
    script.dispatchEvent(new Event('error'))
  })

  expect(await screen.findByText(/will not be marked as watched by itself/)).toBeInTheDocument()
  expect(screen.getByTitle('Video: First steps')).toBeInTheDocument()
})

const PLAYING = 1
const PAUSED = 2

test('a video that was started shows where the learner stopped, comes first, and opens from a little before it', async () => {
  stubApi(server(new Set(), [], new Map([['AAAAAAAAA02', 150]])))
  const browserUser = userEvent.setup()
  renderApp('/app/reading/videos/starter')
  await screen.findByRole('heading', { name: 'Starter lessons' })

  const list = screen.getByRole('list', { name: 'Short videos' })
  expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Second steps')
  expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Continue from 2:30')
  expect(within(list).getAllByRole('listitem')[1]).not.toHaveTextContent('Continue from')

  await browserUser.click(screen.getByRole('button', { name: /Second steps/ }))
  expect(new URL(screen.getByTitle('Video: Second steps').getAttribute('src') ?? '').searchParams.get('start')).toBe('145')
  // A video not started opens at the beginning, with no start at all.
  await browserUser.click(screen.getByRole('button', { name: /First steps/ }))
  expect(new URL(screen.getByTitle('Video: First steps').getAttribute('src') ?? '').searchParams.has('start')).toBe(false)
})

test('where the learner stops is saved when the video pauses and when the player is closed', async () => {
  const players = installYouTube()
  const seen: string[] = []
  stubApi(server(new Set(), seen))
  const browserUser = userEvent.setup()
  renderApp('/app/reading/videos/starter')
  await screen.findByRole('heading', { name: 'Starter lessons' })

  await browserUser.click(screen.getByRole('button', { name: /Second steps/ }))
  await waitFor(() => expect(players).toHaveLength(1))
  players[0].time = 70
  act(() => players[0].events.onStateChange({ data: PAUSED }))
  await waitFor(() => expect(seen).toEqual(['POSITION AAAAAAAAA02 70']))
  expect(await screen.findByText('Continue from 1:10')).toBeInTheDocument()

  // Closing the player saves the place it has reached.
  players[0].time = 95
  await browserUser.click(screen.getByRole('button', { name: /Second steps/ }))
  await waitFor(() => expect(seen).toEqual(['POSITION AAAAAAAAA02 70', 'POSITION AAAAAAAAA02 95 keepalive']))
  expect(await screen.findByText('Continue from 1:35')).toBeInTheDocument()
})

test('a video not yet started leaves no place when it is closed within its first seconds', async () => {
  const players = installYouTube()
  const seen: string[] = []
  stubApi(server(new Set(), seen))
  const browserUser = userEvent.setup()
  renderApp('/app/reading/videos/starter')
  await screen.findByRole('heading', { name: 'Starter lessons' })

  await browserUser.click(screen.getByRole('button', { name: /First steps/ }))
  await waitFor(() => expect(players).toHaveLength(1))
  players[0].time = 4
  await browserUser.click(screen.getByRole('button', { name: /First steps/ }))

  expect(seen).toEqual([])
  expect(screen.queryByText(/Continue from/)).not.toBeInTheDocument()
})

test('while a video plays its place is saved every so often, and when the page is hidden', async () => {
  playerTimings.saveEveryMs = 30
  const players = installYouTube()
  const seen: string[] = []
  stubApi(server(new Set(), seen))
  const browserUser = userEvent.setup()
  renderApp('/app/reading/videos/starter')
  await screen.findByRole('heading', { name: 'Starter lessons' })
  await browserUser.click(screen.getByRole('button', { name: /Second steps/ }))
  await waitFor(() => expect(players).toHaveLength(1))

  players[0].time = 20
  act(() => players[0].events.onStateChange({ data: PLAYING }))
  await waitFor(() => expect(seen).toContain('POSITION AAAAAAAAA02 20'))
  // Pausing stops the clock: nothing more is saved by it after this one.
  players[0].time = 33
  act(() => players[0].events.onStateChange({ data: PAUSED }))
  await waitFor(() => expect(seen).toContain('POSITION AAAAAAAAA02 33'))
  const count = seen.length
  players[0].time = 50
  await new Promise((resolve) => setTimeout(resolve, 120))
  expect(seen).toHaveLength(count)

  // Hidden (the phone is locked or another app is opened): saved at once, in a way that survives the page.
  const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await waitFor(() => expect(seen).toContain('POSITION AAAAAAAAA02 50 keepalive'))
  hidden.mockRestore()
})

test('a video played to nine tenths counts as watched and loses its place', async () => {
  const players = installYouTube()
  stubApi(server())
  const browserUser = userEvent.setup()
  renderApp('/app/reading/videos/starter')
  await screen.findByRole('heading', { name: 'Starter lessons' })
  await browserUser.click(screen.getByRole('button', { name: /First steps/ }))
  await waitFor(() => expect(players).toHaveLength(1))

  players[0].time = 56 // of 60 seconds
  act(() => players[0].events.onStateChange({ data: PAUSED }))

  expect(await screen.findByText('✓ Watched')).toBeInTheDocument()
  expect(screen.getByText('1 of 2 watched')).toBeInTheDocument()
  expect(screen.queryByText(/Continue from/)).not.toBeInTheDocument()
})

test('marking a video by hand clears where the learner stopped', async () => {
  stubApi(server(new Set(), [], new Map([['AAAAAAAAA02', 150]])))
  const browserUser = userEvent.setup()
  renderApp('/app/reading/videos/starter')
  await screen.findByText('Continue from 2:30')

  await browserUser.click(within(screen.getAllByRole('listitem')[0]).getByRole('button', { name: 'Mark as watched' }))

  expect(await screen.findByText('✓ Watched')).toBeInTheDocument()
  expect(screen.queryByText(/Continue from/)).not.toBeInTheDocument()
})

test('among the videos started, the one watched last comes first, ahead of those not yet watched', async () => {
  const places = new Map([['BBBBBBBBB01', 30], ['BBBBBBBBB04', 20]])
  const times = new Map([['BBBBBBBBB01', '2026-11-03T09:00:00Z'], ['BBBBBBBBB04', '2026-11-04T09:00:00Z']])
  stubApi(server(new Set(), [], places, times))
  renderApp('/app/reading/videos/middle')
  await screen.findByRole('heading', { name: 'Middle lessons' })

  const items = within(screen.getByRole('list', { name: 'Short videos' })).getAllByRole('listitem')
  // Shopping was stopped after Greetings, so it is first; At the bank, not started, follows.
  expect(items.map((item) => within(item).getAllByRole('button')[0].textContent)).toEqual([
    expect.stringContaining('Shopping'),
    expect.stringContaining('Greetings'),
    expect.stringContaining('At the bank'),
  ])
})
