# QA Mart Capstone Plugin

An additive GitHub Copilot plugin for this repository's existing Playwright +
TypeScript framework. It does not replace the app, working tests, Page Objects,
configuration, CI or the other plugins. Runtime scripts require Node.js 20+ and
use only Node built-ins; there are no plugin packages to install.

## Capstone coverage

| Component | Implementation |
|---|---|
| 2 custom instructions | `instructions/qa-standards.instructions.md`, `instructions/playwright-rules.instructions.md` |
| 2 prompt files | `prompts/test-from-story.prompt.md`, `prompts/triage-regression.prompt.md` |
| 2 skills | `skills/qamart-risk-design/`, `skills/qamart-evidence-triage/` |
| 2 custom agents | `com.github.copilot/agents/qamart-capstone-{planner,engineer}.agent.md` |
| 2 MCP servers | `mcp/app-server.cjs`, `mcp/report-server.cjs`, registered in root `mcp.json` |
| 2 hooks | `preToolUse` framework guard and `postToolUse` existing-spec-lint feedback |

QA rules include risk scoring, naming, story/AC traceability, defect reporting and
v1/v2 regression strategy. Locator rules follow `docs/team-conventions.md`
(role, label, static text, test-id), not the conflicting test-id-first preference
in the older reference plugin.

Flows: login (US-104), product catalog and cart/stock (US-103), checkout/coupons
(US-101/106) and order history/ownership (US-102/105). **Product search is absent
from the application**; the plugin reports it as a gap. Payment and tax are also
out of scope. `pages/` is initially a placeholder, not a prebuilt Page Object library.
No existing CI workflow is present, and this plugin does not invent or replace one.

## Install

From the root of your checked-out `qa-mart-lab` fork:

```bash
copilot plugin install ./qa-mart-capstone-plugin
node qa-mart-capstone-plugin/scripts/install-workspace.cjs
copilot plugin list
```

The first command installs the Agent Plugins 1.0 package: skills and MCP servers
are portable; agents and hooks use Copilot's `com.github.copilot/` namespace.
The second command installs two scoped instruction files and two prompt files
into `.github/instructions/` and `.github/prompts/`. These are explicit workspace
components because not every Copilot client loads instructions and prompt files
from plugins. Existing files are never overwritten: conflicts fail before copying
anything, and reinstalling identical files is safe. Commit those generated files
if you want repository-wide instruction/prompt activation; they are not required
for plugin development.

Before enabling, read the scripts: plugins and hooks execute local code. Use a
current Copilot client with Agent Plugins 1.0 support. If your client does not
accept local-path CLI installs, use its local plugin registration (VS Code below).
After the branch is merged into the fork's default branch, direct remote install
is also available:

```bash
copilot plugin install Shreerashmi/qa-mart-lab:qa-mart-capstone-plugin
```

Until then, check out `feat/qa-mart-capstone-plugin` and install the local path.
The repository marketplace also lists this plugin without auto-enabling it.
Existing repository settings point at the original lab marketplace and are left
unchanged; local installation avoids silently switching anyone's plugin source.

For VS Code versions that support local agent plugins, merge this into **user**
settings, replacing the example with your absolute plugin directory:

```json
{
  "chat.plugins.enabled": true,
  "chat.pluginLocations": {
    "/absolute/path/qa-mart-lab/qa-mart-capstone-plugin": true
  }
}
```

Run the workspace installer for instructions/prompts, then reload VS Code.
Select **Local** for prompt files. Plugin APIs are client/version-dependent:
verify agents/skills/hooks under **Chat > Open Customizations** and the two
servers under **MCP: List Servers**. A listed plugin alone does not prove that
every component loaded. If older QA Mart plugins supply conflicting rules,
disable those plugins for this session rather than editing their contents.

Start a new chat after installation. Select `qamart-capstone-planner` for
read-only plans or `qamart-capstone-engineer` for additive implementation.
Prompt examples:

```text
/qamart-capstone-test-from-story
Cover US-104 sign-in with existing fixtures on both designs.

/qamart-capstone-triage-regression
Analyze reports/results.json against US-101; keep correct failing tests.
```

In CLI clients without VS Code prompt-file discovery, ask the engineer to follow
`qa-mart-capstone-plugin/prompts/test-from-story.prompt.md` (or the triage prompt)
explicitly. Do not assume prompt-file slash commands are available in every client.

## MCP tools and environment

Both servers speak newline-delimited JSON-RPC over stdio. Only protocol messages
go to stdout; execution errors are returned with `isError: true` and logged to
stderr. Invalid requests/arguments are JSON-RPC errors. No server starts the app.

| Server | Tools | Behavior |
|---|---|---|
| `qamart-capstone-app` | `qamart_health`, `qamart_catalog`, `qamart_validate_coupon` | Reads live health, catalog+inventory and coupon validation; never places/resets orders |
| `qamart-capstone-reports` | `qamart_run_summary`, `qamart_failure_evidence` | Reads the existing Playwright JSON report, including retries, flaky outcomes, runner errors and artifact references |

| Variable | Default | Purpose |
|---|---|---|
| `QAMART_URL` | `http://127.0.0.1:${PORT or 3000}` | Loopback HTTP origin only; redirects are refused |
| `QAMART_ROOT` | Discovered from the process working directory | Absolute path to a QA Mart checkout, needed if the client starts servers elsewhere |
| `QAMART_REPORT` | `reports/results.json` | Report path inside that checkout; paths/symlinks outside it are rejected |

Set variables in the parent environment before launching Copilot, or configure
the server environment in your client's MCP settings. Do not set server `cwd` to
the cached plugin directory: reports belong to your workspace, not the plugin cache.
For an offline demonstration, set
`QAMART_REPORT=exercises/fixtures/sample-results.json`.

Coupon rejections (HTTP 422) are normal observed results. FLAT100 at exactly 500
still fails in the app intentionally; tools do not reinterpret that as correct
business behavior. The report server excludes expected-to-fail outcomes from its
regressions, preserves failing retry evidence for flaky tests, and never reports
a missing/malformed report, zero-test run or runner error as a clean run.
Artifact paths are references only; this server does not open traces/screenshots.
Reports can contain sensitive failure text: review/redact it before sharing.

## Hooks and preservation

The pre-tool guard permits structured edits only under `tests/lab/`, `pages/`,
`specs/`, `docs/bug-reports/`, plus `tests/fixtures.ts` and `tests/test-data.ts`.
It checks nested path fields, all add/update/delete/move patch headers, traversal,
file URLs and existing symlinks. Malformed/unidentifiable edit events are denied.
The app, existing suites, package files, CI and configuration remain protected.

The post-tool hook runs **the existing** `scripts/lint-specs.cjs` for affected
TypeScript files. Findings appear as actionable context; it neither changes
files nor substitutes for final typecheck/tests. Deleted files are not linted.
These command hooks use Copilot camelCase events/payloads (snake_case payloads
are also understood by the scripts); other clients must support this format.

**This is an editing guardrail, not an operating-system sandbox.** It does not
intercept writes inside shell commands, unknown remote tools or manual edits.
Normal tool approvals and review remain necessary. A timed-out pre-tool hook may
fail open in the client. Never use a shell to bypass the framework-preservation rule.

## Verify

Run the plugin's dependency-free tests from the repository root:

```bash
node --test qa-mart-capstone-plugin/test/*.test.cjs
```

They exercise both MCP processes over real stdio, start and stop a dedicated
loopback QA Mart app, check actual catalog/coupon behavior, nested reports,
expected/flaky failures, malformed inputs, hook decisions, lint feedback,
symlink protection and idempotent/conflict-safe workspace installation.
Temporary fixtures are removed; existing reports and app state are not reset.

Validate the existing framework as usual (install its existing dependencies and
Chromium if not already present):

```bash
npm run typecheck
npm run lint:specs
npm test
```

For newly generated tests, run a targeted isolated regression:

```bash
PORT=3100 npx playwright test tests/lab/<feature>.spec.ts --project=chromium --project=ui-v2 --workers=1
```

PowerShell: set `$env:PORT=3100` separately. Use an unused port: Playwright reuses
an existing server locally. Never reset shared order state concurrently.
`npm run test:seeded` intentionally has five failures; full `test:v2` includes
the brittle legacy exercise. Neither is silently repaired by this plugin.

For end-to-end client acceptance, confirm all components are loaded in a fresh
session, ask the planner for US-101 coverage, exercise health/report tools, and
confirm an attempted structured app edit is denied. These manual client checks
are distinct from the automated protocol and hook tests.

## References

- [Copilot plugin format and installation](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
- [Copilot hooks and payloads](https://docs.github.com/en/copilot/reference/hooks-reference)
- [Agent Plugins 1.0 specification](https://github.com/agentplugins/agent-plugins-spec/blob/main/spec/1.0.0.md)
