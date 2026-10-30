const { serve, noArguments } = require('../lib/stdio.cjs');

function appURL() {
  const base = new URL(process.env.QAMART_URL || `http://127.0.0.1:${process.env.PORT || 3000}`);
  if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)
    || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
    throw new Error('QAMART_URL must be a loopback HTTP origin, for example http://127.0.0.1:3000.');
  }
  return base;
}

async function request(route, body) {
  const url = new URL(route, appURL());
  let response;
  try {
    response = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
  } catch (error) {
    throw new Error(`Cannot reach QA Mart at ${url.origin}. Start npm start with the matching PORT. ${error.message}`, { cause: error });
  }
  const data = await response.json();
  if (!response.ok && !(route === '/api/coupons/validate' && response.status === 422)) {
    throw new Error(`QA Mart ${route} returned HTTP ${response.status}: ${JSON.stringify(data)}`);
  }
  return { httpStatus: response.status, data };
}

const tools = [
  {
    name: 'qamart_health',
    description: 'Read the live QA Mart health endpoint. Does not start or modify the app.',
    inputSchema: noArguments,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: () => request('/api/health'),
  },
  {
    name: 'qamart_catalog',
    description: 'Read live product prices and per-order stock limits. Product search is not implemented.',
    inputSchema: noArguments,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: async () => {
      const [catalog, inventory] = await Promise.all([request('/api/products'), request('/api/inventory')]);
      if (!Array.isArray(catalog.data.products) || !inventory.data.stock) {
        throw new Error('Unexpected catalog or inventory response; compare docs/api/openapi.yaml.');
      }
      return catalog.data.products.map((product) => {
        const stock = inventory.data.stock[product.id];
        if (!Number.isInteger(stock)) throw new Error(`Missing stock for ${product.id}.`);
        return { ...product, stock };
      });
    },
  },
  {
    name: 'qamart_validate_coupon',
    description: 'Observe coupon validation without placing orders. HTTP 422 is a normal rejection, not a tool failure. Compare behavior with US-101.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Coupon code; empty is allowed for negative testing.' },
        subtotal: { type: 'number', minimum: 0 },
        email: { type: 'string', minLength: 1, description: 'Lab account from tests/test-data.ts.' },
      },
      required: ['code', 'subtotal', 'email'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: (args) => request('/api/coupons/validate', args),
  },
];

if (require.main === module) {
  serve('qamart-capstone-app', tools).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
module.exports = { tools };
