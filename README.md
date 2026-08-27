# VocabFlow

VocabFlow captures an English word or phrase and returns deterministic structured learning content. The repository contains the Java backend today; frontend development has not started.

## Repository layout

```text
backend/   Java 21 + Spring Boot + Maven backend
frontend/  Future React + TypeScript + Vite application
docs/      Long-lived product and architecture documentation
```

## Architecture

This is a modular monolith arranged by business capability: `identity` and `vocabulary`, each with domain/application/adapter/infrastructure concerns. Domain value objects (`Email`, `ClbLevel`, `DailyVocabularyGoal`, `VocabularyTerm`) contain invariants and have no Spring, JPA, HTTP, or database dependency. REST DTOs and JPA entities are separate.

`UserVocabulary` is the user-owned learning relationship and begins as `NEW`; `VocabularyItem` holds shared vocabulary knowledge. The database unique constraint on `(user_id, vocabulary_item_id)` and application check prevent duplicate personal learning records. Terms trim/collapse whitespace and compare case-insensitively; there is no fuzzy matching.

`VocabularyEnrichmentProvider` is an application port. `FakeVocabularyEnrichmentAdapter` provides deterministic fixtures for `overwhelmed` and `figure out`, plus predictable fallback content. Enrichment state is recorded as PENDING/PROCESSING/COMPLETED/FAILED; a failed item remains usable and can support later retry work.

## Daily Learning Plan

`GET /api/v1/learning/daily-plan` creates or returns one stable plan for the authenticated user and learning date. Pass an optional ISO date, for example `?date=2026-08-25`; without it, “today” is the current UTC date until user timezone preferences are introduced. New items are selected from the user’s `NEW` vocabulary oldest-first, with ID as a stable tie-breaker, up to `dailyNewVocabularyGoal`. `reviewItems` is intentionally empty until the review scheduler milestone.

```sh
curl -H "Authorization: Bearer $TOKEN" 'localhost:8080/api/v1/learning/daily-plan?date=2026-08-25'
```

## Authentication

Registration hashes passwords with BCrypt. Login issues a short-lived, HMAC-SHA256 signed Bearer token; all vocabulary endpoints derive user ID exclusively from it. Logout adds the token hash to `revoked_tokens`. This is simple, SPA-friendly, and intentionally omits OAuth/refresh tokens for this MVP. Set a strong `VOCABFLOW_AUTH_SECRET` outside development.

## Database and configuration

MySQL is required to run the application. Create a database/user (or permit `createDatabaseIfNotExist`) and set these required environment variables for the default (production-like) profile:

```sh
export VOCABFLOW_DB_URL='jdbc:mysql://localhost:3306/vocabflow?createDatabaseIfNotExist=true&useSSL=false&serverTimezone=UTC'
export VOCABFLOW_DB_USERNAME=vocabflow
export VOCABFLOW_DB_PASSWORD='your-password'
export VOCABFLOW_AUTH_SECRET='a-long-random-development-secret-at-least-32-chars'
```

The application intentionally fails at startup when `VOCABFLOW_DB_PASSWORD` or `VOCABFLOW_AUTH_SECRET` is absent from the default profile. The `dev` and `test` profiles use local/test-only values; never use them in production.

Flyway owns schema creation; Hibernate validates rather than creates it. All absolute timestamps are represented as `java.time.Instant` in application/domain code and persisted as MySQL `DATETIME(6)` values in UTC. Tests use isolated in-memory H2 in MySQL compatibility mode for fast checks and MySQL Testcontainers during `verify`, so no personal MySQL instance is needed.

## Run, test, IntelliJ

Requires JDK 21. Maven Wrapper downloads Maven 3.9.11 on first use; no global Maven installation is required.

```sh
cd backend
./mvnw test
./mvnw verify
./mvnw clean package
./mvnw spring-boot:run
```

`test` runs the fast test suite. `verify` is the authoritative full quality gate and also runs MySQL/Testcontainers integration tests. `clean package` validates packaging but does not replace `verify`.

In IntelliJ IDEA: open `backend/pom.xml` as a Maven project, select JDK 21 as Project SDK, reload Maven, then run `VocabFlowApplication` or Maven goals. Breakpoints work directly from the application class.

## API flow

```sh
curl -X POST localhost:8080/api/v1/auth/register -H 'Content-Type: application/json' -d '{"email":"me@example.com","password":"password123","clbLevel":"CLB_5","dailyNewVocabularyGoal":10}'
TOKEN=$(curl -s -X POST localhost:8080/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"me@example.com","password":"password123"}' | jq -r .accessToken)
curl -X POST localhost:8080/api/v1/vocabulary -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"term":"figure out"}'
curl -H "Authorization: Bearer $TOKEN" 'localhost:8080/api/v1/vocabulary?page=0&size=20'
curl -H "Authorization: Bearer $TOKEN" localhost:8080/api/v1/vocabulary/1
```

Endpoints: `POST /api/v1/auth/register`, `login`, `logout`, `GET /me`; `POST/GET /api/v1/vocabulary`, `GET /api/v1/vocabulary/{id}`. Errors use `{code,message,timestamp}`.

## Current limitations and next milestone

No live dictionary/AI provider, retry endpoint, exercises, mastery, review scheduling, audio, or frontend yet. Next: asynchronous/retryable enrichment workflow, source provenance, then learning/review modules.
