const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const plugin = path.resolve(__dirname, '..');
const repository = path.dirname(plugin);

function temporaryWorkspace(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qamart-capstone-test-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'qa-mart-lab' }));
  fs.writeFileSync(path.join(root, 'playwright.config.ts'), '');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function hook(script, input, root = repository) {
  return spawnSync(process.execPath, [path.join(plugin, 'hooks', script)], {
    cwd: root,
    env: { ...process.env, QAMART_ROOT: root },
    encoding: 'utf8',
    input: typeof input === 'string' ? input : JSON.stringify(input),
    timeout: 5000,
  });
}

function rpc(server, messages, env = {}) {
  const child = spawn(process.execPath, [path.join(plugin, 'mcp', server)], {
    cwd: repository,
    env: { ...process.env, QAMART_ROOT: repository, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`MCP timed out: ${server}\n${stderr}`));
    }, 15000);
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`MCP exited ${code}: ${stderr}`));
      try {
        resolve(stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)));
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.on('error', reject);
    child.stdin.end(messages.map((message) => typeof message === 'string' ? message : JSON.stringify(message)).join('\n') + '\n');
  });
}

const initialize = {
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'capstone-tests', version: '1' } },
};
const call = (id, name, args = {}) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });
const value = (response) => JSON.parse(response.result.content[0].text);

module.exports = { plugin, repository, temporaryWorkspace, hook, rpc, initialize, call, value };
