import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    file: { type: 'string' }, source: { type: 'string' }, city: { type: 'string' }, page: { type: 'string' },
  } });
  const base = new URL(process.env.APP_URL ?? 'http://localhost:3001');
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('APP_URL must be a bare service origin.');
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))) throw new Error('Use HTTPS except for local development.');
  const token = process.env.ADMIN_INGEST_TOKEN;
  if (!token || token.length < 32) throw new Error('Set ADMIN_INGEST_TOKEN securely before using the admin CLI.');
  let route; let body; let method = 'POST';
  switch (positionals[0]) {
    case 'sources': route = '/api/admin/sources'; method = 'GET'; break;
    case 'source':
      if (!values.file) throw new Error('source requires --file source.json');
      route = '/api/admin/sources'; body = JSON.parse(await readFile(values.file, 'utf8')); break;
    case 'csv':
      if (!values.source || !values.file) throw new Error('csv requires --source SOURCE_ID --file listings.csv');
      route = '/api/admin/listings/import'; body = { sourceId: values.source, csv: await readFile(values.file, 'utf8') }; break;
    case 'repliers':
      if (!values.source || !values.city) throw new Error('repliers requires --source SOURCE_ID --city Calgary [--page 1]');
      route = '/api/admin/repliers/sync'; body = { sourceId: values.source, city: values.city, pageNum: Number(values.page ?? 1) }; break;
    case 'purge':
      if (!values.source) throw new Error('purge requires --source SOURCE_ID; removes all stored listings for that source.');
      route = `/api/admin/sources/${encodeURIComponent(values.source)}/listings`; method = 'DELETE'; break;
    default: throw new Error('Commands: sources | source --file source.json | csv --source ID --file listings.csv | repliers --source ID --city CITY [--page N] | purge --source ID');
  }
  const response = await fetch(new URL(route, base), {
    method, redirect: 'error', signal: AbortSignal.timeout(60000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`);
  console.log(JSON.stringify(payload, null, 2));
} catch (error) {
  console.error('Listing administration failed:', error.message);
  process.exitCode = 1;
}
