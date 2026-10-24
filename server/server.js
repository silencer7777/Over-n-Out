// OVER N' OUT — zero-dependency static server (Node 18+).
// Serves the game frontend. The real backend (auth, saves, store API)
// will live alongside this — see backend/README.md and docs/ROADMAP.md.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = process.env.PORT || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
};

const server = http.createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = normalize(join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
    // Public surface only: the game frontend. Server source, tools, docs and
    // repo metadata live under ROOT but are not public — 404 them. Authorize
    // the RESOLVED path (relative to ROOT), never the raw URL string: an
    // encoded slash (%2f) is not a separator in the URL string but is one
    // on disk, so a prefix check on urlPath can be bypassed (Board 001,
    // Aegis — /js/%2e%2e%2fserver%2fserver.js used to serve this file).
    const rel = relative(ROOT, filePath);
    const isPublic = rel === 'index.html' || rel.startsWith('css' + sep)
      || rel.startsWith('js' + sep) || rel.startsWith('vendor' + sep);
    if (!isPublic) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => console.log(`OVER N' OUT server → http://localhost:${PORT}`));
