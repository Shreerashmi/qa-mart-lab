const fs = require('node:fs');
const path = require('node:path');
const { workspace, containedPath } = require('./workspace.cjs');

const EDIT_TOOL = /edit|create|write|replace|patch|insert|delete|move/i;
const PATH_KEY = /^(path|filePath|file_path|file|uri|oldPath|newPath|old_path|new_path|source|destination|target_file)$/i;

function paths(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach((entry) => paths(entry, output));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (PATH_KEY.test(key) && typeof item === 'string') output.push(item);
      else paths(item, output);
    }
  } else if (typeof value === 'string') {
    for (const match of value.matchAll(/^\*\*\* (?:(?:Add|Update|Delete) File|Move to):[ \t]*([^\r\n]+)/gm)) {
      output.push(match[1].trim());
    }
  }
  return output;
}

function editable(relative) {
  const normalized = relative.split(path.sep).join('/');
  return ['tests/lab/', 'pages/', 'specs/', 'docs/bug-reports/'].some((prefix) => normalized.startsWith(prefix))
    || ['tests/fixtures.ts', 'tests/test-data.ts'].includes(normalized);
}

function eventFromStdin() {
  const event = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('Invalid hook event.');
  const tool = event.toolName ?? event.tool_name;
  if (typeof tool !== 'string' || !tool) throw new Error('Hook event is missing toolName/tool_name.');
  if (!EDIT_TOOL.test(tool)) return { edit: false };
  let args = event.toolArgs ?? event.tool_input;
  if (typeof args === 'string') {
    if (args.trim().startsWith('*** Begin Patch')) args = { patch: args };
    else args = JSON.parse(args);
  }
  const root = workspace(process.env.QAMART_ROOT || event.cwd || process.cwd());
  const cwd = path.resolve(event.cwd || process.cwd());
  const targets = [...new Set(paths(args))].map((target) => (
    target.startsWith('file:') ? target : path.resolve(cwd, target)
  ));
  if (!targets.length) throw new Error('Cannot identify every edited file. Use a structured edit or a supported patch.');
  return { edit: true, root, targets };
}

function resolveTarget(root, target) {
  const file = containedPath(root, target);
  const relative = path.relative(root, file);
  if (!editable(relative)) {
    throw new Error(`Protected framework path: ${relative || '.'}. Edit tests/lab/, pages/, specs/, docs/bug-reports/ or shared test fixtures/data; keep app, existing suites and configuration unchanged.`);
  }
  return file;
}

module.exports = { eventFromStdin, resolveTarget, editable };
