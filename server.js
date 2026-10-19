const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  // CORS & No-Cache Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  let cleanUrl = req.url.split('?')[0].split('#')[0];
  if (cleanUrl === '/' || !cleanUrl) {
    cleanUrl = '/index.html';
  }

  // Safe file path resolution
  const safePath = path.normalize(decodeURIComponent(cleanUrl)).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(ROOT, safePath);

  // If path doesn't exist and has no extension, fallback to index.html (SPA routing)
  if (!fs.existsSync(filePath)) {
    if (!path.extname(cleanUrl)) {
      filePath = path.join(ROOT, 'index.html');
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('========================================================');
  console.log(' Digi-Action Local Dev Server (Node.js) Berjalan!');
  console.log(` Akses di Browser: http://localhost:${PORT}/`);
  console.log(` Root Directory  : ${ROOT}`);
  console.log(' Tekan Ctrl+C untuk menghentikan server.');
  console.log('========================================================');
});
