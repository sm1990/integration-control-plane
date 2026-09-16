---
description: Write or extend Playwright e2e tests for a page or flow
argument-hint: <page, flow, or spec file>
---

Write end-to-end test coverage for: **$ARGUMENTS**

Follow the `playwright-e2e` skill in `.claude/skills/playwright-e2e/` — read it first, including `references/locators.md` before writing any locator.

Work in this order and do not skip ahead:

1. Locate the route in `src/config/routes.tsx` and its URL builder in `src/paths.ts`. Routes wrapped in `hideable(IS_CLOUD, ...)` are available in the `wip` build (they're redirected away only on cloud); routes added via `IS_CLOUD ? [...] : []` exist only on cloud. Either is testable — cloud-only routes belong in `specs/cloud/`, and a route redirected away on cloud belongs in `specs/wip/`.
2. Read the page component under `src/pages/` and whatever it renders from `src/components/`. Identify which of the four states (loading / error / not-found / empty) the test will land in, and pick a fixture that produces it reliably.
3. Harvest accessible names verbatim from that source. Every locator must trace back to a real string you read, a third-party page you verified against a real run, or a value derived at runtime.
4. Decide whether this needs a page object in `tests/e2e/pages/` or whether inline locators are clearer.
5. Write the spec in `tests/e2e/specs/shared/` (or `specs/wip/`, `specs/cloud/`, `specs/cloud-anon/` for a cloud surface needing no session), tagged `@smoke`.
6. Run `./node_modules/.bin/eslint` and the suite for wherever the spec landed:
   - `pnpm test:e2e <spec path>` — wip
   - `pnpm test:e2e:cloud <spec path>` — cloud, browser login
   - `pnpm test:e2e:cloud:anon` — cloud, no session
   - token mode: `dotenv -e .env.test -- env E2E_TOKEN_MODE=1 E2E_TOKEN_URL=<provider> pnpm exec playwright test --project=cloud <spec path>`

Then report back with: the file you created, which behaviours it asserts, anything you deliberately left as `test.skip` and why, and the actual run result. If you could not run it, say so plainly rather than implying it passed.
