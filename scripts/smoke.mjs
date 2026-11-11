import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export async function smoke(baseUrl) {
  const base = new URL(baseUrl);
  assert(['http:', 'https:'].includes(base.protocol), 'Use an HTTP(S) service URL');
  assert(!base.username && !base.password && !base.search && !base.hash && base.pathname === '/', 'Use a service origin without credentials, path or query');
  const request = (path, options = {}) => fetch(new URL(path, base), {
    ...options, redirect: 'error', signal: AbortSignal.timeout(15_000),
  });
  const json = async (path, status = 200, options) => {
    const response = await request(path, options);
    assert.equal(response.status, status, `${path}: unexpected HTTP status`);
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
    return response.json();
  };
  assert.equal((await json('/api/health')).ok, true);
  const htmlResponse = await request('/');
  assert.equal(htmlResponse.status, 200);
  assert.match(htmlResponse.headers.get('content-type') ?? '', /text\/html/);
  const html = await htmlResponse.text();
  assert.match(html, /<div id="root"><\/div>/);
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+\.(?:js|css))"/g)].map(match => match[1]);
  assert(assets.some(asset => asset.endsWith('.js')), 'Missing production JavaScript bundle');
  assert(assets.some(asset => asset.endsWith('.css')), 'Missing production stylesheet');
  for (const asset of assets) {
    const response = await request(asset);
    assert.equal(response.status, 200, `Missing asset ${asset}`);
    assert.match(response.headers.get('content-type') ?? '', asset.endsWith('.js') ? /javascript/ : /text\/css/);
  }
  const markets = await json('/api/markets');
  assert(Array.isArray(markets.markets) && markets.markets.length > 0);
  assert.match(markets.disclaimer, /not live/i);
  const properties = await json('/api/properties');
  assert(properties.properties.every(property => property.verified === false));
  assert.match(properties.disclaimer, /not live/i);
  const calculate = values => json('/api/scenarios/calculate', 200, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
  });
  const arbitrage = await calculate({ model: 'arbitrage', grossRevenue: 40000, expenseRatio: .325, monthlyRent: 2000 });
  assert.equal(arbitrage.annualCashFlow, 3000);
  const management = await calculate({ model: 'management', grossRevenue: 40000, expenseRatio: .325, managementFee: .2 });
  assert.equal(management.annualCashFlow, 5400);
  const invalid = await json('/api/scenarios/calculate', 400, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'owned', grossRevenue: -1 }),
  });
  assert.equal(invalid.error, 'Invalid scenario inputs.');
  assert.equal((await json('/api/missing', 404)).error, 'API route not found.');
  console.log('Deployment smoke passed: frontend assets, health, illustrative data, calculations and API errors.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    assert(process.argv[2], 'Usage: npm run smoke -- https://your-service.onrender.com');
    await smoke(process.argv[2]);
  } catch (error) {
    console.error('Deployment smoke failed:', error.message);
    process.exitCode = 1;
  }
}
