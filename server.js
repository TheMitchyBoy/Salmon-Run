'use strict';

// Minimal zero-dependency static file server for Railway (and any host that sets
// $PORT). Railway terminates TLS in front of the app, so the public URL is
// https:// — which WebAR requires for camera access. The app itself just needs
// to serve index.html and its assets on $PORT.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
const ROOT = __dirname;

// Explicit MIME types so binary AR assets are served correctly. Browsers are
// forgiving for fetch(), but getting these right avoids subtle decode issues.
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.mind': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

function send(res, status, body, headers) {
  res.writeHead(status, headers || { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed');
  }

  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  // Resolve and guard against path traversal outside ROOT.
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    return send(res, 403, 'Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      return send(res, 404, 'Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      // Camera/AR needs a secure context; Railway provides https. These headers
      // are harmless and help some browsers with WASM threading if ever needed.
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    };
    if (req.method === 'HEAD') {
      res.writeHead(200, headers);
      return res.end();
    }
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Salmon AR static server listening on http://${HOST}:${PORT}`);
});
