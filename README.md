# VocabFlow

VocabFlow helps an English learner keep the words and phrases they meet. You save a word or phrase, the system attaches structured learning content, and a daily plan picks the words to study. The repository contains a Java backend and a React web app. The learning content is deterministic placeholder data for now; there is no live dictionary or AI provider yet.

What works today: register, sign in and out; save words and phrases; browse them with pagination and open a detail page; study them with Anki-style flashcards and spaced repetition; play a word's pronunciation with one click.

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

`VocabularyEnrichmentProvider` is an application port with two adapters, chosen by `vocabflow.enrichment.provider`: `fake` (default; deterministic fixtures, not AI) and `claude` (one Claude Messages API call per term, default model `claude-haiku-5-5`, thinking off, schema-constrained JSON that is validated again before it is stored, including that the reply describes the term asked about). A word can have several meanings, each with its own part of speech, phonetic, definition, examples and collocations; the model decides which are common enough to include. With the real provider on, words enriched before meanings existed are updated once in the background at startup. Adding a word saves it as PENDING and returns immediately; a background worker fills it in, so clients poll `GET /api/v1/vocabulary/{id}` (or the list) until the status is COMPLETED or FAILED. Only one worker can claim a shared item (a conditional database update), so concurrent adds of the same term cost one model call, and a PROCESSING item whose worker was lost (older than five minutes) is claimed again the next time someone adds that term. A FAILED item stays usable and can be retried with `POST /api/v1/vocabulary/{id}/enrichment/retry`. Each model call counts against the acting user's daily limit (UTC day, default 50); beyond it, new words are saved but marked FAILED (`Daily enrichment limit reached`) and a retry returns 429. The source (`claude:<model>` or `fake`), attempt count and time are stored with the content.

The frontend is feature-oriented (`src/features/<name>/{api,hooks,components,pages,types}`) and talks to the backend through one shared fetch client. See [frontend/README.md](frontend/README.md).

## Daily Learning Plan

Studying follows SM-2 as Anki applies it, with Anki's default settings and no random interval fuzz: learning steps of 1 and 10 minutes, a graduating interval of 1 day, 4 days for Easy, starting ease 2.5, minimum 1.3, and a 10-minute relearning step after forgetting. `GET /api/v1/learning/study-queue` returns the next card with what each rating would do: learning steps due now, then due reviews, then today's new words; with nothing else left, a step due within 20 minutes is offered early. Words whose details are not ready are counted but not offered. A rating with an out-of-date `version` returns 409. Status follows the card: `LEARNING` while in steps, `FAMILIAR` under a 21-day interval, `MASTERED` from 21 days. Every rating is stored in `review_logs`.

A day's plan gains newly added words, up to the daily goal, until the day is finished: when a rating leaves nothing due and no learning step to come. After that, new words wait for another batch or the next day. Existing plan items and their order never change.

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
# Optional, for real enrichment (otherwise the fake provider is used):
export VOCABFLOW_ENRICHMENT_PROVIDER=claude
export VOCABFLOW_ANTHROPIC_API_KEY='your-anthropic-api-key'
# Optional: VOCABFLOW_ENRICHMENT_MODEL (default claude-haiku-5-5), VOCABFLOW_ENRICHMENT_DAILY_LIMIT (default 50)
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

Endpoints: `POST /api/v1/auth/register`, `login`, `logout`, `GET /me`; `PATCH /me` (`{dailyNewVocabularyGoal}`); `POST/GET /api/v1/vocabulary` (the list takes optional `status` and `due=<date>` filters), `GET /api/v1/vocabulary/{id}` (the id of the user's own vocabulary entry), `POST /api/v1/vocabulary/{id}/enrichment/retry` (FAILED items only); `GET /api/v1/learning/daily-plan`, `GET /api/v1/learning/study-queue`, `POST /api/v1/learning/cards/{userVocabularyId}/reviews` (`{rating,version,date}`, rating is `AGAIN`, `HARD`, `GOOD` or `EASY`), `POST /api/v1/learning/study-queue/more` (`{date}`, starts another batch of new words).

Errors always use `{code,message,timestamp}`:

| Status | `code` | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | A field or term is invalid |
| 400 | `MALFORMED_REQUEST` | The body is missing or is not valid JSON |
| 400 | `INVALID_PARAMETER` | A query or path value has the wrong type, such as `?date=abc` |
| 401 | `UNAUTHORIZED` | The token is missing, malformed, revoked or rejected |
| 403 | `INVALID_INVITE_CODE` | Registering with a missing or wrong invite code, when one is configured |
| 404 | `NOT_FOUND` | The resource does not exist or belongs to another user |
| 405 | `METHOD_NOT_ALLOWED` | The HTTP method is not supported (the `Allow` header lists the right ones) |
| 409 | `CONFLICT` | The email is already registered, or the word is already in the user's list |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | The request content type is not supported |
| 429 | `ENRICHMENT_LIMIT_REACHED` | Retrying enrichment after the user's daily enrichment limit is used up |
| 500 | `INTERNAL_ERROR` | Unexpected failure; the cause is only in the server log |

Unauthenticated requests to a path that does not exist get 401 rather than 404, because authentication is checked first.

## Running with Docker Compose

This runs the whole app with its data kept between restarts. It needs Docker.

```sh
cp .env.example .env    # then fill in every value
docker compose up -d --build --wait
```

Open `http://localhost:8088`, or `http://<this computer's IP>:8088` from another device on the same network. Registering needs the invite code from `.env`. To use this computer only, set `VOCABFLOW_BIND_ADDRESS=127.0.0.1`.

**This is plain HTTP.** Other devices on the network could read passwords and login tokens in transit, so use it only on a network you trust. It is not ready for the internet: it has no HTTPS and no login rate limit.

Data lives in the `mysql-data` Docker volume. `docker compose down` keeps it; `docker compose down -v` deletes it.

```sh
scripts/backup.sh                                # writes backups/vocabflow-<time>.sql.gz
scripts/restore.sh backups/<file>.sql.gz         # replaces ALL data; asks you to confirm
```

Backups stay on this computer, so copy them elsewhere if the data matters.

## Current limitations and next milestone

The real enrichment provider has been tried by hand against the live API with a small set of words (automated tests use a mocked HTTP server). Enrichment content is shared between users and written for roughly CLB 5 to 7; it does not follow the level the user chose at registration. The web app polls for unfinished words (every 3 seconds, for up to 2 minutes) and offers a retry button on failed ones. There is no user timezone preference. Pronunciation uses the voices built into the user's browser (Web Speech API): it asks for American English, but which voice is used, and whether an American one exists at all, depends on the device. There are no stored recordings. The web app stores the token in `localStorage`; sign-in and sign-out are synced between browser tabs, except when the browser refuses to store the token, in which case the session lasts only for that tab. There is a Docker Compose setup for one computer and its local network, but no internet deployment. [HANDOFF.md](HANDOFF.md) (in Chinese) lists known issues in detail. Next: use it for a few weeks and see whether the schedule helps. Before going on the internet: HTTPS and a login rate limit.
