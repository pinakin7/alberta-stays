import 'dotenv/config';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}
const server = createApp().listen(port, () => console.log(`Alberta Stays listening on ${port}`));
server.on('error', () => {
  console.error('Server failed to start; check PORT availability.');
  process.exitCode = 1;
});
