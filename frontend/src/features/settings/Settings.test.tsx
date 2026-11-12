import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from '../../shared/api/tokenStorage'
import { installSpeechSynthesis, voice } from '../../test/speech'
import { emptyStudyQueue, errorResponse, expectNoUnexpectedRequests, jsonResponse, renderApp, stubApi, user } from '../../test/utils'

let fetchedUser: Omit<typeof user, 'dailyNewVocabularyGoal'> & { dailyNewVocabularyGoal: number } = user

beforeEach(() => {
  fetchedUser = user
  clearToken()
  setToken('valid-token')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  expectNoUnexpectedRequests()
})

async function changeGoal(value: string) {
  const browserUser = userEvent.setup()
  const input = await screen.findByLabelText('Daily new vocabulary goal')
  await browserUser.clear(input)
  await browserUser.type(input, value)
  await browserUser.click(screen.getByRole('button', { name: 'Save' }))
  return input
}

test('is reachable from the navigation and shows the current goal', async () => {
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/learning/study-queue': () => jsonResponse(emptyStudyQueue),
    'GET /api/v1/reading/today': () => jsonResponse({ passageId: null }),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/study')
  await browserUser.click(await screen.findByRole('link', { name: 'Settings' }))

  expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  expect(document.title).toBe('Settings · VocabFlow')
  expect(screen.getByLabelText('Daily new vocabulary goal')).toHaveValue(user.dailyNewVocabularyGoal)
})

test('saves the goal, confirms it, keeps it, and drops the confirmation on the next edit', async () => {
  const fetchMock = stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(fetchedUser),
    'PATCH /api/v1/auth/me': () => {
      fetchedUser = { ...user, dailyNewVocabularyGoal: 25 }
      return jsonResponse(fetchedUser)
    },
    'GET /api/v1/learning/study-queue': () => jsonResponse(emptyStudyQueue),
    'GET /api/v1/reading/today': () => jsonResponse({ passageId: null }),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/settings')
  const input = await changeGoal('25')

  expect(await screen.findByRole('status')).toHaveTextContent('Saved.')
  const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')
  expect(JSON.parse(patch?.[1]?.body as string)).toEqual({ dailyNewVocabularyGoal: 25 })

  await browserUser.type(input, '1')
  expect(screen.getByRole('status')).toBeEmptyDOMElement()

  await browserUser.click(screen.getByRole('link', { name: 'Study' }))
  await screen.findByRole('heading', { name: 'Nothing to study yet' })
  await browserUser.click(screen.getByRole('link', { name: 'Settings' }))
  expect(await screen.findByLabelText('Daily new vocabulary goal')).toHaveValue(25)
})

test('shows the new goal straight away, without waiting to read the user again', async () => {
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'PATCH /api/v1/auth/me': () => jsonResponse({ ...user, dailyNewVocabularyGoal: 25 }),
    'GET /api/v1/learning/study-queue': () => jsonResponse(emptyStudyQueue),
    'GET /api/v1/reading/today': () => jsonResponse({ passageId: null }),
  })
  const browserUser = userEvent.setup()

  // The app keeps data fresh for 30 seconds; the test client would otherwise re-read on every mount.
  renderApp('/app/settings', (client) => client.setDefaultOptions({ queries: { retry: false, staleTime: 30_000 } }))
  await changeGoal('25')
  await screen.findByText('Saved.')
  await browserUser.click(screen.getByRole('link', { name: 'Study' }))
  await screen.findByRole('heading', { name: 'Nothing to study yet' })
  await browserUser.click(screen.getByRole('link', { name: 'Settings' }))

  expect(await screen.findByLabelText('Daily new vocabulary goal')).toHaveValue(25)
})

test.each(['0', '101', '2.5'])('refuses %s without asking the server', async (value) => {
  const fetchMock = stubApi({ 'GET /api/v1/auth/me': () => jsonResponse(user) })

  renderApp('/app/settings')
  const input = await changeGoal(value)

  expect(await screen.findByRole('alert')).toHaveTextContent('Daily goal must be a whole number between 1 and 100.')
  expect(input).toHaveAttribute('aria-invalid', 'true')
  expect(input).toHaveAccessibleDescription(/Daily goal must be/)
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
})

test('the field can be emptied, an empty goal is refused, and a saved value is tidied', async () => {
  const fetchMock = stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'PATCH /api/v1/auth/me': () => jsonResponse({ ...user, dailyNewVocabularyGoal: 3 }),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/settings')
  const input = await screen.findByLabelText('Daily new vocabulary goal')
  await browserUser.clear(input)
  expect(input).toHaveValue(null)
  await browserUser.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Daily goal must be a whole number between 1 and 100.')
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)

  await browserUser.type(input, '03')
  await browserUser.click(screen.getByRole('button', { name: 'Save' }))

  await screen.findByText('Saved.')
  const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')
  expect(JSON.parse(patch?.[1]?.body as string)).toEqual({ dailyNewVocabularyGoal: 3 })
  expect(input).toHaveDisplayValue('3')
})

test('shows the current CLB level and saves a change to it on its own', async () => {
  let current = { ...user }
  const fetchMock = stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(current),
    'PATCH /api/v1/auth/me': ({ init }) => {
      current = { ...current, ...JSON.parse(String(init.body)) }
      return jsonResponse(current)
    },
  })
  const browserUser = userEvent.setup()

  renderApp('/app/settings')
  const select = await screen.findByLabelText('CLB level')
  expect(select).toHaveValue('CLB_4')
  expect(select).toHaveAccessibleDescription(/one level below it/)

  await browserUser.selectOptions(select, 'CLB 7')
  await browserUser.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByRole('status')).toHaveTextContent('Saved.')
  const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')
  expect(JSON.parse(patch?.[1]?.body as string)).toEqual({ clbLevel: 'CLB_7' })
  expect(select).toHaveValue('CLB_7')
})

test('the time zone defaults to the device, can be chosen and can be put back', async () => {
  let current: typeof user & { timeZone: string | null } = { ...user }
  const fetchMock = stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(current),
    'PATCH /api/v1/auth/me': ({ init }) => {
      const body = JSON.parse(String(init.body))
      current = { ...current, timeZone: body.timeZone === '' ? null : body.timeZone }
      return jsonResponse(current)
    },
  })
  const browserUser = userEvent.setup()

  renderApp('/app/settings')
  const select = await screen.findByLabelText('Time zone')
  expect(select).toHaveValue('')
  expect(select).toHaveAccessibleDescription(/starts and ends at midnight in this zone/)

  await browserUser.selectOptions(select, 'America/Vancouver')
  await browserUser.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByText('Saved.')
  const bodies = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH').map(([, init]) => JSON.parse(init?.body as string))
  expect(bodies()).toEqual([{ timeZone: 'America/Vancouver' }])
  expect(select).toHaveValue('America/Vancouver')

  await browserUser.selectOptions(select, '')
  await browserUser.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(bodies()).toHaveLength(2))
  expect(bodies()[1]).toEqual({ timeZone: '' })
})

test('changing the level and the goal together saves both', async () => {
  const fetchMock = stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'PATCH /api/v1/auth/me': () => jsonResponse({ ...user, clbLevel: 'CLB_9', dailyNewVocabularyGoal: 12 }),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/settings')
  await browserUser.selectOptions(await screen.findByLabelText('CLB level'), 'CLB 9')
  const goal = screen.getByLabelText('Daily new vocabulary goal')
  await browserUser.clear(goal)
  await browserUser.type(goal, '12')
  await browserUser.click(screen.getByRole('button', { name: 'Save' }))

  await screen.findByText('Saved.')
  const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')
  expect(JSON.parse(patch?.[1]?.body as string)).toEqual({ clbLevel: 'CLB_9', dailyNewVocabularyGoal: 12 })
})

test('shows the version of the release', async () => {
  stubApi({ 'GET /api/v1/auth/me': () => jsonResponse(user) })

  renderApp('/app/settings')

  expect(await screen.findByText(`VocabFlow ${__APP_VERSION__}`)).toBeInTheDocument()
  expect(__APP_VERSION__).toMatch(/^\d+\.\d+\.\d+$/)
})

test('when the word is read aloud is kept in this browser, and absent without speech', async () => {
  stubApi({ 'GET /api/v1/auth/me': () => jsonResponse(user) })
  window.localStorage.removeItem('vocabflow.speakOnAnswer')
  window.localStorage.removeItem('vocabflow.speakOnCard')
  window.localStorage.removeItem('vocabflow.gameSound')

  renderApp('/app/settings')
  await screen.findByLabelText('CLB level')
  expect(screen.queryByRole('checkbox', { name: 'When a card appears' })).not.toBeInTheDocument()
  // The sounds of the games do not need speech.
  expect(screen.getByRole('checkbox', { name: 'Sound effects in the games' })).toBeChecked()
  cleanup()

  installSpeechSynthesis([voice('Samantha', 'en-US')])
  const browserUser = userEvent.setup()
  renderApp('/app/settings')
  const onCard = await screen.findByRole('checkbox', { name: 'When a card appears' })
  const onAnswer = screen.getByRole('checkbox', { name: 'When I show the answer' })
  expect(onCard).toBeChecked()
  expect(onAnswer).toBeChecked()

  await browserUser.click(onCard)
  await browserUser.click(onAnswer)
  await browserUser.click(screen.getByRole('checkbox', { name: 'Sound effects in the games' }))
  expect(window.localStorage.getItem('vocabflow.speakOnCard')).toBe('off')
  expect(window.localStorage.getItem('vocabflow.speakOnAnswer')).toBe('off')
  expect(window.localStorage.getItem('vocabflow.gameSound')).toBe('off')

  cleanup()
  renderApp('/app/settings')
  expect(await screen.findByRole('checkbox', { name: 'When a card appears' })).not.toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'When I show the answer' })).not.toBeChecked()
  window.localStorage.removeItem('vocabflow.speakOnAnswer')
  window.localStorage.removeItem('vocabflow.speakOnCard')
  window.localStorage.removeItem('vocabflow.gameSound')
})

test('explains when saving fails and does not claim it saved', async () => {
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'PATCH /api/v1/auth/me': () => errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred'),
  })

  renderApp('/app/settings')
  await changeGoal('20')

  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})

test('the finished study page links to the goal', async () => {
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/learning/study-queue': () => jsonResponse({ ...emptyStudyQueue, finished: true }),
    'GET /api/v1/reading/today': () => jsonResponse({ passageId: null }),
  })

  renderApp('/app/study')

  expect(await screen.findByRole('link', { name: 'Change daily goal' })).toHaveAttribute('href', '/app/settings')
})

test('how a study card starts is chosen among the word, the picture and the sound, and kept on this device', async () => {
  window.localStorage.removeItem('vocabflow.cardStart')
  window.localStorage.removeItem('vocabflow.recallFirst')
  stubApi({ 'GET /api/v1/auth/me': () => jsonResponse(user) })

  renderApp('/app/settings')
  await screen.findByLabelText('CLB level')
  expect(screen.getByRole('radio', { name: 'Show the picture first' })).toBeChecked()
  // Without a voice, "play the word" is not offered.
  expect(screen.queryByRole('radio', { name: 'Play the word first' })).not.toBeInTheDocument()
  cleanup()

  installSpeechSynthesis([voice('Samantha', 'en-US')])
  const browserUser = userEvent.setup()
  renderApp('/app/settings')
  await browserUser.click(await screen.findByRole('radio', { name: 'Play the word first' }))
  expect(window.localStorage.getItem('vocabflow.cardStart')).toBe('sound')
  await browserUser.click(screen.getByRole('radio', { name: 'Show the word' }))
  expect(window.localStorage.getItem('vocabflow.cardStart')).toBe('word')
  window.localStorage.removeItem('vocabflow.cardStart')
})

test('the Chinese meaning can be shown by default, a choice kept on this device', async () => {
  window.localStorage.removeItem('vocabflow.showChinese')
  stubApi({ 'GET /api/v1/auth/me': () => jsonResponse(user) })
  const browserUser = userEvent.setup()
  renderApp('/app/settings')

  const box = await screen.findByRole('checkbox', { name: /Show the Chinese meaning/ })
  expect(box).not.toBeChecked()
  await browserUser.click(box)
  expect(window.localStorage.getItem('vocabflow.showChinese')).toBe('on')
  await browserUser.click(box)
  expect(window.localStorage.getItem('vocabflow.showChinese')).toBe('off')
  window.localStorage.removeItem('vocabflow.showChinese')
})

test('links to the experimental speech test, and its back link returns to Settings', async () => {
  stubApi({
    'GET /api/v1/auth/me': () => jsonResponse(user),
    'GET /api/v1/learning/study-queue': () => jsonResponse(emptyStudyQueue),
    'GET /api/v1/reading/today': () => jsonResponse({ passageId: null }),
  })
  const browserUser = userEvent.setup()

  renderApp('/app/settings')
  await browserUser.click(await screen.findByRole('link', { name: 'Speech test (experimental)' }))
  expect(await screen.findByRole('heading', { name: 'Speech test' })).toBeInTheDocument()

  await browserUser.click(screen.getByRole('link', { name: '← Back to Settings' }))
  expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
})

test('the main voice and the voice of your lines can be picked and heard, a choice kept on this device', async () => {
  stubApi({ 'GET /api/v1/auth/me': () => jsonResponse(user) })
  const speech = installSpeechSynthesis([
    voice('Samantha', 'en-US', true, 'compact.Samantha'),
    voice('Ava', 'en-US', false, 'com.apple.voice.premium.en-US.Ava'),
    voice('Zoe (Enhanced)', 'en-US', false, 'com.apple.voice.enhanced.en-US.Zoe'),
    voice('Fred', 'en-US'),
    voice('Amélie', 'fr-FR'),
  ])
  const browserUser = userEvent.setup()
  renderApp('/app/settings')

  const first = await screen.findByLabelText('Voice')
  expect(first).toHaveValue('')
  expect(screen.getByRole('option', { name: 'Automatic (Ava (Premium) · en-US)' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Automatic (Zoe (Enhanced) · en-US)' })).toBeInTheDocument()
  // Joke voices and other languages are not offered.
  expect(screen.queryByRole('option', { name: /Fred|Amélie/ })).not.toBeInTheDocument()

  await browserUser.selectOptions(first, 'compact.Samantha')
  expect(window.localStorage.getItem('vocabflow.voice')).toBe('compact.Samantha')
  await browserUser.click(screen.getByRole('button', { name: 'Play the voice' }))
  expect(speech.lastUtterance().voice?.name).toBe('Samantha')

  await browserUser.click(screen.getByRole('button', { name: 'Play the voice of your lines' }))
  expect(speech.lastUtterance().voice?.name).toBe('Ava')

  await browserUser.selectOptions(first, 'system')
  expect(window.localStorage.getItem('vocabflow.voice')).toBe('system')
  await browserUser.click(screen.getByRole('button', { name: 'Play the voice' }))
  expect(speech.lastUtterance().voice).toBeNull()

  await browserUser.selectOptions(first, '')
  expect(window.localStorage.getItem('vocabflow.voice')).toBeNull()
})
