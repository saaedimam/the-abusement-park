import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import {
  bootstrapFixture,
  liveFixture,
  managerHistories,
  managerPicks,
  standingsFixture
} from '../tests/fixtures/fpl.js';

const pagesPort = Number(process.env.E2E_PORT || 8788);
const stubPort = Number(process.env.E2E_STUB_PORT || 8799);

function send(response, body, status = 200) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  });
  response.end(payload);
}

const stub = createServer((request, response) => {
  const url = new URL(request.url || '/', `http://127.0.0.1:${stubPort}`);
  const path = url.pathname;
  if (path === '/health') {
    send(response, { ok: true });
    return;
  }
  if (path.includes('/leagues-classic/') && path.endsWith('/standings/')) {
    send(response, standingsFixture);
    return;
  }
  if (path.endsWith('/bootstrap-static/')) {
    send(response, bootstrapFixture);
    return;
  }
  if (path.includes('/event/') && path.endsWith('/live/')) {
    send(response, liveFixture);
    return;
  }
  if (path.endsWith('/fixtures/')) {
    send(response, []);
    return;
  }
  const picks = path.match(/\/entry\/([^/]+)\/event\/[^/]+\/picks\/?$/);
  if (picks) {
    send(response, managerPicks[picks[1]] ?? { picks: [] });
    return;
  }
  const history = path.match(/\/entry\/([^/]+)\/history\/?$/);
  if (history) {
    send(response, managerHistories[history[1]] ?? { current: [], past: [] });
    return;
  }
  send(response, { error: `No FPL stub for ${path}` }, 404);
});

await new Promise((resolve) => {
  stub.listen(stubPort, '127.0.0.1', resolve);
});

const wranglerBin = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const child = spawn(process.execPath, [
  wranglerBin,
  'pages', 'dev', 'public',
  '--port', String(pagesPort),
  '--binding', `FPL_API_ORIGIN=http://127.0.0.1:${stubPort}`
], { stdio: 'inherit' });

function shutdown() {
  stub.close();
  child.kill('SIGTERM');
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
child.on('exit', (code) => {
  stub.close();
  process.exit(code ?? 0);
});
