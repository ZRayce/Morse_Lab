/* global process */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const MAINTENANCE = process.env.MAINTENANCE_MODE === 'true';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const server = http.createServer((req, res) => {
  if (MAINTENANCE) {
    res.writeHead(503, {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/plain; charset=utf-8',
      'Retry-After': '300',
    });
    res.end('503 Service Unavailable - MorseLab Station Scheduled Maintenance');
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/plain; charset=utf-8',
    });
    res.end('405 Method Not Allowed');
    return;
  }

  const rawUrl = (req.url || '/').split('?')[0];
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(rawUrl);
  } catch {
    res.writeHead(400, SECURITY_HEADERS);
    res.end('400 Bad Request');
    return;
  }

  const safeSuffix = path.normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/, '');
  let filePath = path.join(DIST_DIR, safeSuffix === '/' ? 'index.html' : safeSuffix);

  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403, SECURITY_HEADERS);
    res.end('403 Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, {
        ...SECURITY_HEADERS,
        'Content-Type': 'text/plain; charset=utf-8',
      });
      res.end('500 Internal Server Error - Run npm run build first');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const cacheControl =
      ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable';

    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(content);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`MorseLab station server listening on http://${HOST}:${PORT}`);
});