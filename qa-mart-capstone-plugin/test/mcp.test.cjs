const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { test, before, after } = require('node:test');
const { repository, temporaryWorkspace, rpc, initialize, call, value } = require('./helpers.cjs');

let app;
let origin;
before(async () => {
  const reservation = net.createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  app = spawn(process.execPath, [path.join(repository, 'app/server.js')], {
    env: { ...process.env, PORT: String(port), QAMART_HOST: '127.0.0.1', PRODUCTS_DELAY_MIN: '0', PRODUCTS_DELAY_MAX: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  app.stdout.on('data', (data) => { output += data; });
  app.stderr.on('data', (data) => { output += data; });
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(200) });
      if (response.ok && (await response.json()).status === 'ok') return;
    } catch (error) {
      if (app.exitCode !== null) throw new Error(`Test app exited: ${output}`, { cause: error });
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Test app did not become healthy: ${output}`);
});
after(async () => {
  if (app && app.exitCode === null) {
    const closed = once(app, 'close');
    app.kill();
    await closed;
  }
});

test('both MCP servers initialize, negotiate, list tools and process notifications over stdio', async () => {
  for (const server of ['app-server.cjs', 'report-server.cjs']) {
    const responses = await rpc(server, [
      initialize,
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3, method: 'ping' },
    ]);
    assert.equal(responses.length, 3);
    assert.equal(responses[0].result.protocolVersion, '2024-11-05');
    assert.ok(responses[1].result.tools.length >= 2);
    assert.ok(responses[1].result.tools.every((tool) => tool.annotations.readOnlyHint && !('run' in tool)));
    assert.deepEqual(responses[2].result, {});
  }
});

test('live app tools return actual catalog/stock and preserve coupon boundary behavior', async () => {
  const data = await rpc('app-server.cjs', [
    initialize,
    call(2, 'qamart_health'),
    call(3, 'qamart_catalog'),
    call(4, 'qamart_validate_coupon', { code: 'FLAT100', subtotal: 500, email: 'asha@qamart.test' }),
    call(5, 'qamart_validate_coupon', { code: 'FLAT100', subtotal: 501, email: 'asha@qamart.test' }),
  ], { QAMART_URL: origin });
  assert.equal(value(data[1]).data.status, 'ok');
  const catalog = value(data[2]);
  assert.equal(catalog.length, 6);
  assert.equal(catalog.find((product) => product.id === 'p6').stock, 0);
  assert.equal(value(data[3]).httpStatus, 422);
  assert.equal(data[3].result.isError, undefined);
  assert.equal(value(data[4]).data.discount, 100);
});

test('MCP rejects invalid arguments, unknown tools and malformed protocol messages explicitly', async () => {
  const responses = await rpc('app-server.cjs', [
    '{',
    'null',
    { jsonrpc: '2.0', id: 0, method: 'tools/list' },
    initialize,
    call(2, 'qamart_validate_coupon', { code: 'SAVE10', subtotal: -1, email: 'asha@qamart.test' }),
    call(3, 'qamart_validate_coupon', { code: 'SAVE10', subtotal: '500', email: 'asha@qamart.test' }),
    call(4, 'qamart_validate_coupon', { code: 'SAVE10', subtotal: 500 }),
    call(5, 'qamart_health', { extra: true }),
    call(6, 'does_not_exist'),
    { jsonrpc: '2.0', id: 7, method: 'missing' },
  ]);
  assert.equal(responses[0].error.code, -32700);
  assert.equal(responses[1].error.code, -32600);
  assert.equal(responses[2].error.code, -32000);
  for (const response of responses.slice(4, -1)) assert.equal(response.error.code, -32602);
  assert.equal(responses.at(-1).error.code, -32601);
});

test('app tools disallow remote targets and non-origin URLs', async () => {
  for (const url of ['https://example.com', 'http://example.com', `${origin}/other`, `${origin}/?token=secret`]) {
    const responses = await rpc('app-server.cjs', [initialize, call(2, 'qamart_health')], { QAMART_URL: url });
    assert.equal(responses[1].result.isError, true);
    assert.match(value(responses[1]).error, /loopback HTTP origin/);
  }
});

test('app connection failures return isError instead of a success-shaped response', async () => {
  const responses = await rpc('app-server.cjs', [initialize, call(2, 'qamart_health')], { QAMART_URL: 'http://127.0.0.1:1' });
  assert.equal(responses[1].result.isError, true);
  assert.match(value(responses[1]).error, /Cannot reach QA Mart.*Start npm start/);
});

function reportFixture() {
  const entry = (title, status, results, expectedStatus = 'passed') => ({
    title, file: 'tests/lab/example.spec.ts', line: 12,
    tests: [{ projectName: 'chromium', status, expectedStatus, results }],
  });
  return {
    stats: { expected: 2, unexpected: 1, flaky: 1, skipped: 0, startTime: '2026-10-30T12:00:00Z', duration: 123 },
    errors: [],
    suites: [{ file: 'tests/lab/example.spec.ts', suites: [{
      title: 'nested suite',
      specs: [
        entry('passes', 'expected', [{ status: 'passed', retry: 0 }]),
        entry('expected failure', 'expected', [{ status: 'failed', retry: 0 }], 'failed'),
        entry('fails', 'unexpected', [{ status: 'failed', retry: 0, errors: [{ message: 'wrong total' }],
          attachments: [{ name: 'trace', path: 'test-results/example/trace.zip' }] }]),
        entry('flaky', 'flaky', [{ status: 'timedOut', retry: 0, error: { message: 'timeout' } }, { status: 'passed', retry: 1 }]),
      ],
    }] }],
  };
}

async function reportCall(t, report, tool = 'qamart_failure_evidence') {
  const root = temporaryWorkspace(t);
  fs.mkdirSync(path.join(root, 'reports'));
  fs.writeFileSync(path.join(root, 'reports/results.json'), typeof report === 'string' ? report : JSON.stringify(report));
  const responses = await rpc('report-server.cjs', [initialize, call(2, tool)], { QAMART_ROOT: root, QAMART_REPORT: 'reports/results.json' });
  return responses[1];
}

test('report MCP walks nested suites, retains retries/artifacts and excludes expected failures', async (t) => {
  const response = await reportCall(t, reportFixture());
  const evidence = value(response);
  assert.equal(evidence.tests.length, 2);
  assert.equal(evidence.tests[0].title, 'fails');
  assert.equal(evidence.tests[0].attempts[0].errors[0].message, 'wrong total');
  assert.equal(evidence.tests[0].attempts[0].attachments[0].path, 'test-results/example/trace.zip');
  assert.equal(evidence.tests[1].attempts.length, 2);
  assert.equal(evidence.tests[1].attempts[0].errors[0].message, 'timeout');
});

test('summary includes counts, metadata and global runner errors', async (t) => {
  const fixture = reportFixture();
  fixture.errors = [{ message: 'Runner setup failed' }];
  const response = await reportCall(t, fixture, 'qamart_run_summary');
  assert.equal(value(response).passed, 2);
  assert.equal(value(response).failed, 1);
  assert.equal(value(response).flaky, 1);
  assert.equal(value(response).collectedTests, 4);
  assert.equal(value(response).durationMs, 123);
  assert.equal(value(response).runnerErrors[0].message, 'Runner setup failed');
  assert.equal(value(response).clean, false);
});

test('empty reports and runner errors are not clean runs', async (t) => {
  const fixture = { stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 0 }, suites: [], errors: [] };
  assert.equal(value(await reportCall(t, fixture, 'qamart_run_summary')).clean, false);
  fixture.errors = [{ message: 'No tests found' }];
  assert.equal(value(await reportCall(t, fixture, 'qamart_run_summary')).clean, false);
  fixture.errors = [];
  fixture.stats.expected = 1;
  assert.equal(value(await reportCall(t, fixture, 'qamart_run_summary')).clean, false);
});

test('missing, malformed and incomplete reports surface MCP errors', async (t) => {
  for (const invalid of ['{', {}, { suites: [], stats: {} }, {
    ...reportFixture(), suites: [{ specs: [{ tests: [{ status: 'unexpected', results: null }] }] }],
  }]) {
    assert.equal((await reportCall(t, invalid)).result.isError, true);
  }
  const root = temporaryWorkspace(t);
  for (const file of ['reports/missing.json', '../outside.json']) {
    const responses = await rpc('report-server.cjs', [initialize, call(2, 'qamart_run_summary')], {
      QAMART_ROOT: root, QAMART_REPORT: file,
    });
    assert.equal(responses[1].result.isError, true);
  }
});

test('sample report path is configurable without moving or modifying existing reports', async () => {
  const responses = await rpc('report-server.cjs', [initialize, call(2, 'qamart_run_summary')], {
    QAMART_REPORT: 'exercises/fixtures/sample-results.json',
  });
  assert.equal(responses[1].result.isError, undefined);
  assert.ok(value(responses[1]).collectedTests > 0);
});
