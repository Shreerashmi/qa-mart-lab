const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { plugin, repository, temporaryWorkspace, hook } = require('./helpers.cjs');
const { install, components } = require('../scripts/install-workspace.cjs');

const decision = (event, root) => {
  const result = hook('guard-framework.cjs', event, root);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};
const edit = (target, cwd = repository) => ({ toolName: 'edit', toolArgs: { filePath: target }, cwd });

test('guard preserves app, working suites and framework configuration', () => {
  for (const file of ['app/server.js', 'tests/tour/smoke.spec.ts', 'tests/legacy/legacy-checkout.spec.ts',
    'playwright.config.ts', 'package.json', '.github/workflows/ci.yml', '../outside.ts']) {
    assert.equal(decision(edit(file)).permissionDecision, 'deny', file);
  }
  for (const file of ['tests/lab/new.spec.ts', 'pages/CartPage.ts', 'tests/fixtures.ts',
    'tests/test-data.ts', 'specs/US-101-plan.md', 'docs/bug-reports/coupon.md']) {
    assert.deepEqual(decision(edit(file)), {}, file);
  }
  assert.deepEqual(decision({ toolName: 'view', toolArgs: { path: 'app/server.js' } }), {});
});

test('guard supports nested/string tool arguments and snake_case payloads', () => {
  assert.deepEqual(decision({
    tool_name: 'Write', tool_input: JSON.stringify({ file_path: 'tests/lab/new.spec.ts' }), cwd: repository,
  }), {});
  assert.equal(decision({
    toolName: 'edit', toolArgs: { replacements: [{ filePath: 'tests/lab/new.spec.ts' }, { filePath: 'app/server.js' }] },
  }).permissionDecision, 'deny');
});

test('guard checks every patch path including rename destinations', () => {
  const patch = '*** Begin Patch\n*** Update File: tests/lab/new.spec.ts\n*** Move to: app/server.js\n*** End Patch';
  assert.equal(decision({ toolName: 'apply_patch', toolArgs: { input: patch } }).permissionDecision, 'deny');
  assert.equal(decision({
    toolName: 'apply_patch',
    toolArgs: '*** Begin Patch\n*** Add File: tests/lab/new.spec.ts\n+sample\n*** Delete File: package.json\n*** End Patch',
  }).permissionDecision, 'deny');
});

test('guard resolves relative paths against the tool working directory', () => {
  const cwd = path.join(repository, 'tests/lab');
  assert.deepEqual(decision(edit('new.spec.ts', cwd)), {});
  assert.equal(decision(edit('../../app/server.js', cwd)).permissionDecision, 'deny');
});

test('guard denies malformed or unidentifiable edits rather than silently permitting them', () => {
  for (const event of ['{', {}, { toolName: 'edit', toolArgs: '{' }, { toolName: 'edit', toolArgs: {} }]) {
    assert.equal(decision(event).permissionDecision, 'deny');
  }
});

test('guard resolves symlinks before deciding whether a target is editable', (t) => {
  const root = temporaryWorkspace(t);
  fs.mkdirSync(path.join(root, 'tests/lab'), { recursive: true });
  fs.mkdirSync(path.join(root, 'app'));
  fs.symlinkSync(path.join(root, 'app'), path.join(root, 'tests/lab/app-link'), 'dir');
  fs.symlinkSync(path.dirname(root), path.join(root, 'tests/lab/outside-link'), 'dir');
  fs.symlinkSync(path.join(root, 'missing-target'), path.join(root, 'tests/lab/dangling'), 'dir');
  for (const file of ['tests/lab/app-link/new.ts', 'tests/lab/outside-link/new.ts', 'tests/lab/dangling/new.ts']) {
    assert.equal(decision(edit(file, root), root).permissionDecision, 'deny', file);
  }
});

test('post-edit hook reuses existing lint and returns actionable context', (t) => {
  const root = temporaryWorkspace(t);
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.copyFileSync(path.join(repository, 'scripts/lint-specs.cjs'), path.join(root, 'scripts/lint-specs.cjs'));
  fs.mkdirSync(path.join(root, 'tests/lab'), { recursive: true });
  fs.writeFileSync(path.join(root, 'tests/lab/example.spec.ts'), 'page.waitForTimeout(100);\n');
  let result = hook('check-tests.cjs', edit('tests/lab/example.spec.ts', root), root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(JSON.parse(result.stdout).additionalContext, /no-hard-wait/);
  assert.match(JSON.parse(result.stdout).additionalContext, /has-assertion/);
  fs.writeFileSync(path.join(root, 'tests/lab/example.spec.ts'), "await expect(page.getByRole('heading')).toBeVisible();\n");
  result = hook('check-tests.cjs', edit('tests/lab/example.spec.ts', root), root);
  assert.match(JSON.parse(result.stdout).additionalContext, /lint passed/);
  fs.unlinkSync(path.join(root, 'tests/lab/example.spec.ts'));
  result = hook('check-tests.cjs', edit('tests/lab/example.spec.ts', root), root);
  assert.deepEqual(JSON.parse(result.stdout), {});
});

test('post-edit check surfaces execution errors', (t) => {
  const root = temporaryWorkspace(t);
  fs.mkdirSync(path.join(root, 'tests/lab'), { recursive: true });
  fs.writeFileSync(path.join(root, 'tests/lab/example.spec.ts'), '');
  const result = hook('check-tests.cjs', edit('tests/lab/example.spec.ts', root), root);
  assert.equal(result.status, 1);
  assert.match(JSON.parse(result.stdout).additionalContext, /could not complete/);
});

test('workspace installer adds two instructions and two prompts and is idempotent', (t) => {
  const root = temporaryWorkspace(t);
  assert.equal(install(root).length, 4);
  assert.equal(install(root).length, 4);
  for (const [source, destination] of components) {
    assert.equal(fs.readFileSync(path.join(root, destination), 'utf8'), fs.readFileSync(path.join(plugin, source), 'utf8'));
  }
});

test('installer preflights conflicts without changing existing files or writing earlier entries', (t) => {
  const root = temporaryWorkspace(t);
  const conflicting = path.join(root, components[3][1]);
  fs.mkdirSync(path.dirname(conflicting), { recursive: true });
  fs.writeFileSync(conflicting, 'User-authored customization');
  assert.throws(() => install(root), /Refusing to overwrite/);
  assert.equal(fs.readFileSync(conflicting, 'utf8'), 'User-authored customization');
  assert.equal(fs.existsSync(path.join(root, components[0][1])), false);
});

test('installer rejects a symlinked destination outside the workspace', (t) => {
  const root = temporaryWorkspace(t);
  fs.symlinkSync(path.dirname(root), path.join(root, '.github'), 'dir');
  assert.throws(() => install(root), /Symlink leaves/);
});

test('manifest exposes two real server entry points and two hook commands', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(plugin, 'plugin.json'), 'utf8'));
  assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  const mcp = JSON.parse(fs.readFileSync(path.join(plugin, 'mcp.json'), 'utf8'));
  assert.equal(mcp.$schema, 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json');
  assert.equal(Object.keys(mcp.mcpServers).length, 2);
  for (const server of Object.values(mcp.mcpServers)) {
    assert.equal(server.type, 'stdio');
    assert.ok(fs.existsSync(server.args[0].replace('${PLUGIN_ROOT}', plugin)));
  }
  for (const directory of ['instructions', 'prompts', 'skills', 'com.github.copilot/agents']) {
    assert.equal(fs.readdirSync(path.join(plugin, directory)).length, 2, directory);
  }
  const hooks = JSON.parse(fs.readFileSync(path.join(plugin, 'com.github.copilot/hooks/hooks.json'), 'utf8'));
  assert.equal(hooks.hooks.preToolUse.length, 1);
  assert.equal(hooks.hooks.postToolUse.length, 1);
  for (const entries of Object.values(hooks.hooks)) {
    const script = entries[0].command.match(/"(.+)"/)[1].replace('${PLUGIN_ROOT}', plugin);
    assert.ok(fs.existsSync(script));
  }
});
