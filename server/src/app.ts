import { listingRoutes, type ListingStorage } from './listings/routes.js';
import express, { type ErrorRequestHandler } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { markets, properties } from './data.js';
import { calculateScenario, scenarioSchema } from './scenario.js';

export function createApp(options: { clientDist?: string; onError?: (error: unknown) => void; listingStorage?: ListingStorage } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/markets', (_req, res) => res.json({ markets, disclaimer: 'Illustrative historical pitch benchmarks; not live market data.' }));
  app.get('/api/properties', (_req, res) => res.json({ properties, disclaimer: 'Sample data only; not live listings.' }));
  app.post('/api/scenarios/calculate', (req, res) => {
    if (!req.is('application/json')) {
      res.status(415).json({ error: 'Content-Type must be application/json.' });
      return;
    }
    const parsed = scenarioSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid scenario inputs.', details: parsed.error.flatten() });
      return;
    }
    res.json(calculateScenario(parsed.data));
  });
  const listingRouter = listingRoutes(options.listingStorage);
  app.use('/api', (req, res, next) => {
    if (req.path === '/listings' || req.path.startsWith('/admin/')) { listingRouter(req, res, next); } else next();
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  const dist = options.clientDist ?? path.resolve(process.cwd(), 'client/dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));
  const handleError: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) { next(error); return; }
    if (error.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Malformed JSON body.' });
    } else if (error.type === 'entity.too.large') {
      res.status(413).json({ error: 'Request body exceeds 100kb.' });
    } else if (['P2002', 'P2034'].includes(error.code)) {
      res.status(409).json({ error: 'Conflicting or concurrent update. Refresh and retry.' });
    } else if (['P1001', 'P1002', 'P2021', 'P2022', 'P2028'].includes(error.code)) {
      res.status(503).json({ error: 'Listing storage is temporarily unavailable.' });
    } else {
      if (options.onError) options.onError(error);
      else console.error('Unexpected request failure', { name: error?.name, code: error?.code });
      res.status(500).json({ error: 'An unexpected server error occurred.' });
    }
  };
  app.use(handleError);
  return app;
}
