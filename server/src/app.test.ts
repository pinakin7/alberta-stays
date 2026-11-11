import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
const app = createApp();
const input = { model: 'arbitrage', grossRevenue: 40000, expenseRatio: .325, monthlyRent: 2000 };
describe('API', () => {
  it('reports health and labels illustrative data', async () => {
    expect((await request(app).get('/api/health').expect(200)).body).toEqual({ ok: true });
    const markets = (await request(app).get('/api/markets').expect(200)).body;
    expect(markets.markets).toHaveLength(6);
    expect(markets.disclaimer).toContain('not live');
    const properties = (await request(app).get('/api/properties').expect(200)).body;
    expect(properties.properties[0].verified).toBe(false);
    expect(properties.disclaimer).toContain('not live');
  });
  it('calculates with defaults', async () => {
    expect((await request(app).post('/api/scenarios/calculate').send(input).expect(200)).body.annualCashFlow).toBe(3000);
  });
  it.each([{ ...input, monthlyRent: -1 }, { ...input, model: 'invalid' }, { ...input, grossRevenue: '40000' }, { ...input, unexpected: true }, {}])('rejects invalid bodies %j', async body => {
    expect((await request(app).post('/api/scenarios/calculate').send(body).expect(400)).body.error).toBe('Invalid scenario inputs.');
  });
  it('returns JSON for malformed, oversized and unsupported bodies', async () => {
    expect((await request(app).post('/api/scenarios/calculate').set('Content-Type', 'application/json').send('{').expect(400)).body.error).toBe('Malformed JSON body.');
    await request(app).post('/api/scenarios/calculate').send({ large: 'x'.repeat(102401) }).expect(413);
    await request(app).post('/api/scenarios/calculate').set('Content-Type', 'text/plain').send('hello').expect(415);
  });
  it('keeps unknown API routes out of the SPA fallback', async () => {
    expect((await request(app).get('/api/missing').expect(404)).body).toEqual({ error: 'API route not found.' });
  });
  it('does not expose unexpected error details', async () => {
    const onError = vi.fn();
    const broken = createApp({ clientDist: '/tmp/alberta-stays-no-dist', onError });
    // A response serialization failure exercises Express error middleware.
    const original = app.response.json;
    broken.response.json = function (body) { broken.response.json = original; throw new Error('private details'); };
    const response = await request(broken).get('/api/health').expect(500);
    expect(response.body).toEqual({ error: 'An unexpected server error occurred.' });
    expect(onError).toHaveBeenCalledOnce();
  });
});
