const readline = require('node:readline');

const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const text = (value) => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
});

function argumentsFor(schema, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Tool arguments must be an object.');
  }
  for (const key of schema.required || []) {
    if (!(key in value)) throw new Error(`Missing argument: ${key}`);
  }
  for (const [key, item] of Object.entries(value)) {
    const rule = schema.properties[key];
    if (!rule) throw new Error(`Unknown argument: ${key}`);
    if (typeof item !== rule.type || (rule.type === 'number' && !Number.isFinite(item))) {
      throw new Error(`${key} must be a finite ${rule.type}.`);
    }
    if (rule.minLength !== undefined && item.length < rule.minLength) {
      throw new Error(`${key} must not be empty.`);
    }
    if (rule.minimum !== undefined && item < rule.minimum) {
      throw new Error(`${key} must be at least ${rule.minimum}.`);
    }
  }
  return value;
}

async function serve(name, tools) {
  let initialized = false;
  const send = (id, payload) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, ...payload }) + '\n');
  const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      send(null, { error: { code: -32700, message: 'Parse error' } });
      continue;
    }
    if (!message || typeof message !== 'object' || Array.isArray(message)
      || message.jsonrpc !== '2.0' || typeof message.method !== 'string'
      || ('id' in message && typeof message.id !== 'string' && !Number.isInteger(message.id))) {
      send(null, { error: { code: -32600, message: 'Invalid JSON-RPC request' } });
      continue;
    }
    const { id, method, params } = message;
    if (id === undefined) continue;
    if (method === 'initialize') {
      if (!params || typeof params.protocolVersion !== 'string') {
        send(id, { error: { code: -32602, message: 'initialize requires protocolVersion.' } });
        continue;
      }
      initialized = true;
      send(id, { result: {
        protocolVersion: VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name, version: '1.0.0' },
      } });
    } else if (method === 'ping') {
      send(id, { result: {} });
    } else if (!initialized) {
      send(id, { error: { code: -32000, message: 'Initialize the MCP server first.' } });
    } else if (method === 'tools/list') {
      send(id, { result: { tools: tools.map(({ run, ...definition }) => definition) } });
    } else if (method === 'tools/call') {
      const tool = tools.find((entry) => entry.name === params?.name);
      if (!tool) {
        send(id, { error: { code: -32602, message: `Unknown tool: ${params?.name}` } });
        continue;
      }
      let args;
      try {
        args = argumentsFor(tool.inputSchema, Object.hasOwn(params, 'arguments') ? params.arguments : {});
      } catch (error) {
        send(id, { error: { code: -32602, message: error.message } });
        continue;
      }
      try {
        send(id, { result: text(await tool.run(args)) });
      } catch (error) {
        console.error(`[${name}] ${error.message}`);
        send(id, { result: { ...text({ error: error.message }), isError: true } });
      }
    } else {
      send(id, { error: { code: -32601, message: `Unknown method: ${method}` } });
    }
  }
}

const noArguments = { type: 'object', properties: {}, additionalProperties: false };
module.exports = { serve, noArguments };
