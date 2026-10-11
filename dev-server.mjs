// Local static server for development: serves the app files from disk, like GitHub Pages does.
// Usage: node dev-server.mjs [port]   (listens on 127.0.0.1 only)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.argv[2] || process.env.PORT || 8090);
const HOST = '127.0.0.1';
const ROOT = fileURLToPath(new URL('.', import.meta.url));
// Only these files are served; anything else is a 404.
const FILES = new Set([
  'index.html',
  'sw.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
]);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1']);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('invalid port');

const server = createServer(async (req, res) => {
  const hostname = (req.headers.host || '').replace(/:\d+$/, '');
  if (!ALLOWED_HOSTS.has(hostname)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Bad host');
    return;
  }
  let path = '';
  let status;
  try {
    path = new URL(req.url, 'http://localhost').pathname;
    const file = path === '/' ? 'index.html' : path.slice(1);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      status = 405;
      res.writeHead(405, { 'Content-Type': 'text/plain', Allow: 'GET, HEAD' }).end('Method not allowed');
    } else if (!FILES.has(file)) {
      status = 404;
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    } else {
      const body = await readFile(ROOT + file);
      status = 200;
      res.writeHead(200, { 'Content-Type': TYPES[file.slice(file.lastIndexOf('.'))], 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : body);
    }
  } catch {
    status = 500;
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error');
  }
  console.log(`${req.method} ${path} ${status}`);
});

server.listen(PORT, HOST, () => console.log(`Formfit dev server on http://localhost:${PORT}/`));
