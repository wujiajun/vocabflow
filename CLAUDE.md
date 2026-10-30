# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Repository rules, quality gates, and architecture constraints live in `AGENTS.md` files and are authoritative. Read the one for the area you touch:

@AGENTS.md

- Backend work: `backend/AGENTS.md`
- Frontend work: `frontend/AGENTS.md` (no Redux/Zustand/MobX/Axios/Next.js/GraphQL/heavy UI frameworks)
- `HANDOFF.md` (Chinese) has the detailed current state, API table, known gaps, and protected areas. Its notes on workspace state can lag behind; trust `git status` and the code.
- `README.md` and `frontend/README.md` are partly outdated (they say the frontend has not started).

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

Package root `com.vocabflow`. Modules `identity`, `vocabulary`, and `learning` each split into:

- `domain/`: plain Java with invariants (`Email`, `ClbLevel`, `VocabularyTerm`, `DailyLearningPlan`, …). No Spring/JPA.
- `application/`: services plus **ports**, which are interfaces such as `UserRepository`, `VocabularyEnrichmentProvider`, `LearningVocabularyQuery`, and `DueReviewProvider`. Services may use `@Transactional` but never JPA entities or Spring Data repositories.
- `adapter/`: REST controllers and their request/response DTOs.
- `infrastructure/`: JPA entities, Spring Data repositories, and port adapters (`Jpa*RepositoryAdapter`). Also stub providers: `FakeVocabularyEnrichmentAdapter` (deterministic, not AI) and `EmptyDueReviewProvider` (`reviewItems` is always empty).

Cross-cutting packages:

- `security/` holds the custom HMAC-SHA256 Bearer token (`TokenService`; not a JWT, so treat it as opaque), revocation via `revoked_tokens`, and Security-chain JSON errors.
- `shared/web` holds `ApiException` subclasses and the `ApiErrorResponseFactory`. Every error is `{code,message,timestamp}`.

Key cross-module rules:

- `learning` reads vocabulary only through the `LearningVocabularyQuery` port (implemented in `vocabulary/infrastructure/JpaLearningVocabularyQuery`).
- `VocabularyItem` is shared content. `UserVocabulary` is the per-user relationship, unique on `(user_id, vocabulary_item_id)`. `/api/v1/vocabulary/{id}` takes the `UserVocabulary` id.
- `VocabularyTerm` keeps display casing. Matching uses `normalized()` (trimmed/collapsed whitespace, `Locale.ROOT` lowercase), and both values are stored as `term` and `normalized_term`.
- The daily plan get-or-create path spans three transactions and must stay that way:
  1. `DailyLearningPlanService` runs a read-only transaction.
  2. `DailyLearningPlanInsertTransaction` writes with `REQUIRES_NEW`. Its duplicate-key exception is caught by the adapter after that transaction ends.
  3. `DailyLearningPlanConflictRecovery` reloads the winning plan in a separate `REQUIRES_NEW` + readOnly transaction.

  These beans are separate on purpose, because self-invocation would bypass the propagation annotations.

Persistence notes:

- Migrations live in `src/main/resources/db/migration`, and V1–V4 are frozen. A new migration must also bump the migration-count assertion in `integration/MysqlFlywayIT` (currently `hasSize(4)`).
- Open-in-View is disabled. Mapping happens inside transactions.
- MySQL ITs extend `integration/MysqlIntegrationTest`, which supplies the container datasource.
- `pom.xml` configures `maven-compiler-plugin` with `--enable-preview`. HANDOFF marks its purpose as unconfirmed, so don't remove it or spread it to other places.

## Frontend architecture

React 19 + strict TS + Vite. React Router runs in Declarative Mode (`BrowserRouter` in `main.tsx`, routes in `app/router/AppRouter.tsx`). Don't add loaders, actions, or framework mode.

Data flow is: page/component → feature hook → TanStack Query → `features/<feature>/api/*Api.ts` → `shared/api/apiClient.ts` (native fetch, relative `/api/v1/...`, attaches the Bearer token).

Auth pieces:

- Token persistence lives only in `shared/api/tokenStorage.ts` (localStorage).
- `AuthTokenProvider`/`authTokenContext` coordinate the token only.
- The current user exists only in the TanStack Query cache, via `useAuth.ts`, which bootstraps it from `/me`.
- A 401 from `/me` clears the session. Logout always clears local state.
- `AuthRoute` guards public-only routes (`/login`, `/register`) and protected ones (`/app`).

New features go under `src/features/<name>/{api,hooks,components,pages,types}`, mirroring `features/auth`. Frontend types are API-shaped, not copies of backend domain/JPA models.
