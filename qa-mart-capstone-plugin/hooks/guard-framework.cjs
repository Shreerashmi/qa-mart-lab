const { eventFromStdin, resolveTarget } = require('../lib/hook-event.cjs');

try {
  const event = eventFromStdin();
  if (event.edit) event.targets.forEach((target) => resolveTarget(event.root, target));
  process.stdout.write('{}\n');
} catch (error) {
  process.stdout.write(JSON.stringify({
    permissionDecision: 'deny',
    permissionDecisionReason: error.message,
  }) + '\n');
}
