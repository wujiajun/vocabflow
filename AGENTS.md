# VocabFlow repository

VocabFlow is a modular-monolith product repository. Keep changes focused and leave them ready for human review.

## Layout

- `backend/` — Java 21, Spring Boot, Maven backend. Follow `backend/AGENTS.md` for backend work.
- `frontend/` — future React, TypeScript, and Vite application. Do not initialize frontend tooling unless explicitly requested.
- `docs/` — long-lived product and architecture documentation.

## Repository rules

- Organize work by business capability and prefer simple designs over unnecessary abstractions.
- Do not introduce microservices, message queues, or distributed infrastructure unless explicitly requested.
- Never hard-code secrets or API keys, and preserve strict user data isolation.
- Do not commit, push, reset, rebase, tag, or rewrite Git history unless explicitly requested.
- Do not install system software, use `sudo`, modify global tool configuration, or delete files outside this repository unless explicitly approved.
- Inspect existing code before changing it. Do not rewrite unrelated code. Fix failures caused by your changes and summarize validation performed.
