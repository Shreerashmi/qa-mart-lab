---
applyTo: "tests/**/*.ts,pages/**/*.ts,specs/**/*.md,docs/bug-reports/**/*.md"
---
# QA Mart standards

Read `docs/team-conventions.md`, the relevant `docs/stories/US-*.md`,
`tests/fixtures.ts`, `tests/test-data.ts`, and existing Page Objects before editing.
The repository is the framework; do not scaffold another one, replace configuration,
rewrite working tests, or change the app to make a test pass.

- Use risk = impact (1-3) x likelihood (1-3). P0 is 9, P1 is 4-6,
  P2 is 1-3. Explain scores; prioritize authentication, order ownership,
  stock limits and monetary boundaries. Priority is not defect severity.
- Name specs `tests/lab/<feature>.spec.ts`, named-export Page Objects
  `pages/<Name>Page.ts`, and tests `US-### AC#: <observable behavior>`.
  Use the existing test-case template and stable `TC-<FLOW>-###` identifiers.
- Reuse fixtures and shared data. Keep one behavior per test and use `test.step`
  for journeys. Never put credentials, tokens or copied product prices in specs.
- Cover login (US-104), catalog/cart/stock (US-103), checkout/coupons
  (US-101/106) and order history/ownership (US-102/105). Product search,
  payment and tax do not exist; identify gaps instead of inventing controls.
- Read the API contract before generating API checks. Use API tests for rule
  combinations, UI tests for journeys, accessible validation and visible totals.
- Preserve correct failing assertions. Use `docs/templates/bug-report.md`:
  story/AC, environment/design, exact steps and data references, expected vs
  actual, command, status/response, trace/screenshot path, impact and confidence.
  Distinguish application defect, automation defect, data, environment and flaky
  behavior; do not guess a cause without evidence.
- Regression must include targeted tests on chromium and ui-v2, relevant negative
  cases, typecheck and convention lint. Run state-changing/reset cases in an
  isolated one-worker invocation. Existing `test:v2` also includes the deliberately
  brittle legacy test; label its failures rather than rewriting it.
- The seeded suite intentionally exposes five defects. Do not skip, weaken or
  delete those tests, or treat a green default run as proof the defects are fixed.
