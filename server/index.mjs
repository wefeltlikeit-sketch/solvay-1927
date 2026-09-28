/**
 * Production server: serves the built app from dist/ and the /api routes.
 *   npm run build && npm start
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './env.mjs';
import { handleApi } from './api.mjs';

const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 8787);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  if (req.url?.startsWith('/api/')) return handleApi(req, res);
  const clean = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIST, clean);
  if (!file.startsWith(DIST)) {
    res.statusCode = 403;
    return res.end();
  }
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
  } catch {
    file = path.join(DIST, 'index.html');
  }
  try {
    const body = await readFile(file);
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('Not found — run `npm run build` first.');
  }
}).listen(PORT, () => {
  console.log(`Solvay 1927 — http://localhost:${PORT}`);
});
