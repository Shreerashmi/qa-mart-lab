const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { eventFromStdin, resolveTarget } = require('../lib/hook-event.cjs');

try {
  const event = eventFromStdin();
  if (!event.edit) {
    process.stdout.write('{}\n');
  } else {
    const files = event.targets.map((target) => resolveTarget(event.root, target))
      .filter((file) => file.endsWith('.ts') && fs.existsSync(file));
    if (!files.length) {
      process.stdout.write('{}\n');
    } else {
      const result = spawnSync(process.execPath, [path.join(event.root, 'scripts/lint-specs.cjs'), ...files], {
        cwd: event.root, encoding: 'utf8', timeout: 20000,
      });
      if (result.error) throw result.error;
      if (result.status !== 0 && (result.status !== 1 || result.stderr.trim())) {
        throw new Error(`Spec lint could not complete (${result.status}): ${result.stderr || result.stdout}`);
      }
      process.stdout.write(JSON.stringify({
        additionalContext: `QA Mart convention lint ${result.status === 0 ? 'passed' : 'found issues'}:\n${result.stdout}${result.stderr}`,
      }) + '\n');
    }
  }
} catch (error) {
  console.error(`QA Mart post-edit check failed: ${error.message}`);
  process.stdout.write(JSON.stringify({ additionalContext: `QA Mart post-edit check failed: ${error.message}` }) + '\n');
  process.exitCode = 1;
}
