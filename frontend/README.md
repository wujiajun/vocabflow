# VocabFlow frontend

The VocabFlow web app: React 19, strict TypeScript, Vite 8 and Tailwind CSS 4. It runs on Node 24 (see `../.node-version`).

- **Routing:** React Router in Declarative Mode (`BrowserRouter` in `src/main.tsx`; no loaders, actions or framework mode).
- **Server state:** TanStack Query. The current user lives only in the query cache.
- **HTTP:** native `fetch` through `src/shared/api/apiClient.ts`; every call uses a relative `/api/v1/...` path.
- **Lint and tests:** Oxlint, `tsc`, and Vitest with jsdom and React Testing Library.

Repository-wide rules are in [`../AGENTS.md`](../AGENTS.md) and [`AGENTS.md`](AGENTS.md). Do not add Redux, Zustand, MobX, Axios, Next.js, GraphQL or a heavy UI framework without approval.

## Commands

Run everything from this directory.

```sh
npm ci              # install exactly what package-lock.json records
npm run dev         # Vite dev server on http://localhost:5173
npm run lint        # oxlint
npm run typecheck   # tsc -b
npm run test        # vitest run; npm run test:watch to watch
npm run build       # tsc -b, then a production build in dist/
```

Run a single test file with `npx vitest run src/features/auth/AuthFlow.test.tsx`, and add `-t "name"` to filter by test name. Before finishing a change, `lint`, `typecheck`, `test` and `build` must all pass.

## Running against the backend

The dev server proxies `/api` to `http://localhost:8080` (see `vite.config.ts`), so start the backend first. The simplest way needs no MySQL; it uses an in-memory database that is emptied whenever the backend stops:

```sh
cd ../backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=test
```

The proxy is a development convenience and is not part of the production build. There is no production hosting setup yet, and the app reads no `VITE_*` environment variables.

## Structure

```text
src/
  main.tsx                    entry: StrictMode and BrowserRouter
  app/
    App.tsx                   the new-version notice above the routes
    NewVersionNotice.tsx      "A new version is available" with a Reload button
    providers/                QueryClient and auth token providers
    router/AppRouter.tsx      all routes
    layout/AppShell.tsx       header, Study/Vocabulary/Reading/Settings tabs, "+ Add", sign out, <Outlet />
  features/
    auth/                     sign in, register, current user and its settings, route guards
    vocabulary/               add form, paginated list, detail page, meanings (tabs), tap-to-add panel
    learning/                 study page, flashcards, today's progress, the finished page
    reading/                  reading passages: write, list, read, read aloud
    settings/                 CLB level, time zone, daily goal, per-device switches
      <feature>/{api,hooks,components,pages,types}
  shared/
    api/apiClient.ts          fetch wrapper: Bearer header, error mapping, 401 reporting
    api/tokenStorage.ts       the only code that touches localStorage
    api/sessionEvents.ts      how the client tells the auth layer a token was rejected
    date.ts                   calendar dates, today in a named time zone, time to midnight
    useToday.ts               today's date (in a zone or the device's); updates itself at midnight
    timeZones.ts              the time zone choices: Canada first, then what the browser knows
    appVersion.ts             reads which build the server has; useNewVersion.ts compares it
    navigation.ts             where a detail page's back link should return to
    speech/                   pronunciation: PronounceButton, usePronunciation, voice choice, speak-on-answer switch
  test/                       Vitest setup and shared test helpers
```

New features go under `src/features/<name>/` with the same layout. Data flows page or component, then a feature hook, then TanStack Query, then `features/<name>/api/*Api.ts`, then `apiClient`. Keep HTTP calls out of pages and components, and keep types shaped like the API rather than copying backend domain or JPA models.

## Routes

| Path | Page |
| --- | --- |
| `/` | Redirects to `/app` or `/login` depending on the session |
| `/login`, `/register` | Public-only; signed-in users are redirected to `/app` |
| `/app` | Redirects to `/app/study`; everything under `/app` needs a session |
| `/app/vocabulary` | Add a word or phrase and browse the paginated list, optionally filtered; the page and filter are in the URL as `?page=N` (1-based, anything unusable means page 1) and `?show=due/new/learning/familiar/mastered` |
| `/app/settings` | CLB level, time zone and daily new vocabulary goal (one Save), and, where the browser can speak, the per-device switch “Read the word aloud when I show the answer” |
| `/app/study` | The home page. Today's progress and flashcards: reveal the answer (the word is read aloud once unless switched off), then rate it Again, Hard, Good or Easy. When nothing is due it lists what was studied (folded until opened) and offers another batch of new words; when the day's study is complete it also offers to write today's reading passage, or to open it if it is written |
| `/app/study/review` | The “Quick review” matching game, offered on the study-complete page once five words were studied: drag each of today's words onto its meaning (or tap a word, then a meaning). Practice only, nothing is saved |
| `/app/reading` | The reading passages, newest first, with a clear Unread mark; filter `?show=unread/read` and `?page=N` |
| `/app/reading/writing?date=` | Where the learner waits while today's passage is written (one request, then it replaces itself with the passage) |
| `/app/reading/:id` | One passage: the studied words are highlighted, every other word can be tapped to add it, Listen / Pause / Resume / Stop reads it aloud, Mark as read |
| `/app/vocabulary/:id` | One vocabulary entry; while it is still being enriched the page polls, and a failed entry offers “Retry details” and “Remove word”, and a misspelled one “Yes, add …” (adds the correct word, removes this one); `:id` is the user's own entry id. Its back link returns to wherever it was opened from (the same list page, or today's plan) |

## Authentication behaviour

- The Bearer token is kept in `localStorage` by `tokenStorage.ts`. That is a temporary MVP choice, not a production decision.
- `AuthTokenProvider` holds the token (and whether the user was signed out unexpectedly); it does not hold the user.
- If `/me` fails for a reason other than 401, such as a network error or a 5xx, the app shows a retry screen with Try again and Sign out, instead of hanging.
- When the API answers 401 to a request that carried a token, `apiClient` reports the rejected token. The provider then removes it, clears every cached query and sends the user to `/login`, which says they were signed out. Sign-in and sign-out requests opt out with `notifyOnUnauthorized: false`.
- Every way a session ends (sign out, rejected token, discarding it from the retry screen, a new sign-in) clears the whole query cache, so one user's data is never shown to the next.

## Pronunciation

`PronounceButton` (in `src/shared/speech/`) speaks a word with the browser's Web Speech API. It asks for American English: `chooseVoice` picks a voice whose language is `en-US` (`en_US` on some Android devices), preferring the device's default one, and falls back to another English voice, which the button's tooltip and the detail page then say plainly. Voices load late in some browsers, so the accent is read through `useSyncExternalStore` on the `voiceschanged` event. The button renders nothing when the browser has no speech support, stops speaking when clicked again or when its page is left, and sits next to a row's link, never inside it. Browsers only allow speech after a user gesture, so nothing is read on its own: a word is read when its button is pressed or when “Show answer” is pressed, in that same click. What the voice actually sounds like depends on the device and cannot be checked by tests.

## Reading aloud and speaking the word

`useReadAloud` (in `features/reading/hooks/`) reads a passage sentence by sentence with the same voice choice. A long text given to the browser in one piece is cut off by some browsers, and the browser's own pause is unreliable, so each sentence is its own utterance, Pause cancels the current one and Resume starts it again from its beginning, and a run counter makes the events of a cancelled utterance harmless. Sentences come from `Intl.Segmenter` (a regex where it is missing), with `Mr.` and `p.m.` not ending one; `splitIntoSentences` keeps the `[[studied word]]` marks, so the sentence being read can be tinted and scrolled into view while the studied words stay highlighted. The speed (Normal 0.9, Slow 0.7) is kept in `localStorage`. Showing the answer on a study card reads the word in the same click (browsers only start speech from a press), unless `shared/speech/autoSpeak.ts` says it is switched off in Settings.

## Quick review game

`QuickReviewPage` takes the words studied today from the study queue, fetches the entries of a random twelve (`useVocabularyDetails`, same keys as the detail page) and, once they are in, fixes the game: `buildPairs` picks one meaning per word and blanks the word out of it (`maskTerm`, which also hides common endings such as `leasing` and `carried`), leaving out words without a meaning and meanings that read the same; `planRounds` shares up to ten words over rounds of at most five. `MatchRound` is the round: meanings are cards (`data-card-id`), words are chips. A chip is dragged with pointer events (not the HTML drag-and-drop, which does not work on touch screens), with `touch-action: none` on the chips only; the card under the pointer comes from `document.elementsFromPoint`. Choosing a word and then a card does the same, which is the keyboard and screen-reader way and the way jsdom tests play (jsdom does no layout, so the drag test stubs `elementsFromPoint`). The dragged chip is moved with a `transform` set from script, which the CSP allows (it only forbids style attributes in the markup). Nothing is sent to the server, so scores never touch the review schedule.

## Time zone

The study day is the calendar date in the learner's time zone: `useUserToday` passes the zone from the current user to `useToday`, which computes the date with `Intl.DateTimeFormat` and rolls over at that zone's midnight. With no zone set it is the device's own date. Send dates built this way, never `toISOString()`.

## New version notice

When the app comes back into view (at most every 30 seconds) and every 15 minutes while open, `NewVersionNotice` fetches `/` with `cache: 'no-store'`, reads the hashed script it names and compares it with the one the page loaded with; a different name shows a bar with Reload. It never reloads by itself, does nothing in development (no hashed script) and shows nothing when the request fails. It relies on `index.html` being served with `Cache-Control: no-cache` (see `Caddyfile`).

## Testing conventions

- Tests run against a stubbed `fetch`. Use `stubApi` from `src/test/utils.tsx`: routes are keyed `"METHOD /path"`, and a request with no route fails the test instead of quietly rendering a network error. `renderApp(path)` mounts the whole app with fresh providers and a memory router.
- Time-dependent code takes the instant or zone as an argument (`todayIn(zone, now)`), so tests need no machine time zone.
- jsdom has no Web Speech API. `installSpeechSynthesis` in `src/test/speech.ts` installs a fake with controllable voices and playback; without it the pronunciation buttons are not rendered.
- `src/app/AxeScan.test.tsx` runs axe-core (a dev dependency) on every main page and fails on any rule violation; add a page or a new error state there when you add one. jsdom cannot compute colors, so contrast is checked in a real browser instead.
- `src/test/setup.ts` unmounts everything after each test, because Vitest globals are off and Testing Library cannot do it itself. A component left mounted can schedule React work that fires after the file ends; CI then fails with "window is not defined" even though every test passed.
- Enrichment polling timings live in `features/vocabulary/hooks/pollingConfig.ts`; tests mock that module to poll in milliseconds (see `EnrichmentFlow.test.tsx`).
- Tests that use fake timers should fake only `Date` (`vi.useFakeTimers({ toFake: ['Date'] })`) so Testing Library's async waits keep working.
- Do not weaken or delete a test to make it pass.
