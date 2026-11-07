const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./data/db');
const interceptor = require('./src/engine/packet_interceptor');
const gameTunnel = require('./src/engine/game_tunnel');

// --- External Key Server Integration (Nacer_x_Rida) ---
const EXTERNAL_KEY_VERIFY_URL = process.env.EXTERNAL_KEY_VERIFY_URL || 'https://key-system-yn0o.onrender.com/api/verify';


const SUB_TOKEN_SECRET = process.env.SUB_TOKEN_SECRET || crypto.createHash('sha256').update((process.env.ADMIN_PASSWORD||'') + '|nacerxrida-sub').digest('hex');

function b64url(buf){ return Buffer.from(buf).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function makeSubToken(key, hwid, ttlSec=86400){
  const exp = Math.floor(Date.now()/1000) + ttlSec;
  const payload = b64url(JSON.stringify({k:key,h:hwid||'',e:exp}));
  const sig = b64url(crypto.createHmac('sha256', SUB_TOKEN_SECRET).update(payload).digest());
  return payload + '.' + sig;
}
function verifySubToken(token){
  try{
    if(!token||!token.includes('.')) return null;
    const [payload,sig]=token.split('.');
    const expSig=b64url(crypto.createHmac('sha256', SUB_TOKEN_SECRET).update(payload).digest());
    if(sig!==expSig) return null;
    const obj=JSON.parse(Buffer.from(payload.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8'));
    if(!obj||!obj.k||!obj.e) return null;
    if(obj.e < Math.floor(Date.now()/1000)) return null;
    return { key:String(obj.k).toUpperCase(), hwid:obj.h||'' };
  }catch(e){ return null; }
}

async function verifyExternalKey({ key, hwid, device_model, device_os }) {
  // Prefer /api/check (no device-slot consumption) then /api/verify
  const baseUrl = EXTERNAL_KEY_VERIFY_URL.replace(/\/api\/verify\/?$/, '');
  const payload = { code: key, device_id: hwid, key, hwid, device_model, device_os };
  async function tryUrl(url) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload) });
    const data = await r.json().catch(() => ({}));
    return { r, data };
  }
  try {
    let { r, data } = await tryUrl(baseUrl + '/api/check');
    if (!(r && data && typeof data.valid !== 'undefined')) ({ r, data } = await tryUrl(EXTERNAL_KEY_VERIFY_URL));
    if (data && (data.valid === true || data.ok === true || data.success === true)) return { ok: true, source: 'external', data };
    if (data && data.valid === false) return { ok: false, source: 'external', data };
    if (r && (r.status === 401 || r.status === 403)) return { ok: false, source: 'external', data };
    return { ok: false, inconclusive: true, source: 'external', data, status: r && r.status };
  } catch (e) {
    return { ok: false, inconclusive: true, source: 'external', error: String(e) };
  }
}


// Start active UDP game tunnel
gameTunnel.start();

// Initialize interceptor with saved features
interceptor.setFeatures(db.get().global_features);

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;

// كلمة مرور الأدمن (يمكن التحكم بها عبر متغيرات البيئة أو استخدام القيمة الافتراضية)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'powerup-admin-2026';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

// SSE Clients set
const sseClients = new Set();

function broadcastEvent(eventName, data) {
  for (const client of sseClients) {
    try {
      client.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        resolve({});
      }
    });
  });
}

function generateRandomKey(prefix = 'PHTM') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const chunk = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${prefix}-${chunk()}-${chunk()}-${chunk()}`;
}

function detectServerDevice(ua = '') {
  let os = 'Unknown OS';
  let model = 'Unknown Device';

  if (/Windows NT 10.0/i.test(ua)) {
    os = 'Windows 10/11 64-bit';
    model = 'Windows PC';
  } else if (/Windows NT 6.3/i.test(ua)) {
    os = 'Windows 8.1';
    model = 'Windows PC';
  } else if (/Windows NT 6.1/i.test(ua)) {
    os = 'Windows 7';
    model = 'Windows PC';
  } else if (/iPhone/i.test(ua)) {
    const v = ua.match(/OS (\d+[_\.]\d+)/);
    os = v ? `iOS ${v[1].replace('_', '.')}` : 'iOS';
    model = `iPhone (${os})`;
  } else if (/iPad/i.test(ua)) {
    const v = ua.match(/OS (\d+[_\.]\d+)/);
    os = v ? `iPadOS ${v[1].replace('_', '.')}` : 'iPadOS';
    model = `iPad (${os})`;
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    const v = ua.match(/Mac OS X (\d+[_\.]\d+)/);
    os = v ? `macOS ${v[1].replace('_', '.')}` : 'macOS';
    model = `Mac (${os})`;
  } else if (/Android/i.test(ua)) {
    const v = ua.match(/Android (\d+(\.\d+)?)/);
    os = v ? `Android ${v[1]}` : 'Android';
    const m = ua.match(/;\s*([A-Za-z0-9\-\s\_]+)\s+Build\//);
    model = m ? `${m[1].trim()} (${os})` : `Android Device (${os})`;
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
    model = 'Linux Desktop';
  }

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';

  if (model === 'Windows PC' || model === 'Linux Desktop') {
    model = `${model} (${browser})`;
  }

  return { os, model };
}

// دالة التحقق من صلاحية الأدمن عبر HTTP Basic Auth
function isAdminAuthorized(req) {
  const auth = req.headers['authorization'];
  if (!auth) return false;
  const [type, creds] = auth.split(' ');
  if (type !== 'Basic') return false;
  const decoded = Buffer.from(creds, 'base64').toString();
  const colonIndex = decoded.indexOf(':');
  if (colonIndex === -1) return false;
  const user = decoded.slice(0, colonIndex);
  const pass = decoded.slice(colonIndex + 1);
  return user === 'admin' && pass === ADMIN_PASSWORD;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ==========================================
  // حماية لوحة التحكم ومسارات الأدمن
  // ==========================================
  if (pathname.startsWith('/api/admin/') || pathname === '/admin' || pathname === '/admin/') {
    if (!isAdminAuthorized(req)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin Panel"' });
      res.end('Unauthorized');
      return;
    }
  }

  // ==========================================
  // CLIENT API ENDPOINTS
  // ==========================================

  // Check Maintenance Status
  if (pathname === '/api/maintenance' && req.method === 'GET') {
    return sendJson(res, 200, db.getMaintenance());
  }

  // Client Key Authentication / Redeem
  if (pathname === '/api/redeem' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const rawKey = (body.key || '').trim();
    const key = rawKey.toUpperCase();

    if (!rawKey) {
      return sendJson(res, 400, { error: 'enter your full key' });
    }

    const ua = req.headers['user-agent'] || '';
    const serverDev = detectServerDevice(ua);
    const clientHwid = (body.hwid || '').trim() || `PHTM-${crypto.createHash('md5').update(ua + (req.socket.remoteAddress || '')).digest('hex').slice(0, 8).toUpperCase()}`;
    const clientDeviceModel = (body.device_model || '').trim() || serverDev.model;
    const clientDeviceOs = (body.device_os || '').trim() || serverDev.os;

    const maintenance = db.getMaintenance();
    const isSpecialLogin = ['OWNER', 'ADMIN', 'TEST'].includes(key);

    // Maintenance check
    if (maintenance.enabled) {
      const isAllowed = maintenance.allowed_logins.some(
        item => item.toUpperCase() === key || (isSpecialLogin && item.toUpperCase() === key)
      );
      if (!isAllowed) {
        return sendJson(res, 403, { 
          error: maintenance.blocked 
            ? 'your account is paused during maintenance. back soon.' 
            : 'maintenance in progress. only allowed test logins are currently permitted.' 
        });
      }
    }

    // Special Owner / Test Access
    if (isSpecialLogin) {
      return sendJson(res, 200, {
        ok: true,
        me: {
          status: 'active',
          bound_hwid: clientHwid,
          device_model: clientDeviceModel,
          device_os: clientDeviceOs,
          expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
          features: db.get().global_features
        }
      });
    }

    // Check Key in Database / External Key Server (Nacer_x_Rida)
    let keyRecord = db.findKey(key);
    let external = null;
    try {
      external = await verifyExternalKey({ key, hwid: clientHwid, device_model: clientDeviceModel, device_os: clientDeviceOs });
    } catch (e) { external = { ok:false, error:String(e) }; }

    if (external && external.ok) {
      // Valid on external key server: sync/create local record for admin panel & features
      if (!keyRecord) {
        keyRecord = {
          key,
          status: 'active',
          bound_hwid: clientHwid,
          device_model: clientDeviceModel,
          device_os: clientDeviceOs,
          created_at: new Date().toISOString(),
          expires_at: (external.data && (external.data.expires_at || external.data.expiry || external.data.expires)) || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
          note: 'Verified by external key server',
          features: db.get().global_features
        };
        db.addKey(keyRecord);
      } else {
        const upd = { status: 'active' };
        if (!keyRecord.bound_hwid) { upd.bound_hwid = clientHwid; upd.device_model = clientDeviceModel; upd.device_os = clientDeviceOs; }
        if (external.data && (external.data.expires_at || external.data.expiry || external.data.expires)) upd.expires_at = external.data.expires_at || external.data.expiry || external.data.expires;
        keyRecord = { ...keyRecord, ...upd };
        db.updateKey(key, upd);
      }
    } else if (external && !external.inconclusive) {
      // External server explicitly rejected
      const reason = (external.data && (external.data.reason || external.data.message || external.data.error)) || 'invalid key';
      // Allow admin/local override if key exists and is active locally
      if (!(keyRecord && keyRecord.status === 'active' && new Date(keyRecord.expires_at || Date.now()+1).getTime() > Date.now())) {
        return sendJson(res, 403, { error: `external key server: ${reason}` });
      }
    } else {
      // External inconclusive/unreachable: fallback to local DB behavior
      if (!keyRecord) {
        keyRecord = {
          key: key.startsWith('NACER') ? key : `NACER-${key.padEnd(4, 'X').slice(0, 4)}-LOCAL-KEY`,
          status: 'active',
          bound_hwid: clientHwid,
          device_model: clientDeviceModel,
          device_os: clientDeviceOs,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3650 * 24 * 3600 * 1000).toISOString(),
          note: 'Local fallback (external server unavailable)',
          features: db.get().global_features
        };
        db.addKey(keyRecord);
      }
    }

    if (keyRecord.status === 'revoked') {
      return sendJson(res, 400, { error: 'this license key has been revoked' });
    }

    if (keyRecord.expires_at && new Date(keyRecord.expires_at).getTime() < Date.now()) {
      return sendJson(res, 400, { error: 'this license key has expired' });
    }

    // Device lock check & binding
    if (!keyRecord.bound_hwid) {
      keyRecord.bound_hwid = clientHwid;
      keyRecord.device_model = clientDeviceModel;
      keyRecord.device_os = clientDeviceOs;
      db.updateKey(key, {
        bound_hwid: clientHwid,
        device_model: clientDeviceModel,
        device_os: clientDeviceOs
      });
    } else {
      if (keyRecord.bound_hwid !== clientHwid) {
        return sendJson(res, 403, {
          error: `key is locked to another device (${keyRecord.device_model || 'other device'}). reset device lock from the site first.`
        });
      }
      if (clientDeviceModel && clientDeviceModel !== 'Unknown Device' && clientDeviceModel !== keyRecord.device_model) {
        keyRecord.device_model = clientDeviceModel;
        keyRecord.device_os = clientDeviceOs;
        db.updateKey(key, { device_model: clientDeviceModel, device_os: clientDeviceOs });
      }
    }

    return sendJson(res, 200, {
      ok: true,
      me: {
        status: 'active',
        bound_hwid: keyRecord.bound_hwid,
        device_model: keyRecord.device_model,
        device_os: keyRecord.device_os,
        expires_at: keyRecord.expires_at,
        features: keyRecord.features && Object.keys(keyRecord.features).length > 0
          ? keyRecord.features
          : db.get().global_features
      }
    });
  }

  // Features GET and PATCH
  if (pathname === '/api/features') {
    if (req.method === 'GET') {
      return sendJson(res, 200, { features: db.get().global_features });
    }
    if (req.method === 'PATCH') {
      const body = await parseJsonBody(req);
      if (body.features) {
        db.update(data => {
          data.global_features = { ...data.global_features, ...body.features };
        });
        interceptor.setFeatures(db.get().global_features);
        if (body.key) {
          db.updateKey(body.key, { features: body.features });
        }
      }
      return sendJson(res, 200, { ok: true, features: db.get().global_features });
    }
  }

  // Tunnel Socket Statistics
  if (pathname === '/api/engine/tunnel-stats' && req.method === 'GET') {
    return sendJson(res, 200, gameTunnel.getStats());
  }


  // Subscription endpoint (for Happ / VPN clients) - returns a simple config/sub list

  // Safe node list for client (no host/port)
  if (pathname === '/api/nodes' && req.method === 'GET') {
    const nodes = (db.get().nodes || []).map(n => ({ id:n.id, name:n.name, flag:n.flag, ping:n.ping, status:n.status }));
    return sendJson(res, 200, { ok:true, nodes });
  }

  if ((pathname === '/api/subscription' || pathname === '/sub' || pathname === '/subscription') && req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const token = (url.searchParams.get('token') || '').trim();
    const tok = token ? verifySubToken(token) : null;
    const key = tok ? tok.key : (url.searchParams.get('key') || '').trim().toUpperCase();
    const nodeSel = (url.searchParams.get('node') || '').trim();
    const hwid = tok ? (tok.hwid || 'sub-device') : (url.searchParams.get('hwid') || url.searchParams.get('device_id') || ('sub-' + Buffer.from(key||'x').toString('hex').slice(0,12))).trim();
    let keyRecord = key ? db.findKey(key) : null;
    let extOk = false, extExp = null, extReason = '';
    if (key) {
      try {
        const vr = await verifyExternalKey({ key, hwid, device_model: 'sub', device_os: 'sub' });
        if (vr && vr.ok) { extOk = true; extExp = vr.data && (vr.data.expires_at || vr.data.expiry || vr.data.expires); }
        else extReason = (vr && vr.data && (vr.data.reason||vr.data.error||vr.data.message)) || (vr && vr.error) || (vr && vr.inconclusive ? 'external_inconclusive' : 'invalid');
      } catch(e) { extReason = String(e).slice(0,80); }
    }
    if (!keyRecord && extOk) {
      keyRecord = { key, status:'active', expires_at: extExp || new Date(Date.now()+365*24*3600*1000).toISOString(), data_limit_gb:64, data_used_gb:0, bound_hwid:hwid, features: db.get().global_features };
      try { db.addKey(keyRecord); } catch(e) { try { db.updateKey(key, keyRecord); } catch(_){} }
    }
    const expired = keyRecord && keyRecord.expires_at && new Date(keyRecord.expires_at).getTime() < Date.now();
    if ((!keyRecord && !extOk) || (keyRecord && keyRecord.status === 'revoked') || expired) {
      const reason = expired ? 'expired' : (keyRecord && keyRecord.status==='revoked' ? 'revoked' : extReason || 'invalid');
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end('# subscription unavailable: ' + reason);
      return;
    }
    const quotaGb = Number((keyRecord && keyRecord.data_limit_gb) || 64);
    const usedGb = Number((keyRecord && keyRecord.data_used_gb) || 0);
    if (quotaGb > 0 && usedGb >= quotaGb) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end('# subscription unavailable: data limit reached');
      return;
    }
    let nodes = (db.get().nodes || []).filter(n => n && n.status !== 'offline');
    if (nodeSel) nodes = nodes.filter(n => n.id === nodeSel || n.name === nodeSel);
    if (!nodes.length) nodes = (db.get().nodes || []).filter(n => n && n.status !== 'offline');
    // Use real protocol URIs from node.uri/link/share/raw or SUB_NODES env/config; fallback placeholder
    let lines = [];
    if (process.env.SUB_NODES) {
      lines = process.env.SUB_NODES.split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean);
    }
    if (!lines.length) {
      const tail = (key.replace(/[^A-Z0-9]/gi,'').slice(-4) || '0000').toUpperCase();
      const tagPrefix = `N_x_R:${tail}`;
      lines = nodes.map(n => {
        if (n && (n.uri || n.link || n.share || n.raw)) {
          let u = String(n.uri || n.link || n.share || n.raw).trim();
          if (u.includes('#')) u = u.replace(/#.*$/, '#' + encodeURIComponent((n.flag||'') + ' ' + (n.name||n.id||'Node') + ' ' + tagPrefix));
          else u += '#' + encodeURIComponent((n.flag||'') + ' ' + (n.name||n.id||'Node') + ' ' + tagPrefix);
          return u;
        }
        return null;
      }).filter(Boolean);
    }
    if (!lines.length) {
      const tail = (key.replace(/[^A-Z0-9]/gi,'').slice(-4) || '0000').toUpperCase();
      const tagPrefix = `N_x_R:${tail}`;
      lines = nodes.map(n => {
        const name = encodeURIComponent(`${n.flag||''} ${n.name||n.id||'Node'} ${tagPrefix}`.trim());
        const host = n.host || '127.0.0.1'; const port = n.port || 443;
        return `trojan://REPLACE_PASSWORD@${host}:${port}?security=tls&type=tcp#${name}`;
      });
    }
    const bodyText = lines.join('\n') || `# Nacer_x_Rida subscription for ${key}\n# No nodes configured`;
    const tail = (key.replace(/[^A-Z0-9]/gi,'').slice(-4) || '0000').toUpperCase();
    const profileTitle = encodeURIComponent(`N_x_R:${tail}`);
    const siteUrl = `${(req.headers['x-forwarded-proto']||'https').split(',')[0]}://${req.headers['x-forwarded-host']||req.headers.host||'may-app.onrender.com'}`;
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Profile-Update-Interval': '24',
      'Subscription-Userinfo': 'upload=0; download=0; total=68719476736; expire=4102444800',
      'Profile-Title': profileTitle,
      'Profile-Web-Page-Url': siteUrl,
      'Content-Disposition': `inline; filename="N_x_R-${tail}.txt"`
    });
    res.end(bodyText);
    return;
  }

  // Happ Tunnel Config Generation
  if (pathname === '/api/happ' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const key = body.key || 'PHTM-TEST-1234-5678';
    const keyTail = (String(key).replace(/[^A-Z0-9]/gi,'').slice(-4) || '0000').toUpperCase();
    const nodes = db.get().nodes;

    const configData = {
      version: '1.7',
      client: 'Nacer_x_Rida',
      key: key,
      created_at: new Date().toISOString(),
      nodes: nodes.map(n => ({
        id: n.id,
        name: `${n.flag} ${n.name} N_x_R:${keyTail}`,
        ping: `${n.ping||''}ms`,
        status: n.status
      })),
      active_features: db.get().global_features,
      routing: {
        rules: [{ domain_suffix: ['freefiremobile.com', 'garena.com'], outbound: 'nacerxrida-tunnel' }]
      }
    };

    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'may-app.onrender.com';
    const hwid = (body.hwid || body.device_id || 'app').toString();
    const nodeSel = (body.node || body.server || '').toString();
    const subToken = makeSubToken(key, hwid, 7*24*3600);
    const subUrl = `${proto}://${host}/api/subscription?token=${encodeURIComponent(subToken)}${nodeSel ? `&node=${encodeURIComponent(nodeSel)}` : ''}`;
    const subUrlEnc = encodeURIComponent(subUrl);
    const displayName = `N_x_R:${keyTail}`;
    return sendJson(res, 200, {
      ok: true,
      displayName,
      siteUrl: `${proto}://${host}/`,
      href: `${proto}://${host}/`,
      subscriptionUrl: subUrl,
      deepLink: `happ://add/${subUrlEnc}`,
      deepLinks: [
        `happ://add/${subUrlEnc}`,
        `happ://install-config?url=${subUrlEnc}`
      ],
      config: configData
    });
  }

  // Reset / Unbind HWID
  if ((pathname === '/api/unbind-hwid' || pathname === '/api/reset-hwid') && req.method === 'POST') {
    const body = await parseJsonBody(req);
    if (body.key) {
      db.updateKey(body.key, { bound_hwid: null, device_model: null, device_os: null });
      return sendJson(res, 200, {
        ok: true,
        message: 'Device lock removed. Next login will bind your current device.'
      });
    }
    return sendJson(res, 400, { error: 'key required' });
  }

  // Config Export Download
  if (pathname === '/api/config/export') {
    const nodes = db.get().nodes;
    const configData = {
      version: '1.7',
      client: 'Nacer_x_Rida',
      created_at: new Date().toISOString(),
      nodes: nodes,
      features: db.get().global_features
    };
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="nacerxrida-happ-config.json"'
    });
    res.end(JSON.stringify(configData, null, 2));
    return;
  }

  // Logout
  if (pathname === '/api/logout' && req.method === 'POST') {
    return sendJson(res, 200, { ok: true });
  }

  // Real-time Event Stream (SSE)
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('event: connected\ndata: {}\n\n');
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // ==========================================
  // BACKEND ADMIN API ENDPOINTS
  // ==========================================
  if (pathname === '/api/admin/overview' && req.method === 'GET') {
    const data = db.get();
    const totalKeys = data.keys.length;
    const activeKeys = data.keys.filter(k => k.status === 'active' && new Date(k.expires_at) > Date.now()).length;
    const unboundKeys = data.keys.filter(k => !k.bound_hwid).length;
    const expiredKeys = data.keys.filter(k => new Date(k.expires_at) <= Date.now()).length;
    const revokedKeys = data.keys.filter(k => k.status === 'revoked').length;
    const totalUsers = data.nodes.reduce((acc, n) => acc + (n.users || 0), 0);

    return sendJson(res, 200, {
      totalKeys,
      activeKeys,
      unboundKeys,
      expiredKeys,
      revokedKeys,
      totalUsers,
      maintenance: data.maintenance,
      nodes: data.nodes
    });
  }

  if (pathname === '/api/admin/keys' && req.method === 'GET') {
    const data = db.get();
    return sendJson(res, 200, { keys: data.keys });
  }

  if (pathname === '/api/admin/keys/generate' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const count = Math.min(Math.max(parseInt(body.count, 10) || 1, 1), 50);
    const durationDays = parseInt(body.days, 10) || 30;
    const note = body.note || 'Generated from Admin Panel';
    const prefix = (body.prefix || 'PHTM').trim().toUpperCase();

    const createdKeys = [];
    for (let i = 0; i < count; i++) {
      const newKeyStr = generateRandomKey(prefix);
      const newKeyObj = {
        key: newKeyStr,
        status: 'active',
        bound_hwid: null,
        device_model: null,
        created_at: new Date().toISOString(),
        expires_at: durationDays > 999 
          ? new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000).toISOString()
          : new Date(Date.now() + durationDays * 24 * 3600 * 1000).toISOString(),
        note: note,
        features: db.get().global_features
      };
      db.addKey(newKeyObj);
      createdKeys.push(newKeyObj);
    }

    return sendJson(res, 200, { ok: true, keys: createdKeys });
  }

  const keyActionMatch = pathname.match(/^\/api\/admin\/keys\/([^/]+)\/(unbind|toggle-status|extend)$/);
  if (keyActionMatch && req.method === 'POST') {
    const targetKey = decodeURIComponent(keyActionMatch[1]);
    const action = keyActionMatch[2];

    const keyObj = db.findKey(targetKey);
    if (!keyObj) {
      return sendJson(res, 404, { error: 'Key not found' });
    }

    if (action === 'unbind') {
      db.updateKey(targetKey, { bound_hwid: null, device_model: null });
      return sendJson(res, 200, { ok: true, message: `Unbound HWID for ${targetKey}` });
    }

    if (action === 'toggle-status') {
      const newStatus = keyObj.status === 'active' ? 'revoked' : 'active';
      db.updateKey(targetKey, { status: newStatus });
      if (newStatus === 'revoked') {
        broadcastEvent('logout', { key: targetKey });
      }
      return sendJson(res, 200, { ok: true, status: newStatus });
    }

    if (action === 'extend') {
      const body = await parseJsonBody(req);
      const addDays = parseInt(body.days, 10) || 30;
      const currentExpiry = new Date(keyObj.expires_at).getTime();
      const base = currentExpiry > Date.now() ? currentExpiry : Date.now();
      const newExpiry = new Date(base + addDays * 24 * 3600 * 1000).toISOString();
      db.updateKey(targetKey, { expires_at: newExpiry, status: 'active' });
      return sendJson(res, 200, { ok: true, expires_at: newExpiry });
    }
  }

  const deleteKeyMatch = pathname.match(/^\/api\/admin\/keys\/([^/]+)$/);
  if (deleteKeyMatch && req.method === 'DELETE') {
    const targetKey = decodeURIComponent(deleteKeyMatch[1]);
    db.deleteKey(targetKey);
    broadcastEvent('logout', { key: targetKey });
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/admin/maintenance' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const updated = db.setMaintenance({
      enabled: typeof body.enabled === 'boolean' ? body.enabled : false,
      blocked: typeof body.blocked === 'boolean' ? body.blocked : false,
      allowed_logins: Array.isArray(body.allowed_logins) 
        ? body.allowed_logins 
        : (body.allowed_logins || '').split(',').map(s => s.trim()).filter(Boolean),
      title: body.title || 'maintenance',
      message: body.message || "we're doing maintenance. everything is paused until we're back."
    });

    broadcastEvent('maintenance', updated.maintenance);
    return sendJson(res, 200, { ok: true, maintenance: updated.maintenance });
  }

  // ==========================================
  // STATIC ASSET & PAGE ROUTING
  // ==========================================
  let filePath;

  if (pathname === '/admin' || pathname === '/admin/' || pathname === '/admin/index.html') {
    filePath = path.join(ROOT_DIR, 'public', 'admin.html');
  } else if (pathname === '/admin/admin.js' || pathname === '/admin.js') {
    filePath = path.join(ROOT_DIR, 'public', 'admin.js');
  } else if (pathname === '/' || pathname === '/index.html') {
    filePath = path.join(ROOT_DIR, 'index.html');
  } else if (pathname.startsWith('/src/')) {
    filePath = path.join(ROOT_DIR, pathname);
  } else {
    const cleanPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    const pubPath = path.join(ROOT_DIR, 'public', cleanPath);
    const rootPath = path.join(ROOT_DIR, cleanPath);
    
    if (cleanPath === '' || cleanPath === 'index.html') {
      filePath = path.join(ROOT_DIR, 'index.html');
    } else if (fs.existsSync(pubPath)) {
      filePath = pubPath;
    } else if (fs.existsSync(rootPath)) {
      filePath = rootPath;
    } else {
      filePath = path.join(ROOT_DIR, 'index.html');
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n==============================================`);
  console.log(`🚀 Nacer_x_Rida Core System running on:`);
  console.log(`👉 Client Portal: http://localhost:${PORT}/`);
  console.log(`👉 Admin Panel:   http://localhost:${PORT}/admin`);
  console.log(`==============================================\n`);
});
