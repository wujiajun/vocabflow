# Backend

- Java 21
- Spring Boot
- Maven Wrapper
- MySQL in production
- Modular monolith

## Architecture

- Organize by business capability.
- Keep domain code independent from Spring MVC, JPA, MySQL, HTTP clients, and AI providers.
- Do not expose JPA entities through APIs.
- Keep API DTOs, domain objects, and persistence models separated.
- Prefer simple designs over unnecessary abstractions.

## Java formatting and verification

- Spotless is the source of truth for Java formatting.
- Before completing a Java task, run:

  ```sh
  ./mvnw spotless:apply
  ./mvnw spotless:check
  ./mvnw test
  ./mvnw verify
  ./mvnw clean package
  ```

- `./mvnw verify` is the authoritative full validation command because it includes MySQL/Testcontainers integration tests.
- Keep unit tests fast. Use meaningful integration tests and prefer real MySQL compatibility coverage with Testcontainers for persistence and Flyway behavior.
- Do not weaken or delete tests merely to make a change pass.

## Security

- Never store plaintext passwords.
- Never trust a `userId` supplied by the client for authenticated resources.
- Preserve strict user data isolation.

## Working style

- Do not install or upgrade the JDK, modify `JAVA_HOME` or `PATH`, modify global Maven configuration, use `sudo`, or install system software unless explicitly approved.
- Do not commit, push, reset, rebase, tag, or rewrite Git history unless explicitly requested.
- Keep diffs focused and summarize architectural decisions and validation performed.
