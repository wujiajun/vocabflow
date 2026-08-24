# Project

- Project name: VocabFlow
- Java 21
- Spring Boot
- Maven Wrapper
- Modular monolith
- MySQL in production
- React frontend will be added later

# Architecture

- Organize by business capability.
- Keep domain code independent from Spring MVC, JPA, MySQL, HTTP clients, and AI providers.
- Do not expose JPA entities through APIs.
- Keep API DTOs, domain objects, and persistence models separated.
- Prefer simple designs over unnecessary abstractions.
- Do not introduce microservices, message queues, or distributed infrastructure unless explicitly requested.

# Java formatting

- Use Spotless as the formatting source of truth.
- Spotless is the source of truth for Java formatting.
- All Java changes must be formatted before task completion.
- Before completing any Java coding task, run:

  ```sh
  ./mvnw spotless:apply
  ./mvnw spotless:check
  ```

- A Java coding task is not complete unless `spotless:check` passes.
- Run:

  ```sh
  ./mvnw spotless:apply
  ./mvnw spotless:check
  ```

# Verification

Before completing any coding task, run:

- `./mvnw spotless:check`
- `./mvnw test`
- `./mvnw clean package`

If the task affects runtime behavior, also start the application and verify the affected APIs when practical.

# Testing

- Keep unit tests fast.
- Use meaningful integration tests.
- Prefer real MySQL compatibility tests using Testcontainers for persistence/Flyway behavior.
- Do not weaken or delete tests merely to make a change pass.

# Security

- Never store plaintext passwords.
- Never hard-code secrets or API keys.
- Never trust userId supplied by the client for authenticated resources.
- Preserve strict user data isolation.

# Environment safety

Do not:

- install or upgrade JDK
- modify `JAVA_HOME` or `PATH`
- modify global Maven configuration
- use `sudo`
- install system software
- delete files outside the project

unless explicitly approved.

# Git

- Do not commit, push, reset, rebase, tag, or rewrite Git history unless explicitly requested.
- Leave changes ready for human review.

# Working style

- Inspect existing code before changing it.
- Do not rewrite unrelated code.
- Keep diffs focused.
- Fix compilation/test failures caused by your changes.
- Summarize architectural decisions and validation performed.
