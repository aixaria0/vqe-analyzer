// Serve only the public app assets, rather than the repository or installed packages.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const assets = { 'index.html': 'text/html', 'style.css': 'text/css', 'app.js': 'text/javascript', 'engine.js': 'text/javascript', 'evolution.js': 'text/javascript', 'charts.js': 'text/javascript', 'favicon.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!Object.hasOwn(assets, name)) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(path.join(root, name), (error, data) => {
    if (error) { res.writeHead(500); res.end('Unable to load asset'); return; }
    res.writeHead(200, { 'Content-Type': assets[name] + '; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); res.end(data);
  });
}).listen(Number(process.env.PORT || 8000), '127.0.0.1', () => console.log(`VQE workbench: http://127.0.0.1:${process.env.PORT || 8000}`));
