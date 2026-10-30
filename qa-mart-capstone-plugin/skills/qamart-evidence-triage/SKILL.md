---
name: qamart-evidence-triage
description: Classify QA Mart Playwright failures using report, retry, story and artifact evidence without masking intentional app defects.
---
# Evidence-based failure triage

1. Capture the run's command, timestamp, project, report path and environment.
   Use the report MCP server before rerunning anything. It returns runner errors,
   retry attempts, flaky outcomes and artifact references as well as failures.
2. Inspect the failed assertion and relevant story/AC. Trace references are
   pointers, not evidence that a trace was opened. Explicitly say when an artifact
   is missing or could not be inspected.
3. Classify:
   - **Application defect**: observed behavior violates a documented requirement.
   - **Automation defect**: incorrect assertion, locator, waiting or test setup.
   - **Data issue**: account, stock, coupon eligibility or shared state mismatch.
   - **Environment issue**: unreachable app, missing browser/dependency or runner
     errors; never misreport an empty suite with runner errors as success.
   - **Flaky behavior**: passed/failed retries or repeated runs provide evidence;
     do not label a single unexplained failure flaky.
4. Treat FLAT100 at exactly 500, WELCOME50 reuse, stock overflow and missing or
   mismatched ordering authorization as known planted areas, not permission to
   weaken assertions. The seeded suite contains five intended failures.
5. Report title, file/line, project, expected/actual, category, impact, confidence
   and next action. Use `docs/templates/bug-report.md` for defects and redact
   passwords/tokens. A score measures confidence in the classification, not
   severity. Do not claim a root cause beyond the available evidence.
6. Preserve correct tests. Propose a targeted chromium/ui-v2 regression, with
   `--workers=1` and an isolated app for global-state scenarios. Only fix an
   automation error after explaining how the story supports the correction.
