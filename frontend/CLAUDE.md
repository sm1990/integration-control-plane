# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start Vite dev server (port 5173)
pnpm build        # Production build to /dist
pnpm build:check  # TypeScript check + production build
pnpm lint         # ESLint
pnpm preview      # Preview production build
```

Requires Node.js 24+ and pnpm 10+.

## Architecture

React 19 + TypeScript SPA using Vite, React Router, and TanStack React Query. UI components come from **WSO2 Oxygen UI** (`@wso2/oxygen-ui`, `@wso2/oxygen-ui-icons-react`, `@wso2/oxygen-ui-charts-react`).

### Provider stack (main.tsx)

`OxygenUIThemeProvider` → `QueryClientProvider` → `BrowserRouter` → `App`

### Routing

Routes are defined in `src/config/routes.tsx` using path builder functions from `src/paths.ts`. Two layout wrappers: `AppLayout` (authenticated pages with sidebar/header) and `PublicLayout` (login). Route paths must use the builder functions from `paths.ts` — never hardcode URL strings.

### Data fetching

- **GraphQL** via a thin `gql()` wrapper in `src/api/graphql.ts` that calls `https://localhost:9446/graphql` with a hardcoded dev JWT.
- **React Query hooks** in `src/api/queries.ts` and mutations in `src/api/mutations.ts`. Each hook wraps a GraphQL query with proper `queryKey` and `enabled` guards.
- **Logs API** is a separate REST endpoint (`https://localhost:9448/icp/observability/logs?live=true`) with its own hook in `src/api/logs.ts`.
- GraphQL types are defined inline in `queries.ts` (prefixed `Gql*`).

### Key directories

- `src/pages/` — route-level page components
- `src/components/` — reusable UI components
- `src/layouts/` — AppLayout, PublicLayout
- `src/api/` — GraphQL client, query hooks, mutation hooks
- `src/config/` — routes, status colors
- `src/paths.ts` — single source of truth for all URL paths (use `id` for uuid, `handle`/`handler` for slug)
- `src/mock-data/` — mock data for development

## House Rules

These are enforced conventions for this codebase:

1. **Loading state** — always show a loading indicator while fetching.
2. **Error state** — always show an error state with retry on failure.
3. **Not found** — when a required single entity is null/undefined after loading, show a not-found UI.
4. **Empty listing** — when a listing returns an empty array, show an empty-listing UI.
5. **Early return** — never reach the main view until data is ready. Handle loading/error/not-found/empty states first via early returns.
6. **No Box spam** — use the correct semantic Oxygen UI component, or remove the wrapper entirely.
7. **No hardcoded paths** — all URL/path strings go in `src/paths.ts` only.
8. **No trivial null guards** — don't paper over null/undefined with `name ?? ""`, `x ? .. : null`, or `x!.y`. Refine the type or add a proper guard to make invalid states impossible.

## Formatting

Prettier config: 260 char print width, single quotes in JS, double quotes in JSX, `bracketSameLine: true`.
