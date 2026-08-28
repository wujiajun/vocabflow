# Frontend

- React + TypeScript + Vite
- React Router for routing
- TanStack Query for server state
- Native `fetch` through a shared API client
- Tailwind CSS for styling
- React Context only for small client and authentication state

## Architecture

- Use a feature-oriented structure.
- Keep API calls out of pages and components.
- Do not mirror backend domain or JPA models directly.
- Do not introduce Redux, Zustand, MobX, Axios, Next.js, GraphQL, or heavyweight UI frameworks unless explicitly approved.

## Code quality

- Use strict TypeScript and avoid `any` unless clearly justified.
- Keep components focused and reasonably small.
- Prefer composition over large monolithic components.
- Follow responsive, mobile-first design.

## Verification

Before completing a frontend coding task, run:

```sh
npm run lint
npm run typecheck
npm run test
npm run build
```
