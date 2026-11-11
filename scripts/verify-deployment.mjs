import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { smoke } from './smoke.mjs';

// Use a fresh process and available port to exercise the actual production entry.
const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
const child = spawn(process.execPath, ['server/dist/index.js'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: String(port) },
  stdio: ['ignore', 'inherit', 'inherit'],
});
let spawnError;
child.on('error', error => { spawnError = error; });
const exited = new Promise(resolve => {
  child.once('exit', resolve);
  child.once('error', resolve);
});
const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Production server exited before readiness');
    try {
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(500) });
      ready = response.ok && (await response.json()).ok === true;
    } catch { /* Retry startup only; smoke failures are not retried. */ }
    if (ready) break;
    await delay(100);
  }
  if (!ready) throw new Error('Production server did not become healthy');
  await smoke(base);
} catch (error) {
  console.error('Production rehearsal failed:', error.message);
  process.exitCode = 1;
} finally {
  if (child.pid && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGTERM');
    const forceKill = setTimeout(() => child.kill('SIGKILL'), 5000);
    forceKill.unref();
    await exited;
    clearTimeout(forceKill);
  }
}
