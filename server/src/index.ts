import 'dotenv/config';
import { createListingStorage } from './listings/repository.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}
const storage = createListingStorage();
const server = createApp({ listingStorage: storage }).listen(port, () => console.log(`Alberta Stays listening on ${port}`));
server.on('error', () => {
  console.error('Server failed to start; check PORT availability.');
  process.exitCode = 1;
});

process.once('SIGTERM', () => {
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  server.close(() => {
    void (async () => {
      try { await storage?.disconnect(); }
      catch { console.error('Storage shutdown failed.'); process.exitCode = 1; }
      finally { clearTimeout(timeout); }
    })();
  });
});
