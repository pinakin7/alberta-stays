import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { listingRepository } from './repository.js';
import { createApp } from '../app.js';
import type { ListingRow } from './validation.js';
const connection = process.env.TEST_DATABASE_URL;
if (!connection) throw new Error('Set TEST_DATABASE_URL to a dedicated local/CI test database.');
const location = new URL(connection);
if (!['localhost', '127.0.0.1'].includes(location.hostname) || !location.pathname.endsWith('_test')) throw new Error('Database tests require a local database with a name ending in _test.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection }) });
const repository = listingRepository(db);
let sourceId: string;
let repliersSourceId: string | undefined;
const token = 'local-test-only-admin-token-32-characters';
const row: ListingRow = { externalId: 'fixture-1', title: 'Synthetic DB test listing', market: `Test market ${randomUUID()}`, priceCad: '200000.50', bedrooms: 2, sourceUrl: 'https://example.com/fixture', retrievedAt: '2020-01-01T00:00:00Z' };
beforeAll(async () => {
  const source = await repository.createSource({ name: 'Test only', provider: 'csv', url: `https://example.com/${randomUUID()}`, permissionReference: 'Synthetic test fixture', authorized: true });
  sourceId = source.id;
});
afterAll(async () => {
  if (sourceId) { await repository.purge(sourceId); await db.dataSource.delete({ where: { id: sourceId } }); }
  if (repliersSourceId) { await repository.purge(repliersSourceId); await db.dataSource.delete({ where: { id: repliersSourceId } }); }
  await db.market.deleteMany({ where: { name: { in: [row.market, 'Fixture Repliers city'] } } });
  vi.unstubAllGlobals();
  await db.$disconnect();
});
it('persists provenance and exact prices; duplicate and older imports do not overwrite', async () => {
  expect(await repository.import(sourceId, [row])).toEqual({ updated: 1, skipped: 0 });
  expect(await repository.import(sourceId, [{ ...row, priceCad: '1.00' }])).toEqual({ updated: 0, skipped: 1 });
  const stored = await repository.list({ market: row.market, page: 1, limit: 20 });
  expect(stored.total).toBe(1);
  expect(stored.listings[0]).toMatchObject({ priceCad: '200000.5', verificationStatus: 'unverified', sourceUrl: row.sourceUrl, retrievedAt: '2020-01-01T00:00:00.000Z' });
  expect(stored.listings[0]).not.toHaveProperty('permissionReference');
});
it('updates a newer snapshot and rolls back the whole batch on a database failure', async () => {
  await repository.import(sourceId, [{ ...row, priceCad: '210000.75', retrievedAt: '2020-01-02T00:00:00Z' }]);
  expect((await repository.list({ market: row.market, page: 1, limit: 20 })).listings[0].priceCad).toBe('210000.75');
  await expect(repository.import(sourceId, [
    { ...row, externalId: 'should-rollback' }, { ...row, externalId: 'invalid', priceCad: 'not-a-price' },
  ])).rejects.toThrow();
  expect(await db.listing.count({ where: { sourceId, externalId: 'should-rollback' } })).toBe(0);
});
it('rejects cross-source provenance and hides expired Repliers snapshots', async () => {
  await expect(repository.import(sourceId, [{ ...row, sourceUrl: 'https://other.example/one' }])).rejects.toThrow(/source origin/);
  await repository.import(sourceId, [{ ...row, externalId: 'expired', expiresAt: new Date('2020-01-01T00:00:00Z') }]);
  expect((await repository.list({ market: row.market, page: 1, limit: 20 })).total).toBe(1);
});
it('requires admin authentication for a real import and keeps publication off by default', async () => {
  const app = createApp({ listingStorage: { repository, token } });
  await request(app).get('/api/listings').expect(503);
  await request(app).post('/api/admin/listings/import').send({}).expect(401);
  const csv = 'externalId,title,market,sourceUrl,retrievedAt,priceCad,bedrooms\n' + `api-fixture,Synthetic fixture,${row.market},https://example.com/api-fixture,2020-01-01T00:00:00Z,150000.50,1`;
  const result = await request(app).post('/api/admin/listings/import').set('Authorization', `Bearer ${token}`).send({ sourceId, csv }).expect(200);
  expect(result.body.updated).toBe(1);
  const published = createApp({ listingStorage: { repository, token, publishListings: true } });
  const response = await request(published).get('/api/listings').query({ market: row.market }).expect(200);
  expect(response.body.total).toBe(2);
});
it('removes revoked records and supports purging retained source data', async () => {
  await repository.import(sourceId, [], [row.externalId]);
  expect(await db.listing.count({ where: { sourceId, externalId: row.externalId } })).toBe(0);
  await repository.purge(sourceId);
  expect(await db.listing.count({ where: { sourceId } })).toBe(0);
});

it('persists an authenticated Repliers sync with attribution and removes a revoked listing', async () => {
  const source = await repository.createSource({ name: 'Synthetic Repliers fixture', provider: 'repliers', url: 'https://api.repliers.io', permissionReference: 'Synthetic fixture only', authorized: true });
  repliersSourceId = source.id;
  let displayPublic = 'Y';
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ page: 1, numPages: 1, listings: [{
    mlsNumber: 'SYNTHETIC-MLS', boardId: 1, status: 'A', type: 'Sale', listPrice: '250000.75',
    address: { city: 'Fixture Repliers city', state: 'AB' },
    permissions: { displayPublic, displayInternetEntireListing: 'Y' }, office: { brokerageName: 'Synthetic brokerage' },
  }] }), { headers: { 'Content-Type': 'application/json' } })));
  const app = createApp({ listingStorage: { repository, token, publishListings: true, repliersKey: 'synthetic-key-not-real' } });
  try {
    const sync = await request(app).post('/api/admin/repliers/sync').set('Authorization', `Bearer ${token}`).send({ sourceId: source.id, city: 'Fixture Repliers city' }).expect(200);
    expect(sync.body.updated).toBe(1);
    expect(JSON.stringify(sync.body)).not.toContain('synthetic-key-not-real');
    const result = await request(app).get('/api/listings').query({ market: 'Fixture Repliers city' }).expect(200);
    expect(result.body.listings[0]).toMatchObject({ priceCad: '250000.75', brokerageName: 'Synthetic brokerage', verificationStatus: 'unverified', mlsNumber: 'SYNTHETIC-MLS' });
    displayPublic = 'N';
    await request(app).post('/api/admin/repliers/sync').set('Authorization', `Bearer ${token}`).send({ sourceId: source.id, city: 'Fixture Repliers city' }).expect(200);
    expect(await db.listing.count({ where: { sourceId: source.id } })).toBe(0);
  } finally { vi.unstubAllGlobals(); }
});
