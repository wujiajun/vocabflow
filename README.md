# VocabFlow

VocabFlow helps an English learner keep the words and phrases they meet. You save a word or phrase, the system attaches structured learning content, and a daily plan picks the words to study. The repository contains a Java backend and a React web app. The learning content is deterministic placeholder data for now; there is no live dictionary or AI provider yet.

What works today: register, sign in and out; save words and phrases; browse them with pagination and open a detail page; see today's plan; play a word's pronunciation with one click.

## Repository layout

```text
backend/          Java 21 + Spring Boot + Maven backend
frontend/         React 19 + TypeScript + Vite single-page app
docs/             Long-lived product and architecture documentation (ROADMAP.md, in Chinese)
.claude/agents/   Reusable Claude Code subagent definitions (backend, frontend, browser verification)
.github/workflows/ GitHub Actions CI
AGENTS.md         Repository rules and quality gates (backend/ and frontend/ have their own)
HANDOFF.md        Current state, known gaps and protected areas, in Chinese
```

## Architecture

This is a modular monolith arranged by business capability: `identity`, `vocabulary` and `learning`, each with domain/application/adapter/infrastructure concerns. Domain value objects (`Email`, `ClbLevel`, `DailyVocabularyGoal`, `VocabularyTerm`) contain invariants and have no Spring, JPA, HTTP, or database dependency. REST DTOs and JPA entities are separate. `learning` reads vocabulary only through the `LearningVocabularyQuery` port.

`UserVocabulary` is the user-owned learning relationship and begins as `NEW`; `VocabularyItem` holds shared vocabulary knowledge. The database unique constraint on `(user_id, vocabulary_item_id)` and an application check prevent duplicate personal learning records. Terms trim/collapse whitespace and compare case-insensitively; there is no fuzzy matching. Adding the same new term from several requests at once is safe: the loser of the race reuses the winner's shared item.

`VocabularyEnrichmentProvider` is an application port. `FakeVocabularyEnrichmentAdapter` provides deterministic fixtures for `overwhelmed` and `figure out`, plus predictable fallback content. Enrichment state is recorded as PENDING/PROCESSING/COMPLETED/FAILED. A failed item remains usable. A shared item that is still PENDING five minutes after it was created (for example because the process stopped before enrichment finished) is enriched again the next time someone adds that term; FAILED items are not retried yet.

The frontend is feature-oriented (`src/features/<name>/{api,hooks,components,pages,types}`) and talks to the backend through one shared fetch client. See [frontend/README.md](frontend/README.md).

## Daily Learning Plan

`GET /api/v1/learning/daily-plan` creates or returns one stable plan for the authenticated user and learning date. Pass an optional ISO date, for example `?date=2026-08-25`; without it, “today” is the current UTC date. The web app always sends the browser's local date, because the UTC date is already tomorrow in the evening west of Greenwich. New items are selected from the user's `NEW` vocabulary oldest-first, with ID as a stable tie-breaker, up to `dailyNewVocabularyGoal`. `reviewItems` is intentionally empty until the review scheduler milestone.

A plan is saved when it is first requested, even if it is empty, and it keeps the goal and items it was created with. Words added later join a later day's plan, not the one already saved.

```sh
curl -H "Authorization: Bearer $TOKEN" 'localhost:8080/api/v1/learning/daily-plan?date=2026-08-25'
```

## Authentication

Registration hashes passwords with BCrypt. Login issues a 24-hour HMAC-SHA256 signed Bearer token; all vocabulary and learning endpoints derive the user ID exclusively from it. Logout adds the token hash to `revoked_tokens`. This is simple and SPA-friendly, and intentionally omits OAuth and refresh tokens for this MVP. Set a strong `VOCABFLOW_AUTH_SECRET` outside development.

The web app keeps the token in `localStorage`, which is a temporary MVP choice rather than a production decision. When the API answers 401 to a request that carried a token, the app removes the token, clears all cached data and returns to the sign-in page with a short explanation.

## Database and configuration

MySQL is required to run the application normally. Create a database/user (or permit `createDatabaseIfNotExist`) and set these environment variables for the default (production-like) profile:

```sh
export VOCABFLOW_DB_URL='jdbc:mysql://localhost:3306/vocabflow?createDatabaseIfNotExist=true&useSSL=false&serverTimezone=UTC'
export VOCABFLOW_DB_USERNAME=vocabflow
export VOCABFLOW_DB_PASSWORD='your-password'
export VOCABFLOW_AUTH_SECRET='a-long-random-development-secret-at-least-32-chars'
```

The application intentionally fails at startup when `VOCABFLOW_DB_PASSWORD` or `VOCABFLOW_AUTH_SECRET` is absent from the default profile. The `dev` and `test` profiles use local/test-only values; never use them in production.

Flyway owns schema creation; Hibernate validates rather than creates it. All absolute timestamps are represented as `java.time.Instant` in application/domain code and persisted as MySQL `DATETIME(6)` values in UTC. Tests use isolated in-memory H2 in MySQL compatibility mode for fast checks and MySQL Testcontainers during `verify`, so no personal MySQL instance is needed for tests.

## Run locally

Requires JDK 21 (backend) and Node 24 (frontend; see `.node-version`). Maven Wrapper downloads Maven 3.9.11 on first use; no global Maven installation is required.

Backend without MySQL, using the in-memory H2 `test` profile (no environment variables; all data is lost when it stops):

```sh
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=test
```

Backend with MySQL: set the environment variables above, then run `./mvnw spring-boot:run`.

Frontend, in a second terminal (Vite serves on port 5173 and proxies `/api` to `localhost:8080`, so start the backend first):

```sh
cd frontend
npm ci
npm run dev
```

In IntelliJ IDEA: open `backend/pom.xml` as a Maven project, select JDK 21 as Project SDK, reload Maven, then run `VocabFlowApplication` or Maven goals.

## Test and verify

Backend, from `backend/`:

```sh
./mvnw spotless:apply
./mvnw spotless:check
./mvnw test
./mvnw verify
./mvnw clean package
```

`test` runs the fast suite. `verify` is the authoritative full quality gate: it also runs the MySQL 8.4 Testcontainers integration tests, so Docker must be running. `clean package` validates packaging but does not replace `verify`.

Frontend, from `frontend/`:

```sh
npm run lint
npm run typecheck
npm run test
npm run build
```

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on every push to `main`, in two parallel jobs named `backend` and `frontend`. `backend` runs `./mvnw spotless:check` and `./mvnw verify` on JDK 21 (Docker is provided by the GitHub runner for the Testcontainers tests). `frontend` runs `npm ci`, `lint`, `typecheck`, `test` and `build` on the Node version in `.node-version`. These are the same commands as in the section above; run them locally before pushing.

`main` is protected by a GitHub ruleset (`Protect main`): changes reach it only through a pull request, both checks must pass, and force pushes and deletion are blocked. Work on a branch and open a pull request. Repository admins can bypass the rule from the pull request page, which is meant for emergencies.

## API flow

```sh
curl -X POST localhost:8080/api/v1/auth/register -H 'Content-Type: application/json' -d '{"email":"me@example.com","password":"password123","clbLevel":"CLB_5","dailyNewVocabularyGoal":10}'
TOKEN=$(curl -s -X POST localhost:8080/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"me@example.com","password":"password123"}' | jq -r .accessToken)
curl -X POST localhost:8080/api/v1/vocabulary -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"term":"figure out"}'
curl -H "Authorization: Bearer $TOKEN" 'localhost:8080/api/v1/vocabulary?page=0&size=20'
curl -H "Authorization: Bearer $TOKEN" localhost:8080/api/v1/vocabulary/1
```

Endpoints: `POST /api/v1/auth/register`, `login`, `logout`, `GET /me`; `POST/GET /api/v1/vocabulary`, `GET /api/v1/vocabulary/{id}` (the id of the user's own vocabulary entry); `GET /api/v1/learning/daily-plan`.

Errors always use `{code,message,timestamp}`:

| Status | `code` | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | A field or term is invalid |
| 400 | `MALFORMED_REQUEST` | The body is missing or is not valid JSON |
| 400 | `INVALID_PARAMETER` | A query or path value has the wrong type, such as `?date=abc` |
| 401 | `UNAUTHORIZED` | The token is missing, malformed, revoked or rejected |
| 404 | `NOT_FOUND` | The resource does not exist or belongs to another user |
| 405 | `METHOD_NOT_ALLOWED` | The HTTP method is not supported (the `Allow` header lists the right ones) |
| 409 | `CONFLICT` | The email is already registered, or the word is already in the user's list |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | The request content type is not supported |
| 500 | `INTERNAL_ERROR` | Unexpected failure; the cause is only in the server log |

Unauthenticated requests to a path that does not exist get 401 rather than 404, because authentication is checked first.

## Current limitations and next milestone

There is no live dictionary or AI provider, no retry for failed enrichment, no exercises, mastery tracking or review scheduling, and no user timezone preference. Pronunciation uses the voices built into the user's browser (Web Speech API): it asks for American English, but which voice is used, and whether an American one exists at all, depends on the device. There are no stored recordings. The web app stores the token in `localStorage` and does not sync sign-out between browser tabs, and there is no production deployment setup yet. [HANDOFF.md](HANDOFF.md) (in Chinese) lists known issues in detail. Next: an asynchronous, retryable enrichment workflow with source provenance, then the review and practice modules.
