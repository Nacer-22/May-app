'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, '..', 'docs');
const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const AUTH_API_URL = process.env.AUTH_API_URL || 'https://key-system-yn0o.onrender.com/api/redeem';
const MAX_BODY_BYTES = 8 * 1024;
const UPSTREAM_TIMEOUT_MS = 12_000;
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT = 12;
const rateBuckets = new Map();

const STATIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/config.js', ['config.js', 'text/javascript; charset=utf-8']],
  ['/skull-logo.png', ['skull-logo.png', 'image/png']],
]);

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
  );
  res.setHeader('Cache-Control', 'no-store');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body is too large.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('Invalid JSON body.'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function clientAddress(req) {
  // Render and other reverse proxies set this header. Only the first address is used.
  const forwarded = req.headers['x-forwarded-for'];
  return (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || 'unknown';
}

function isRateLimited(address) {
  const now = Date.now();
  const current = rateBuckets.get(address);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(address, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT;
}

async function handleLogin(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    return sendJson(res, error.statusCode || 400, { ok: false, message: error.message });
  }

  const key = typeof body.key === 'string' ? body.key.trim() : '';
  if (!key || key.length > 160) {
    return sendJson(res, 400, { ok: false, message: 'أدخل مفتاحًا صالحًا.' });
  }

  if (isRateLimited(clientAddress(req))) {
    return sendJson(res, 429, { ok: false, message: 'محاولات كثيرة. حاول بعد دقائق.' });
  }

  let target;
  try {
    target = new URL(AUTH_API_URL);
    if (target.protocol !== 'https:' && target.hostname !== 'localhost' && target.hostname !== '127.0.0.1') {
      throw new Error('AUTH_API_URL must use HTTPS.');
    }
  } catch {
    return sendJson(res, 500, { ok: false, message: 'عنوان خدمة التحقق غير مضبوط.' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key }),
      signal: controller.signal,
    });

    const raw = await upstream.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }

    if (!upstream.ok) {
      const message = data && (data.message || data.error);
      return sendJson(res, upstream.status >= 400 && upstream.status < 500 ? 401 : 502, {
        ok: false,
        message: typeof message === 'string' ? message.slice(0, 180) : 'رفضت خدمة التحقق الطلب.',
      });
    }

    // No 2xx response is treated as a grant unless the server explicitly confirms it.
    const accepted = !!data && (data.ok === true || data.success === true || data.valid === true);
    if (!accepted) {
      const message = data && (data.message || data.error);
      return sendJson(res, 401, {
        ok: false,
        message: typeof message === 'string' ? message.slice(0, 180) : 'لم تؤكد خدمة التحقق صلاحية المفتاح.',
      });
    }

    return sendJson(res, 200, {
      ok: true,
      message: typeof data.message === 'string' ? data.message.slice(0, 180) : 'تم التحقق من المفتاح بنجاح.',
    });
  } catch (error) {
    const timedOut = error && error.name === 'AbortError';
    return sendJson(res, 502, {
      ok: false,
      message: timedOut ? 'انتهت مهلة الاتصال بخدمة التحقق.' : 'تعذر الاتصال بخدمة التحقق.',
    });
  } finally {
    clearTimeout(timeout);
  }
}

const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'POST' && url.pathname === '/api/login') {
    return handleLogin(req, res);
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { ok: false, message: 'Method not allowed.' });
  }

  const entry = STATIC_FILES.get(url.pathname);
  if (!entry) {
    return sendJson(res, 404, { ok: false, message: 'Not found.' });
  }

  const [filename, contentType] = entry;
  const filePath = path.join(PUBLIC, filename);
  fs.readFile(filePath, (error, content) => {
    if (error) return sendJson(res, 500, { ok: false, message: 'Unable to read asset.' });
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(req.method === 'HEAD' ? undefined : content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Nacer_X_Rida portal listening on port ${PORT}`);
  console.log(`Authentication endpoint configured: ${new URL(AUTH_API_URL).origin}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
