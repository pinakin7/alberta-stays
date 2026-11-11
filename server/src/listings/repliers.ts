import { z } from 'zod';
import { ImportError, type ListingRow } from './validation.js';

// Request/response fields are based on Repliers' published api-types 0.4.0.
// Validate at the boundary: entitlements and current board rules still need a
// live, authorized account check. Never persist raw payloads or agent details.
const recordSchema = z.object({
  mlsNumber: z.string().min(1).max(100), boardId: z.number().int().positive(),
  status: z.string(), type: z.string(),
  listPrice: z.union([z.string(), z.number().finite()]),
  address: z.object({ city: z.string().trim().min(1).max(120), state: z.string() }),
  permissions: z.object({ displayPublic: z.string().optional(), displayInternetEntireListing: z.string().optional() }).optional(),
  office: z.object({ brokerageName: z.string().trim().min(1).max(240).nullish() }).optional(),
  details: z.object({ numBedrooms: z.union([z.string(), z.number()]).nullish() }).optional(),
});
const pageSchema = z.object({
  page: z.number().int().positive(), numPages: z.number().int().nonnegative(),
  listings: z.array(recordSchema).max(100),
});
export const repliersSyncSchema = z.object({
  sourceId: z.string().min(1).max(100), city: z.string().trim().min(1).max(120),
  pageNum: z.number().int().min(1).max(10000).default(1),
}).strict();
export class RepliersError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export async function fetchRepliersPage(options: {
  apiKey: string; city: string; pageNum: number; fetcher?: typeof fetch; now?: Date;
}) {
  const url = new URL('https://api.repliers.io/listings');
  url.search = new URLSearchParams({
    state: 'AB', city: options.city, status: 'A', type: 'Sale',
    resultsPerPage: '100', pageNum: String(options.pageNum),
  }).toString();
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(url, {
      headers: { 'REPLIERS-API-KEY': options.apiKey, Accept: 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
  } catch { throw new RepliersError(502, 'Repliers could not be reached. No records were imported.'); }
  if (response.status === 401 || response.status === 403) throw new RepliersError(502, 'Repliers denied access. Check the server key and MLS entitlements.');
  if (response.status === 429) throw new RepliersError(429, 'Repliers rate limit reached. Retry later; no automatic retries are made.');
  if (!response.ok) throw new RepliersError(502, 'Repliers returned an error. No records were imported.');
  if (!response.headers.get('content-type')?.includes('application/json')) throw new RepliersError(502, 'Unexpected Repliers response format.');
  let payload: unknown;
  try {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Missing response body');
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 2_000_000) throw new Error('Response too large');
        chunks.push(chunk.value);
      }
    } finally { await reader.cancel(); }
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { throw new RepliersError(502, 'Invalid or oversized Repliers response. No records were imported.'); }
  const parsed = pageSchema.safeParse(payload);
  if (!parsed.success || parsed.data.page !== options.pageNum) throw new RepliersError(502, 'Repliers response did not match the expected listing schema.');
  const now = options.now ?? new Date();
  const rows: ListingRow[] = [];
  const hiddenIds: string[] = [];
  const seen = new Set<string>();
  for (const listing of parsed.data.listings) {
    const externalId = `${listing.boardId}:${listing.mlsNumber}`;
    if (seen.has(externalId)) throw new ImportError('Repliers returned duplicate listing IDs in one page.');
    seen.add(externalId);
    const province = listing.address.state.trim().toLowerCase();
    if (listing.status !== 'A' || listing.type !== 'Sale' || !['ab', 'alberta'].includes(province)
      || listing.address.city.toLowerCase() !== options.city.trim().toLowerCase()
      || listing.permissions?.displayPublic !== 'Y' || listing.permissions?.displayInternetEntireListing !== 'Y'
      || !listing.office?.brokerageName) { hiddenIds.push(externalId); continue; }
    const price = String(listing.listPrice);
    if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(price) || Number(price) <= 0 || Number(price) > 10_000_000) {
      throw new RepliersError(502, 'Repliers returned an unsupported asking price. No records were imported.');
    }
    const beds = listing.details?.numBedrooms;
    rows.push({
      externalId, title: `MLS ${listing.mlsNumber} — ${listing.address.city}`,
      market: listing.address.city, priceCad: price,
      bedrooms: beds != null && /^\d{1,2}$/.test(String(beds)) ? Number(beds) : null,
      sourceUrl: `https://api.repliers.io/listings/${encodeURIComponent(listing.mlsNumber)}?boardId=${listing.boardId}`,
      retrievedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
      mlsNumber: listing.mlsNumber, boardId: listing.boardId, brokerageName: listing.office.brokerageName,
    });
  }
  return { rows, hiddenIds, page: parsed.data.page, nextPage: parsed.data.page < parsed.data.numPages ? parsed.data.page + 1 : null };
}
