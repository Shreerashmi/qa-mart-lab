---
description: Review QA Mart regression evidence and draft actionable defects.
agent: agent
---
Analyze the supplied run or `reports/results.json`. Do not execute a new test
run before capturing the existing report: Playwright overwrites it.

1. Apply `qamart-evidence-triage`. Use `qamart-capstone-reports` MCP tools for
   summary and failure evidence; an absent/malformed report is a blocker,
   not a passing run.
2. Compare failures with the relevant story/AC, API contract, test data,
   fixtures and implementation. Use `qamart-capstone-app` health/catalog/coupon
   tools only if live evidence is needed. Distinguish observed from intended
   behavior; these tools do not create or reset orders.
3. Classify application defect, automation defect, data issue, environment issue,
   or flaky behavior, with evidence and confidence. Keep unknown causes unknown.
   Separate seeded failures and the legacy-v2 exercise from unexpected regressions.
4. Draft each actionable application defect with `docs/templates/bug-report.md`,
   without passwords, bearer tokens or unrelated personal data. Include a
   minimal reproduction, expected/actual, impact and artifact paths.
5. Propose the smallest targeted regression command for both designs. Change tests
   only when the oracle is wrong, with explanation; never weaken assertions,
   skip defects or edit the application merely to turn the report green.
