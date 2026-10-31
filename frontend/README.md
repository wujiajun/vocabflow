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
    App.tsx
    providers/                QueryClient and auth token providers
    router/AppRouter.tsx      all routes
    layout/AppShell.tsx       header, Vocabulary/Today tabs, sign out, <Outlet />
  features/
    auth/                     sign in, register, current user, route guards
    vocabulary/               add form, paginated list, detail page
    learning/                 today's plan
      <feature>/{api,hooks,components,pages,types}
  shared/
    api/apiClient.ts          fetch wrapper: Bearer header, error mapping, 401 reporting
    api/tokenStorage.ts       the only code that touches localStorage
    api/sessionEvents.ts      how the client tells the auth layer a token was rejected
    date.ts                   local calendar date helpers
    useToday.ts               today's local date; updates itself at midnight
    navigation.ts             where a detail page's back link should return to
    speech/                   pronunciation: PronounceButton, usePronunciation, voice choice
  test/                       Vitest setup and shared test helpers
```

New features go under `src/features/<name>/` with the same layout. Data flows page or component, then a feature hook, then TanStack Query, then `features/<name>/api/*Api.ts`, then `apiClient`. Keep HTTP calls out of pages and components, and keep types shaped like the API rather than copying backend domain or JPA models.

## Routes

| Path | Page |
| --- | --- |
| `/` | Redirects to `/app` or `/login` depending on the session |
| `/login`, `/register` | Public-only; signed-in users are redirected to `/app` |
| `/app` | Redirects to `/app/vocabulary`; everything under `/app` needs a session |
| `/app/vocabulary` | Add a word or phrase and browse the paginated list; the page is in the URL as `?page=N` (1-based, anything unusable means page 1) |
| `/app/study` | Flashcards: reveal the answer, then rate it Again, Hard, Good or Easy; each button shows when the card comes back |
| `/app/vocabulary/:id` | One vocabulary entry; while it is still being enriched the page polls, and a failed entry offers “Retry details”; `:id` is the user's own entry id. Its back link returns to wherever it was opened from (the same list page, or today's plan) |
| `/app/today` | Today's learning plan |

## Authentication behaviour

- The Bearer token is kept in `localStorage` by `tokenStorage.ts`. That is a temporary MVP choice, not a production decision.
- `AuthTokenProvider` holds the token (and whether the user was signed out unexpectedly); it does not hold the user.
- If `/me` fails for a reason other than 401, such as a network error or a 5xx, the app shows a retry screen with Try again and Sign out, instead of hanging.
- When the API answers 401 to a request that carried a token, `apiClient` reports the rejected token. The provider then removes it, clears every cached query and sends the user to `/login`, which says they were signed out. Sign-in and sign-out requests opt out with `notifyOnUnauthorized: false`.
- Every way a session ends (sign out, rejected token, discarding it from the retry screen, a new sign-in) clears the whole query cache, so one user's data is never shown to the next.

## Pronunciation

`PronounceButton` (in `src/shared/speech/`) speaks a word with the browser's Web Speech API. It asks for American English: `chooseVoice` picks a voice whose language is `en-US` (`en_US` on some Android devices), preferring the device's default one, and falls back to another English voice, which the button's tooltip and the detail page then say plainly. Voices load late in some browsers, so the accent is read through `useSyncExternalStore` on the `voiceschanged` event. The button renders nothing when the browser has no speech support, stops speaking when clicked again or when its page is left, and sits next to a row's link, never inside it. Browsers only allow speech after a user gesture, so there is no autoplay. What the voice actually sounds like depends on the device and cannot be checked by tests.

## Testing conventions

- Tests run against a stubbed `fetch`. Use `stubApi` from `src/test/utils.tsx`: routes are keyed `"METHOD /path"`, and a request with no route fails the test instead of quietly rendering a network error. `renderApp(path)` mounts the whole app with fresh providers and a memory router.
- jsdom has no Web Speech API. `installSpeechSynthesis` in `src/test/speech.ts` installs a fake with controllable voices and playback; without it the pronunciation buttons are not rendered.
- `src/app/AxeScan.test.tsx` runs axe-core (a dev dependency) on every main page and fails on any rule violation; add a page or a new error state there when you add one. jsdom cannot compute colors, so contrast is checked in a real browser instead.
- `src/test/setup.ts` unmounts everything after each test, because Vitest globals are off and Testing Library cannot do it itself. A component left mounted can schedule React work that fires after the file ends; CI then fails with "window is not defined" even though every test passed.
- Enrichment polling timings live in `features/vocabulary/hooks/pollingConfig.ts`; tests mock that module to poll in milliseconds (see `EnrichmentFlow.test.tsx`).
- Tests that use fake timers should fake only `Date` (`vi.useFakeTimers({ toFake: ['Date'] })`) so Testing Library's async waits keep working.
- Do not weaken or delete a test to make it pass.
