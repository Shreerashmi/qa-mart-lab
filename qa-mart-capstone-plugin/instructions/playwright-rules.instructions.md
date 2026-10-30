---
applyTo: "tests/**/*.ts,pages/**/*.ts"
---
# Playwright implementation rules

`docs/team-conventions.md` is authoritative, including its locator order:
`getByRole` with name, `getByLabel`, static `getByText`, then `getByTestId`.
CSS is a last resort and a reported testability gap. Do not use XPath,
generated classes, `.nth()` or `nth-child`; v2 reorders products.

Import `test` and `expect` from `tests/fixtures.ts` when using `api` or
`signedInPage`. Get accounts, products, coupons and delivery data from
`tests/test-data.ts`; extend that module rather than duplicating data.
Use relative navigation/request URLs and the configured `baseURL`.

Reuse or extend Page Objects only when needed. Use named exports, typed readonly
locators and async actions; assertions belong in specs, not Page Objects.
Scope product actions to the card for the shared product name.

Use web-first locator assertions (`toHaveText`, `toBeVisible`, `toHaveURL`).
Never add `waitForTimeout`, read text then assert, or use retries to conceal
flakiness. Start response waits before triggering an action if the response
itself is under test.

Orders are global in-memory state. `api.reset()` wipes all orders and does not
restore the conceptual first-order rule. Do not run reset/order scenarios beside
other order suites. Use a fresh app instance when clean process state is needed.
Take returned order IDs from the API, never assume `QM-10001`.

Run `npm run typecheck`, `npm run lint:specs`, and:
`npx playwright test tests/lab/<feature>.spec.ts --project=chromium --project=ui-v2 --workers=1`.
Use an isolated port via `PORT` when necessary. Do not change
`playwright.config.ts`, package scripts, existing CI or app files for the lab.
Report exact outcomes, including any expected seeded defects and blockers.
