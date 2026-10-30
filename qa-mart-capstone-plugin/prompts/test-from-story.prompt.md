---
description: Plan and implement QA Mart tests from an existing story without replacing the framework.
agent: agent
---
Use the QA Mart capstone workflow. Ask for the story/acceptance criteria and target
flow if they were not supplied. Valid flows are login, catalog/cart, checkout and
order history. Report product search as unimplemented; do not create search tests.

1. Read the selected story, `docs/team-conventions.md`, the API contract, existing
   Page Objects, `tests/fixtures.ts` and `tests/test-data.ts`.
2. Apply the `qamart-risk-design` skill. Produce a small risk-ranked coverage table
   with TC id, story/AC, layer, setup, data reference and expected outcome.
   Use `docs/templates/test-case.md` for detailed cases if requested.
3. Reuse existing tests/helpers first. Add only missing specs to `tests/lab/`,
   needed Page Objects to `pages/`, and shared data/fixtures if needed.
   Preserve the app, configuration, working suites and CI.
4. Follow the two capstone instruction files. Explain unknown acceptance criteria
   before coding; never choose the application's buggy output as the oracle.
5. Run typecheck, spec lint, then the new spec on chromium and ui-v2 with one
   worker. Do not run reset scenarios concurrently with another app consumer.
6. Report files, coverage, exact commands/outcomes and gaps. If a correct test
   exposes a defect, keep it and use the `qamart-evidence-triage` skill.
