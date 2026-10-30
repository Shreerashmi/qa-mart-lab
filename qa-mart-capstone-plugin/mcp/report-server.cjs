const { serve, noArguments } = require('../lib/stdio.cjs');
const { summary, failures } = require('../lib/reports.cjs');

const tools = [
  {
    name: 'qamart_run_summary',
    description: 'Read Playwright JSON totals, runner errors and run metadata. Missing/malformed reports are explicit errors, never passing summaries.',
    inputSchema: noArguments,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: summary,
  },
  {
    name: 'qamart_failure_evidence',
    description: 'Read unexpected/flaky outcomes with retry errors and artifact references. Expected-to-fail tests are not incorrectly classified as regressions.',
    inputSchema: noArguments,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: failures,
  },
];

if (require.main === module) {
  serve('qamart-capstone-reports', tools).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
module.exports = { tools };
