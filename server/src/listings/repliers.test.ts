import { expect, it, vi } from 'vitest';
import { fetchRepliersPage } from './repliers.js';
// Synthetic contract fixture, not a real listing or performance statistic.
const listing = { mlsNumber: 'FIXTURE-1', boardId: 1, status: 'A', type: 'Sale', listPrice: '300000.50', address: { city: 'Calgary', state: 'AB' }, permissions: { displayPublic: 'Y', displayInternetEntireListing: 'Y' }, office: { brokerageName: 'Fixture brokerage' }, details: { numBedrooms: '2' } };
const response = (records: unknown[] = [listing], overrides = {}) => new Response(JSON.stringify({ page: 1, numPages: 2, listings: records, ...overrides }), { headers: { 'Content-Type': 'application/json' } });
it('requests a bounded Alberta sales page with a server-only header and preserves attribution', async () => {
  const fetcher = vi.fn().mockResolvedValue(response());
  const page = await fetchRepliersPage({ apiKey: 'test-key', city: 'Calgary', pageNum: 1, fetcher, now: new Date('2020-01-01T00:00:00Z') });
  const [url, options] = fetcher.mock.calls[0];
  expect(url.origin).toBe('https://api.repliers.io');
  expect(url.searchParams.get('state')).toBe('AB');
  expect(url.searchParams.get('resultsPerPage')).toBe('100');
  expect(options.headers['REPLIERS-API-KEY']).toBe('test-key');
  expect(options.redirect).toBe('error');
  expect(page.rows[0]).toMatchObject({ externalId: '1:FIXTURE-1', priceCad: '300000.50', market: 'Calgary', brokerageName: 'Fixture brokerage', retrievedAt: '2020-01-01T00:00:00.000Z' });
  expect(page.rows[0].expiresAt?.toISOString()).toBe('2020-01-01T06:00:00.000Z');
  expect(page.nextPage).toBe(2);
});
it.each([
  { permissions: { displayPublic: 'N', displayInternetEntireListing: 'Y' } },
  { permissions: undefined }, { office: undefined }, { status: 'U' }, { type: 'Lease' },
  { address: { city: 'Calgary', state: 'ON' } }, { address: { city: 'Toronto', state: 'AB' } },
])('excludes nonpublic, unattributed, inactive or out-of-scope records and requests removal', async patch => {
  const page = await fetchRepliersPage({ apiKey: 'test-key', city: 'Calgary', pageNum: 1, fetcher: vi.fn().mockResolvedValue(response([{ ...listing, ...patch }])) });
  expect(page.rows).toEqual([]); expect(page.hiddenIds).toEqual(['1:FIXTURE-1']);
});
it.each([401, 403, 429, 500])('returns a sanitized upstream failure for HTTP %i', async status => {
  await expect(fetchRepliersPage({ apiKey: 'sensitive-test-key', city: 'Calgary', pageNum: 1, fetcher: vi.fn().mockResolvedValue(new Response('private response', { status })) })).rejects.toThrow(/Repliers/);
});
it('rejects schema changes, duplicate IDs and invalid prices without partial results', async () => {
  for (const body of [response([], { page: 2 }), response([listing, listing]), response([{ ...listing, listPrice: '-1' }]), response([{ ...listing, mlsNumber: undefined }])]) {
    await expect(fetchRepliersPage({ apiKey: 'test-key', city: 'Calgary', pageNum: 1, fetcher: vi.fn().mockResolvedValue(body) })).rejects.toThrow();
  }
});
it('rejects oversized and non-JSON payloads', async () => {
  for (const body of [new Response('x'.repeat(2_000_001), { headers: { 'Content-Type': 'application/json' } }), new Response('<html>error</html>')]) {
    await expect(fetchRepliersPage({ apiKey: 'test-key', city: 'Calgary', pageNum: 1, fetcher: vi.fn().mockResolvedValue(body) })).rejects.toThrow();
  }
});
