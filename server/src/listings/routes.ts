import { fetchRepliersPage, RepliersError, repliersSyncSchema } from './repliers.js';
import { Router, type RequestHandler } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { importSchema, ImportError, parseListingsCsv, querySchema, sourceSchema } from './validation.js';
import type { ListingRepository } from './repository.js';

export type ListingStorage = { repository: ListingRepository; token: string; publishListings?: boolean; repliersKey?: string };
export function listingRoutes(storage?: ListingStorage) {
  const router = Router();
  let syncing = false;
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use((_req, res, next) => {
    if (!storage || storage.token.length < 32) { res.status(503).json({ error: 'Listing storage is not enabled.' }); return; }
    next();
  });
  const protect: RequestHandler = (req, res, next) => {
    const header = req.get('authorization') ?? '';
    const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
    const digest = (value: string) => createHash('sha256').update(value).digest();
    if (!supplied || !timingSafeEqual(digest(supplied), digest(storage!.token))) {
      res.set('WWW-Authenticate', 'Bearer');
      res.status(401).json({ error: 'Administrator authorization required.' }); return;
    }
    next();
  };
  router.use('/admin', protect);
  router.get('/listings', async (req, res, next) => {
    if (!storage!.publishListings) { res.status(503).json({ error: 'Public listing publication is not enabled.' }); return; }
    const query = querySchema.safeParse(req.query);
    if (!query.success) { res.status(400).json({ error: 'Invalid listing filters.' }); return; }
    try {
      res.json({ ...await storage!.repository.list(query.data), page: query.data.page, limit: query.data.limit,
        disclaimer: 'Imported source data, not independently verified. Confirm availability, price and short-term rental eligibility with the source.' });
    } catch (error) { next(error); }
  });
  router.get('/admin/sources', async (_req, res, next) => {
    try { res.json({ sources: await storage!.repository.sources() }); } catch (error) { next(error); }
  });
  router.post('/admin/sources', async (req, res, next) => {
    const parsed = sourceSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Source name, HTTPS URL, permission reference and authorized: true are required.' }); return; }
    try { res.status(201).json({ source: await storage!.repository.createSource(parsed.data) }); } catch (error) { next(error); }
  });
  router.post('/admin/listings/import', async (req, res, next) => {
    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Provide sourceId and a CSV payload up to 90,000 characters.' }); return; }
    try {
      const source = await storage!.repository.source(parsed.data.sourceId);
      if (source?.provider !== 'csv') { res.status(400).json({ error: 'CSV import requires a registered CSV source.' }); return; }
      const rows = parseListingsCsv(parsed.data.csv);
      res.json({ ...await storage!.repository.import(parsed.data.sourceId, rows), verificationStatus: 'unverified' });
    } catch (error) {
      if (error instanceof ImportError) { res.status(400).json({ error: error.message }); return; }
      next(error);
    }
  });
  router.delete('/admin/sources/:id/listings', async (req, res, next) => {
    try { res.json(await storage!.repository.purge(req.params.id)); } catch (error) { next(error); }
  });
  router.post('/admin/repliers/sync', async (req, res, next) => {
    const parsed = repliersSyncSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Provide sourceId, city and an optional positive pageNum.' }); return; }
    if (!storage!.repliersKey) { res.status(503).json({ error: 'Repliers is not configured.' }); return; }
    if (syncing) { res.status(409).json({ error: 'A Repliers request is already running. Retry after it completes.' }); return; }
    syncing = true;
    try {
      const source = await storage!.repository.source(parsed.data.sourceId);
      if (source?.provider !== 'repliers' || source.url !== 'https://api.repliers.io') {
        res.status(400).json({ error: 'Register an authorized Repliers source first.' }); return;
      }
      const page = await fetchRepliersPage({ apiKey: storage!.repliersKey, city: parsed.data.city, pageNum: parsed.data.pageNum });
      const result = await storage!.repository.import(source.id, page.rows, page.hiddenIds);
      res.json({ ...result, excluded: page.hiddenIds.length, page: page.page, nextPage: page.nextPage, verificationStatus: 'unverified' });
    } catch (error) {
      if (error instanceof RepliersError) { res.status(error.status).json({ error: error.message }); return; }
      if (error instanceof ImportError) { res.status(400).json({ error: error.message }); return; }
      next(error);
    } finally { syncing = false; }
  });
  return router;
}
