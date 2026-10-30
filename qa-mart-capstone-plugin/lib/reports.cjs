const fs = require('node:fs');
const { workspace, containedPath } = require('./workspace.cjs');

function readReport() {
  const root = workspace();
  const file = containedPath(root, process.env.QAMART_REPORT || 'reports/results.json');
  if (!fs.existsSync(file)) {
    throw new Error(`No Playwright report at ${file}. Run npm test first, or set QAMART_REPORT to a report inside the workspace.`);
  }
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!report || !Array.isArray(report.suites) || !report.stats
    || !['expected', 'unexpected', 'flaky', 'skipped'].every(
      (key) => Number.isInteger(report.stats[key]) && report.stats[key] >= 0,
    ) || (report.errors !== undefined && !Array.isArray(report.errors))) {
    throw new Error(`Invalid Playwright JSON report at ${file}: suites, stats counts and optional errors are required.`);
  }
  return { file, report };
}

function collect(report) {
  const entries = [];
  function visit(suite, parentFile) {
    if (!suite || typeof suite !== 'object' || Array.isArray(suite)
      || (suite.specs !== undefined && !Array.isArray(suite.specs))
      || (suite.suites !== undefined && !Array.isArray(suite.suites))) {
      throw new Error('Invalid suite in Playwright report.');
    }
    const file = suite.file || parentFile;
    for (const spec of suite.specs || []) {
      if (!spec || !Array.isArray(spec.tests)) throw new Error('Invalid spec in Playwright report.');
      for (const test of spec.tests) {
        if (!test || !Array.isArray(test.results)
          || !['expected', 'unexpected', 'flaky', 'skipped'].includes(test.status)) {
          throw new Error('Invalid test results/status in Playwright report.');
        }
        entries.push({
          title: spec.title,
          file: spec.file || file,
          line: spec.line,
          project: test.projectName,
          outcome: test.status,
          expectedStatus: test.expectedStatus,
          attempts: test.results.map((result) => {
            if (!result || typeof result.status !== 'string') throw new Error('Invalid retry result in Playwright report.');
            return {
              retry: result.retry,
              status: result.status,
              errors: result.errors || (result.error ? [result.error] : []),
              attachments: result.attachments || [],
            };
          }),
        });
      }
    }
    for (const child of suite.suites || []) visit(child, file);
  }
  report.suites.forEach((suite) => visit(suite, suite?.file));
  return entries;
}

function summary() {
  const { file, report } = readReport();
  const entries = collect(report);
  return {
    report: file,
    startTime: report.stats.startTime,
    durationMs: report.stats.duration,
    passed: report.stats.expected,
    failed: report.stats.unexpected,
    flaky: report.stats.flaky,
    skipped: report.stats.skipped,
    collectedTests: entries.length,
    runnerErrors: report.errors || [],
    clean: report.stats.unexpected === 0 && report.stats.flaky === 0
      && (report.errors || []).length === 0 && report.stats.expected > 0 && entries.length > 0
      && entries.every((entry) => entry.outcome === 'expected' || entry.outcome === 'skipped'),
  };
}

function failures() {
  const { file, report } = readReport();
  return {
    report: file,
    runnerErrors: report.errors || [],
    tests: collect(report).filter((entry) => entry.outcome === 'unexpected' || entry.outcome === 'flaky'),
  };
}

module.exports = { summary, failures, collect };
