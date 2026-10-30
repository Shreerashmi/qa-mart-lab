---
name: qamart-risk-design
description: Design risk-ranked QA Mart regression cases and coupon/stock boundaries from existing stories and fixtures.
---
# Risk-based test design

1. Read `docs/stories/`, the requested flow, team conventions and existing test
   assets. Identify covered ACs before proposing new tests.
2. Score impact and likelihood from 1 to 3 with a reason. Multiply: 9 = P0,
   4-6 = P1, 1-3 = P2. Test authentication/ownership, incorrect totals and
   overselling before cosmetic layout. Keep priority separate from defect severity.
3. Cover happy path, negative input, boundaries, account isolation and v1/v2
   compatibility. Map each case to a story/AC and shared test-data reference.
4. For US-101, include:
   - FLAT100 at 499, 500 and 501 rupees; expected discounts 0, 100, 100.
   - SAVE10 rounding and the 200-rupee cap around subtotals 1999, 2000, 2001.
   - WELCOME50 cap around 499, 500, 501; first vs returning shopper and reuse
     after a successful order. The story, not the current app, defines eligibility.
   - Empty/unknown/expired code and case/whitespace normalization.
5. For US-103, use `products` and `/api/inventory` at zero, exact limit and limit
   plus one. For US-104 cover locked/empty/wrong/normalized credentials; for
   US-106 cover mobile/PIN length and aria-linked validation. US-102/105 require
   signed-out and cross-account cases.
6. Prefer API checks for arithmetic and access rules, UI checks for visible
   journeys and validation. Search, payment and tax are explicitly coverage gaps.
7. Output:

| TC | Story/AC | Risk and reason | Priority | Layer | Data/setup | Expected |
|---|---|---|---|---|---|---|

Use `docs/templates/test-case.md` for expanded cases. Save a requested plan to
`specs/<story>-plan.md`. Do not edit the app or replace test configuration.
