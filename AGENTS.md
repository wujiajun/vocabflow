# VocabFlow repository

VocabFlow is a modular-monolith product repository. Keep changes focused and leave them ready for human review.

## Layout

- `backend/` — Java 21, Spring Boot, Maven backend. Follow `backend/AGENTS.md` for backend work.
- `frontend/` — existing React 19, strict TypeScript, and Vite application. Follow `frontend/AGENTS.md` for frontend work; do not reinitialize the project.
- `docs/` — long-lived product and architecture documentation.
- `HANDOFF.md` — current implementation, commands, known limitations, and handoff notes. Read it before continuing development; code and configuration are authoritative when older documentation disagrees.
- `.node-version` — Node.js major version for the frontend (currently 24, managed locally with fnm).

## Architecture and contracts

- The backend is a modular monolith organized into `identity`, `vocabulary`, `learning` and `reading`, with shared security/web support.
- Keep domain code independent from Spring MVC, JPA, MySQL, HTTP clients, and AI providers. Application services use repository/query ports; persistence adapters own Spring Data repositories and entity mapping.
- Keep API DTOs, domain objects, and persistence models separate. Never expose JPA entities through APIs or import them into frontend models.
- Frontend code is feature-oriented. Keep HTTP calls in feature API modules behind the shared native-fetch client, out of pages/components.
- Keep React Router in Declarative Mode. Use TanStack Query for server state and React Context only for small client/auth coordination; do not duplicate the current user in both.
- Preserve the current Bearer authentication contract unless the task explicitly includes changing it. Token storage is centralized; localStorage is a temporary MVP choice, not a production-hardening decision.
- Preserve authenticated user isolation: backend identity comes from the authenticated principal, never a client-supplied `userId`.
- Flyway owns schema changes; add new migrations rather than editing established migration contents. Hibernate validates the schema. Absolute timestamps use `Instant` and UTC `DATETIME(6)`; learning dates use `LocalDate`.
- Preserve daily-plan uniqueness, deterministic selection, persisted item order, and the separate create/recovery transaction boundaries. A stored plan may gain new words at its end (see `DailyPlanGrowth`), but its existing items and their order never change. Do not merge duplicate-key insert and winner reload into one rollback-only transaction.

## Commands and quality gates

There is no root Maven/npm project. Run commands inside the relevant directory.

- Backend: from `backend/`, run `./mvnw spotless:apply`, `./mvnw spotless:check`, `./mvnw test`, `./mvnw verify`, and `./mvnw clean package` for Java changes, as required by `backend/AGENTS.md`.
- Spotless with Google Java Format is the Java formatting source of truth. A Java task is not complete until `spotless:check` passes.
- `./mvnw test` runs the fast suite; `./mvnw verify` additionally runs MySQL 8.4/Testcontainers integration tests and is the authoritative full backend gate. Packaging alone does not replace it. Docker must be available for those integration tests.
- Frontend: use Node 24 and the existing `package-lock.json`; use `npm ci` for a clean dependency install, and update dependencies/lockfile only when needed by the task. Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` from `frontend/` before completing frontend coding tasks.
- Retain Oxlint as the existing frontend linter; strict TypeScript is checked separately with `tsc`. Do not add an overlapping lint stack or unrelated framework by default.
- Keep unit tests fast and meaningful, preserve H2 fast checks and MySQL compatibility tests, and do not weaken/delete tests just to pass.
- For runtime changes, verify affected flows against the backend when practical. Distinguish mocked tests, real integration checks, historical results, and checks not run; never report unverified success.

## Repository rules

- Organize work by business capability and prefer simple designs over unnecessary abstractions.
- Do not introduce microservices, message queues, or distributed infrastructure unless explicitly requested.
- Never hard-code secrets or API keys, and preserve strict user data isolation.
- Do not log passwords, access tokens, or secrets. Environment examples and handoff notes must not include secret values.
- Preserve existing user changes, including untracked files. Inspect `git status`/diff before editing; do not use cleanup/reset operations to discard unfinished work.
- Do not commit, push, reset, rebase, tag, or rewrite Git history unless explicitly requested. `CLAUDE.md` lists what the owner has already allowed in its Git workflow section.
- Do not install system software, use `sudo`, modify global tool configuration, or delete files outside this repository unless explicitly approved.
- Do not install/upgrade the JDK or Node, persistently modify `JAVA_HOME`/`PATH`, or change global Maven/npm settings unless explicitly approved. Use the existing project toolchain.
- Inspect existing code before changing it. Do not rewrite unrelated code. Fix failures caused by your changes and summarize validation performed.
- Completed milestones are not permission to redo previous hardening. Add only the requested feature/fix; architecture, authentication redesign, and new infrastructure require task scope that explicitly includes them.
