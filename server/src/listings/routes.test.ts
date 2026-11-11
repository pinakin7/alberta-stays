import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
const token = 'test-only-token-with-at-least-32-characters';
const repository = () => ({ source: vi.fn().mockResolvedValue({provider:'csv'}), purge: vi.fn(), sources: vi.fn(), createSource: vi.fn(), import: vi.fn(), list: vi.fn().mockResolvedValue({ total: 0, listings: [] }) });
it('fails closed when storage or a strong token is absent', async () => {
  await request(createApp()).get('/api/listings').expect(503);
  await request(createApp({ listingStorage: { token: 'short', repository: repository() } })).get('/api/admin/sources').expect(503);
});
it('rejects missing and invalid authorization before touching the database', async () => {
  const repo = repository(); const app = createApp({ listingStorage: { token, publishListings: true, repository: repo } });
  await request(app).get('/api/admin/sources').expect(401);
  await request(app).post('/api/admin/sources').set('Authorization', 'Bearer incorrect').send({}).expect(401);
  expect(repo.sources).not.toHaveBeenCalled(); expect(repo.createSource).not.toHaveBeenCalled();
});
it('requires permission and validates the entire CSV before persistence', async () => {
  const repo = repository(); const app = createApp({ listingStorage: { token, publishListings: true, repository: repo } });
  await request(app).post('/api/admin/sources').set('Authorization', `Bearer ${token}`).send({ name: 'source', url: 'https://example.com' }).expect(400);
  await request(app).post('/api/admin/listings/import').set('Authorization', `Bearer ${token}`).send({ sourceId: 'source', csv: 'not a valid CSV' }).expect(400);
  expect(repo.import).not.toHaveBeenCalled();
});
it('allows public paginated reads, validates filters and keeps permission records private', async () => {
  const repo = repository(); const app = createApp({ listingStorage: { token, publishListings: true, repository: repo } });
  const result = await request(app).get('/api/listings?market=Calgary&page=2&limit=12').expect(200);
  expect(repo.list).toHaveBeenCalledWith({ market: 'Calgary', page: 2, limit: 12 });
  expect(result.headers['cache-control']).toBe('no-store');
  await request(app).get('/api/listings?limit=1000').expect(400);
  await request(app).get('/api/listings?page=-1').expect(400);
});
it('hides database failures from users', async () => {
  const repo = repository(); repo.list.mockRejectedValue(Object.assign(new Error('private connection info'), { code: 'P1001' }));
  const result = await request(createApp({ listingStorage: { token, publishListings: true, repository: repo } })).get('/api/listings').expect(503);
  expect(result.body.error).toBe('Listing storage is temporarily unavailable.');
});
it('keeps publication disabled without explicit authorization', async () => {
  const repo = repository();
  await request(createApp({ listingStorage: { token, repository: repo } })).get('/api/listings').expect(503);
  expect(repo.list).not.toHaveBeenCalled();
});
it('does not contact Repliers when its server key is missing', async () => {
  const repo = repository();
  const response = await request(createApp({ listingStorage: { token, repository: repo } })).post('/api/admin/repliers/sync').set('Authorization', `Bearer ${token}`).send({ sourceId: 'source', city: 'Calgary' }).expect(503);
  expect(response.body.error).toBe('Repliers is not configured.');
  expect(repo.source).not.toHaveBeenCalled();
});
