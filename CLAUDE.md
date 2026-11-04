# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Repository rules, quality gates, and architecture constraints live in `AGENTS.md` files and are authoritative. Read the one for the area you touch:

@AGENTS.md

- Backend work: `backend/AGENTS.md`
- Frontend work: `frontend/AGENTS.md` (no Redux/Zustand/MobX/Axios/Next.js/GraphQL/heavy UI frameworks)
- `HANDOFF.md` (Chinese) has the detailed current state, API table, known gaps, and protected areas. Its notes on workspace state can lag behind; trust `git status` and the code.
- `README.md` covers architecture, running locally, and the API and error codes; `frontend/README.md` covers frontend structure, routes, and test conventions.

## Git workflow

`main` is protected by a GitHub ruleset: never commit to it directly. Make a short-lived branch per task, push it, and open a pull request; the `backend` and `frontend` CI checks must pass before it can merge. Claude may push branches, open PRs with `gh` and handle CI on its own, but must wait for the user to say so before merging. Syncing `main` and deleting merged branches afterwards is fine. Force pushes, history rewrites, ruleset changes and tags still need asking first.

## Releases

`CHANGELOG.md` is the record of each version; the number is `version` in `frontend/package.json` (and the lockfile) and `<version>` in `backend/pom.xml`, which must match, and the app shows it at the bottom of Settings. A release is one pull request that bumps both and adds the changelog entry; the tag `vX.Y.Z` goes on the merge commit afterwards, and tags still need the user's word.

## Commands

There is no root build. Run from `backend/` or `frontend/`.

Backend (JDK 21, Maven Wrapper):

```sh
./mvnw spotless:apply && ./mvnw spotless:check   # Google Java Format; must pass
./mvnw test                                       # fast suite: unit, H2, MockMvc (excludes *IT)
./mvnw verify                                     # + Failsafe MySQL 8.4 Testcontainers *IT; needs Docker
./mvnw test -Dtest=DailyLearningPlanServiceTest                     # single test class
./mvnw test -Dtest=DailyLearningPlanServiceTest#methodName          # single test method
./mvnw verify -Dit.test=MysqlPersistenceIT -Dtest=skip -Dsurefire.failIfNoSpecifiedTests=false  # single IT
./mvnw spring-boot:run                                       # needs MySQL + VOCABFLOW_DB_PASSWORD, VOCABFLOW_AUTH_SECRET
./mvnw spring-boot:run -Dspring-boot.run.profiles=test       # in-memory H2, no MySQL; data lost on exit
```

Whole app (Docker): `cp .env.example .env`, fill it in, then `docker compose up -d --build --wait`; serves `http://localhost:8088`. `scripts/backup.sh` and `scripts/restore.sh` handle data.

Frontend (Node 24 via `.node-version`/fnm):

```sh
npm ci
npm run lint        # oxlint
npm run typecheck   # tsc -b
npm run test        # vitest run (jsdom); npm run test:watch for watch mode
npx vitest run src/features/auth/AuthFlow.test.tsx   # single file; add -t "name" to filter
npm run build
npm run dev         # Vite on :5173, proxies /api -> localhost:8080
```

## Backend architecture

Package root `com.vocabflow`. Modules `identity`, `vocabulary`, `learning` and `reading` each split into:

- `domain/`: plain Java with invariants (`Email`, `ClbLevel`, `VocabularyTerm`, `DailyLearningPlan`, …). No Spring/JPA.
- `application/`: services plus **ports**, which are interfaces such as `UserRepository`, `VocabularyEnrichmentProvider`, `LearningVocabularyQuery`, and `DueReviewProvider`. Services may use `@Transactional` but never JPA entities or Spring Data repositories.
- `adapter/`: REST controllers and their request/response DTOs.
- `infrastructure/`: JPA entities, Spring Data repositories, and port adapters (`Jpa*RepositoryAdapter`). Also the enrichment providers: `ClaudeVocabularyEnrichmentAdapter` (real model, enabled with `vocabflow.enrichment.provider=claude`) and `FakeVocabularyEnrichmentAdapter` (deterministic, not AI, the default).

Cross-cutting packages:

- `security/` holds the custom HMAC-SHA256 Bearer token (`TokenService`; not a JWT, so treat it as opaque), revocation via `revoked_tokens`, and Security-chain JSON errors.
- `shared/web` holds `ApiException` subclasses and the `ApiErrorResponseFactory`. Every error is `{code,message,timestamp}`.

Key cross-module rules:

- `learning` reads vocabulary only through the `LearningVocabularyQuery` port (implemented in `vocabulary/infrastructure/JpaLearningVocabularyQuery`).
- `VocabularyItem` is shared content. `UserVocabulary` is the per-user relationship, unique on `(user_id, vocabulary_item_id)`. `/api/v1/vocabulary/{id}` takes the `UserVocabulary` id.
- `VocabularyTerm` keeps display casing. Matching uses `normalized()` (trimmed/collapsed whitespace, `Locale.ROOT` lowercase), and both values are stored as `term` and `normalized_term`.
- Enrichment is asynchronous. `VocabularyService.add` saves the item PENDING and hands `VocabularyEnrichmentService` to an `EnrichmentScheduler` (a small in-process thread pool; `vocabflow.enrichment.inline=true` runs it on the caller's thread and is set only in the test profile). Only the caller that wins `VocabularyItemRepository.claimForEnrichment` (one conditional UPDATE to PROCESSING; a PROCESSING item older than 5 minutes counts as lost) may call the provider, and each call is charged to the acting user's per-day count in `enrichment_usage` (UTC day). Nothing in that path may run inside a shared transaction. Only a word whose enrichment is COMPLETED can enter a daily plan (`findNewVocabularyForUser` filters on it), so a PENDING, PROCESSING or FAILED word is not learnable and a word that is about to change (for example be renamed to its base form) is never in a plan or rated yet; the next plan top-up takes it in once it completes. Retry is `POST /api/v1/vocabulary/{id}/enrichment/retry` (FAILED only; 429 `ENRICHMENT_LIMIT_REACHED` when over the limit). The reply also carries `baseForm` with `ownMeaning` (and `ownMeaningReason`, listed first so the model explains before it decides; not stored). The adapter keeps `baseForm` only when `ownMeaning` is false, i.e. the text merely inflects another word and the senses are written for that word; a form with a meaning of its own (`tired`, `glasses`, `admired`) gets no base form and is described as typed, and a reply without the flag is refused. When `baseForm` survives, `VocabularyEnrichmentService` tries `VocabularyItemRepository.completeAsBaseForm` in one transaction so the word is stored as the base word (an existing completed item of that word gets every holder's entry and the inflected item is deleted; otherwise the item is renamed in place: `term` and `normalized_term` both change, the one exception to "`normalized_term` never changes"). It refuses, and the item is completed as typed with its `base_form` shown as "Form of …", when a holder already has the base word, the base item is not COMPLETED, or a holder has rated the word or has it in a plan (`StudyRecords.isInUse`); any exception there is logged and also falls back. `VocabularyService.add` therefore saves the user's entry before it schedules enrichment, so the conversion always finds it. `scripts/try_base_form_prompt.py` measures how well the model makes the own-meaning call (Haiku 5.5: 31 of 32 labelled words right, no wrong renames, over two runs; the miss was `studies`, kept as typed); keep `scripts/try_senses_prompt.py` in step with the adapter prompt. `term` carries dictionary capitals (it replaces the stored display `term` on completion; the echo check only tolerates capitals), and `misspelled` (the adapter throws `MisspelledTermException`; the item becomes FAILED `Looks misspelled` with `spelling_suggestion`, no content, no retry). A FAILED word that was never rated can be removed with `DELETE /api/v1/vocabulary/{id}`: in one transaction `VocabularyService.remove` takes it out of stored daily plans through the `StudyRecords` port (a deliberate, narrow exception to "plan items never change"), then deletes the entry and the shared item if nothing else refers to it.
- Studying uses SM-2 as Anki applies it. `learning/domain/SpacedRepetitionScheduler` is pure and deterministic. A word has a `learning_cards` row from its first rating; every rating adds a `review_logs` row. `StudyService` must stay non-transactional (`createIfAbsent` catches a duplicate key and the plan path manages its own transactions); the writes for one rating happen together in `ReviewTransaction`, a separate bean. A stale `version` gives 409. `learning_status` is derived from the card (`ReviewCard.learningStatus()`). An empty daily plan is returned but not stored. A stored plan grows through `DailyPlanGrowth` (its own transactions, holding the plan row lock): it tops up to the goal until the day is finished, a finished day takes new words only through `POST /learning/study-queue/more`, and existing items never change. The day is finished when a rating leaves nothing due and no learning step to come.
- `reading`: `ReadingService.generate` is non-transactional (a model call takes seconds, and `saveIfAbsent` catches a duplicate key). One passage per user and study day (unique key); it needs the day's plan finished (`finished_at`) and at least 10 words rated that day, picks up to 15 (`ReadingWordPicker`), writes at the user's CLB level minus one, draws one call from the shared `ModelQuota`, and retries an unusable reply once. It reaches learning data only through the `StudiedWords` port. The model names the form it used for each word and the adapter (`ClaudeReadingAdapter.mark`) wraps the uses in `[[ ]]` itself. Passages use `VOCABFLOW_READING_MODEL` (Sonnet 5.5, which needs `thinking: between_tools`, not `disabled`), separate from `VOCABFLOW_ENRICHMENT_MODEL`.
- The daily plan get-or-create path spans three transactions and must stay that way:
  1. `DailyLearningPlanService` runs a read-only transaction.
  2. `DailyLearningPlanInsertTransaction` writes with `REQUIRES_NEW`. Its duplicate-key exception is caught by the adapter after that transaction ends.
  3. `DailyLearningPlanConflictRecovery` reloads the winning plan in a separate `REQUIRES_NEW` + readOnly transaction.

  These beans are separate on purpose, because self-invocation would bypass the propagation annotations.
- Adapters' `saveIfAbsent` catch duplicate-key errors, so they must not run inside a caller's shared transaction: the caught exception marks it rollback-only and poisons the Hibernate session, and the loser of a race then fails with a 500. `VocabularyService.add` is deliberately not `@Transactional` for this reason; `VocabularyConcurrencyIT` guards it.

Persistence notes:

- Migrations live in `src/main/resources/db/migration`, and V1–V12 are frozen. A new migration must also bump the migration-count assertion in `integration/MysqlFlywayIT` (currently `hasSize(12)`).
- Open-in-View is disabled. Mapping happens inside transactions.
- MySQL ITs extend `integration/MysqlIntegrationTest`, which supplies the container datasource.
- `pom.xml` configures `maven-compiler-plugin` with `--enable-preview`. It does not break `test` or `verify`, but nobody has confirmed why it is there, so don't remove it or spread it to other places.

## Frontend architecture

React 19 + strict TS + Vite. React Router runs in Declarative Mode (`BrowserRouter` in `main.tsx`, routes in `app/router/AppRouter.tsx`). Don't add loaders, actions, or framework mode.

Data flow is: page/component → feature hook → TanStack Query → `features/<feature>/api/*Api.ts` → `shared/api/apiClient.ts` (native fetch, relative `/api/v1/...`, attaches the Bearer token).

Auth pieces:

- Token persistence lives only in `shared/api/tokenStorage.ts` (localStorage).
- `AuthTokenProvider`/`authTokenContext` coordinate the token (plus a small `signedOutUnexpectedly` flag for the login notice), never the user.
- The current user exists only in the TanStack Query cache, via `useAuth.ts`, which bootstraps it from `/me`.
- 401 handling lives in one place: `apiClient` reports a 401 to a request that carried a token via `shared/api/sessionEvents.ts`, and `AuthTokenProvider` then clears the token and the whole query cache. Features must not handle 401 themselves. Requests that sign in or out pass `notifyOnUnauthorized: false`.
- Every way a session ends clears the entire QueryClient cache (`hooks/sessionCache.ts`), since all cached data belongs to the current user. Logout always clears local state.
- `AuthRoute` guards public-only routes (`/login`, `/register`) and protected ones (everything under `/app`, rendered inside `app/layout/AppShell.tsx`).
- A `/me` failure that is not a 401 shows a retry screen; it must never leave the guard on the loading state.

New features go under `src/features/<name>/{api,hooks,components,pages,types}`, mirroring `features/auth`. Frontend types are API-shaped, not copies of backend domain/JPA models. The study day is the calendar date in the learner's time zone (`users.time_zone`, an IANA name; null means the device's): `useUserToday` passes it to `useToday`, and dates are built with `todayIn` or from local date parts (`shared/date.ts`), never `toISOString()`, which is UTC. The server uses the zone only when a daily plan is asked for without a date.

Other frontend facts worth knowing:

- Speech is the browser's Web Speech API only, and starts only from a press (the first touch on a phone says one silent syllable, `shared/speech/unlockSpeech.ts`, so that speech that follows a drag or a new card is not refused; not on a computer, where Chrome can drop the word spoken in that click): pronunciation buttons, the word read when a card appears or in the same click as "Show answer" (two separate switches in Settings, both on by default, kept per browser in `localStorage`; the first card of a page opened straight on it may stay silent until a press), and `useReadAloud` for passages (sentence by sentence; Pause cancels and Resume restarts the sentence).
- `NewVersionNotice` compares the hashed script named by the server's `/` with the loaded one when the app returns to view and offers Reload; it relies on `index.html` being served `no-cache` (`frontend/Caddyfile`).
- The "Quick review game" (`/app/study/review`, `features/learning/components/MatchRound.tsx`) is practice only: it reads today's studied words and their meanings and sends nothing, so it never touches the review schedule. Dragging uses pointer events, and choosing a word then a meaning is the equal alternative. A right match is spoken, a wrong one turns red and buzzes (Web Audio in `shared/sound/effects.ts`, switch in Settings; a touch drag is answered on `touchend`).
- Layout is tight on phones and unchanged from `sm:` up: page tops, h1 sizes and card padding have phone values (`pt-4`, `text-2xl`, `p-4`), and the header leaves out the e-mail address. Keep new pages in step with them.
- History: siblings replace, levels push. The top tabs, the filters and the page numbers navigate with `replace`, so they do not fill the history that the phone's swipe-back walks; opening an entry or a passage from a list pushes. Pressing a tab starts a fresh stack (`app/layout/useTabNavigation.ts`): the history is walked back to the first entry of the visit (`window.history.state.idx` steps, React Router's own count) and that entry is replaced by the tab, while the page shows nothing for a moment (`pending`), so swipe-back from a tab leaves the app instead of returning to a list or entry opened from another tab. The "← Back to …" links are `shared/BackLink.tsx`: they go back one step when the page was opened from where they point (the `backState` the link carried), and otherwise go there replacing the page. New lists and tabs should follow this.
- The tabs row (`app/layout/AppShell.tsx`) is `sticky top-0`, outside the `header` (a sticky element stays inside its parent), and `index.css` sets `scroll-padding-top` so focus and anchors do not land behind it. On a phone the sticky row has 12px above the tabs (`pt-3`), because the top edge of the screen swallows touches. Each tab is `min-h-11` (44px), the least a finger hits reliably; keep touch targets at that height. The Quick review game also has a sticky bottom tray (`z-10`, below the tabs' `z-20`).
- Links have `-webkit-touch-callout: none` (`index.css`), so holding a finger on one does not open iOS's link menu and preview; text stays selectable.
- The navigation is crowded on a phone: "Add a word" shows as "+ Add" there. The study-complete page folds the studied list so the buttons stay on the first screen.

Frontend tests stub `fetch` with `stubApi` from `src/test/utils.tsx` (routes keyed `"METHOD /path"`; an unrouted request fails the test). With fake timers, fake only `Date`.
