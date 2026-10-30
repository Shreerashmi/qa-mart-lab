const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

function workspace(start = process.env.QAMART_ROOT || process.cwd()) {
  let directory = path.resolve(start);
  while (true) {
    const manifest = path.join(directory, 'package.json');
    if (fs.existsSync(manifest)) {
      const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (pkg.name === 'qa-mart-lab' && fs.existsSync(path.join(directory, 'playwright.config.ts'))) {
        return fs.realpathSync(directory);
      }
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      throw new Error('QA Mart workspace not found. Start in qa-mart-lab or set QAMART_ROOT to its absolute path.');
    }
    directory = parent;
  }
}

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function containedPath(root, input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('A non-empty file path is required.');
  const target = path.resolve(root, input.startsWith('file:') ? fileURLToPath(input) : input);
  if (!inside(root, target)) throw new Error(`Path is outside the QA Mart workspace: ${input}`);
  let existing = target;
  while (!fs.existsSync(existing)) {
    // lstat also detects dangling symlinks, which must not be followed later.
    try {
      if (fs.lstatSync(existing).isSymbolicLink()) throw new Error(`Dangling symlink: ${input}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    existing = path.dirname(existing);
  }
  const resolved = path.resolve(fs.realpathSync(existing), path.relative(existing, target));
  if (!inside(root, resolved)) throw new Error(`Symlink leaves the QA Mart workspace: ${input}`);
  return resolved;
}

module.exports = { workspace, containedPath };
