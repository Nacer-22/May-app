import { CONFIG } from './config.js';
import { TRANSLATIONS } from './translations.js';
import { Icons } from './icons.js';

const state = {
  lang: localStorage.getItem('nxr_lang') || 'en',
  tab: 'status',
  isConnected: localStorage.getItem('nxr_vpn_connected') === 'true',
  auth: {
    loggedIn: false,
    key: '',
    me: {
      status: 'active',
      bound_hwid: null,
      device_model: null,
      device_os: null,
      expires_at: null,
      features: JSON.parse(JSON.stringify(CONFIG.DEFAULT_FEATURES))
    }
  }
};

const savedSession = localStorage.getItem('nxr_session');
if (savedSession) {
  try {
    const parsed = JSON.parse(savedSession);
    if (parsed.key) {
      state.auth.loggedIn = true;
      state.auth.key = parsed.key;
      if (parsed.me) state.auth.me = { ...state.auth.me, ...parsed.me };
      if (parsed.features) state.auth.me.features = { ...state.auth.me.features, ...parsed.features };
    }
  } catch (e) {}
}

async function resolveHappSubscriptionUrl(key) {
  const direct = String(CONFIG.HAPP_SUB_URL || '').trim();
  if (direct) return direct;

  const tpl = String(CONFIG.HAPP_SUB_URL_TEMPLATE || '').trim();
  if (tpl && key) return tpl.replace(/\{key\}/g, encodeURIComponent(key));

  if (CONFIG.SERVER_SYNC) {
    try {
      const base = String(CONFIG.API_BASE || '');
      const res = await fetch(base + '/api/happ', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      if (res.ok) {
        const data = await res.json();
        const candidate = data.sub_url || data.subscription_url || data.subUrl || '';
        if (candidate) return String(candidate).trim();
        const dl = String(data.deepLink || '');
        if (dl.startsWith('happ://add/')) return dl.slice('happ://add/'.length);
      }
    } catch (e) {}
  }
  return '';
}

function formatCountdown(targetIso) {
  if (!targetIso) return '29D 23H';
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return 'EXPIRED';
  const sec = Math.floor(diff / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (days > 0) return `${days}D ${hours}H`;
  if (hours > 0) return `${hours}H ${mins}M`;
  return `${mins}M`;
}

function renderDashboard() {
  const root = document.getElementById('app');
  if (!root) return;

  const isRtl = state.lang === 'ar';
  document.documentElement.setAttribute('lang', state.lang);
  document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
  document.title = 'Nacer_X_Rida — Client Portal';

  const statusColor = state.isConnected ? '#22c55e' : '#71717a';
  const statusText = state.isConnected ? 'ONLINE' : 'OFFLINE';

  root.innerHTML = `
    <div style="background-color: #050505; color: #cacaca; min-height: 100vh; width: 100%; display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 20px 16px 110px 16px; box-sizing: border-box; font-family: 'JetBrains Mono', monospace, sans-serif;">
      
      <!-- الشريط العلوي للحالة -->
      <div style="width: 100%; max-width: 400px; display: flex; justify-content: space-between; align-items: center; padding: 10px 4px;">
        <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 800; letter-spacing: 2px; color: ${statusColor};">
          <span style="height: 8px; width: 8px; background-color: ${statusColor}; box-shadow: 0 0 8px ${statusColor};"></span>
          ${statusText}
        </div>
        
        <button id="lang-toggle-icon" style="background: #0c0c0e; border: 1px solid #1a1a1e; border-radius: 4px; padding: 6px 12px; color: #cccccc; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 11px; font-weight: 700;">
          ${state.lang.toUpperCase()}
        </button>
      </div>

      <!-- محتوى التبويبات -->
      <div style="width: 100%; max-width: 400px; margin: auto 0; display: flex; flex-direction: column; align-items: center;">
        ${state.tab === 'status' ? renderStatusTab(state.auth.me) : ''}
        ${state.tab === 'features' ? renderFeaturesTab(state.auth.me) : ''}
        ${state.tab === 'manage' ? renderManageTab() : ''}
      </div>

      <!-- شريط التنقل السفلي -->
      ${renderBottomNav()}
    </div>
  `;
  attachDashboardEvents();
}

function renderStatusTab(me) {
  const expiresText = formatCountdown(me.expires_at);

  return `
    <div style="width: 100%; display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center;">
      <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #71717a; padding: 0 4px; letter-spacing: 1px;">
        <span>HOME</span>
        <span>LAST REFRESHED JUST NOW</span>
      </div>

      <!-- الدائرة الوسطى -->
      <div style="position: relative; width: 100%; height: 240px; display: flex; align-items: center; justify-content: center; border: 1px dashed #1a1a1e; border-radius: 20px; background: #0c0c0e; margin: 10px 0;">
        <div style="display: flex; flex-direction: column; align-items: center;">
          <img src="logo.png" alt="Nacer_X_Rida" style="max-width: 70px; width: 100%; height: auto; object-fit: contain; margin-bottom: 12px; filter: drop-shadow(0 0 12px rgba(229, 9, 20, 0.4));" onerror="this.onerror=null; this.style.display='none';" />
          <div style="font-family: 'Anton', sans-serif; font-size: 40px; letter-spacing: 2px; color: #ffffff;">${expiresText}</div>
          <div style="font-size: 9px; color: #71717a; letter-spacing: 3px; margin-top: 4px;">TIME LEFT</div>
        </div>
      </div>

      <!-- خانة المفتاح -->
      <div style="width: 100%; background: #0c0c0e; border: 1px solid #1a1a1e; border-radius: 14px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; box-sizing: border-box;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 10px; color: #71717a;">KEY</span>
          <span style="font-size: 12.5px; font-weight: 700; letter-spacing: 1px; color: #ffffff;">${state.auth.key || 'Nacer-XXXX-XXXX-XXXX'}</span>
        </div>
        <button id="copy-key-btn" style="background: #18181c; border: none; border-radius: 8px; color: #ffffff; padding: 8px 12px; font-size: 10px; font-weight: 700; cursor: pointer;">COPY</button>
      </div>

      <!-- زر أضف اشتراك (Add Subscription) -->
      <div style="width: 100%;">
        <button id="happ-btn" style="width: 100%; background: #e50914; color: #ffffff; border: none; border-radius: 14px; padding: 16px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; box-shadow: 0 8px 24px rgba(229, 9, 20, 0.3);">
          <div style="text-align: left;">
            <div style="font-family: 'Anton', sans-serif; font-size: 20px; letter-spacing: 1px;">ADD SUBSCRIPTION</div>
            <div style="font-size: 10.5px; color: #fca5a5; font-family: 'Inter', sans-serif; font-weight: 600;">opens your vpn app with your key ready</div>
          </div>
          <div style="background: #b91c1c; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 8px; font-size: 18px; font-weight: bold; color: #fff;">+</div>
        </button>
      </div>
    </div>
  `;
}

function renderFeaturesTab(me) {
  const f = me.features || {};
  
  // التأكد من أن POWER هو الخيار الافتراضي دائماً
  if (!f.marker) {
    f.marker = { enabled: true, type: 'POWER' };
  } else if (!f.marker.type || f.marker.type === 'PHANTOM') {
    f.marker.type = 'POWER';
  }

  const marker = f.marker;
  const aimpoint = f.aimpoint || { enabled: false };
  const aimLag = f.aimLag || { enabled: false };

  // إزالة PHANTOM من القائمة
  const markerTypes = ['POWER', 'DREAM', 'ICE WALL', 'MOCO', 'CLU', 'SHIROU', 'IRIS'];

  return `
    <div style="width: 100%; display: flex; flex-direction: column; gap: 12px; text-align: left; max-height: 70vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span style="font-family: 'Anton', sans-serif; font-size: 32px; letter-spacing: 1px; color: #ffffff;">FEATURES</span>
        <span style="font-family: 'Anton', sans-serif; font-size: 20px; color: #e50914;">3/3</span>
      </div>
      <p style="font-size: 11.5px; color: #71717a; margin-bottom: 10px;">changes apply from your next match</p>

      <!-- ميزة Marker -->
      <div style="background: #0c0c0e; border: 1px solid #1a1a1e; border-radius: 16px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 12px; color: #71717a; font-weight: bold;">01</span>
            <span style="font-family: 'Anton', sans-serif; font-size: 22px; letter-spacing: 1px; color: #ffffff;">MARKER</span>
            <span style="background: rgba(229,9,20,0.2); color: #e50914; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">RISK</span>
          </div>
          <button type="button" data-toggle="marker" style="width: 44px; height: 24px; border-radius: 12px; background: ${marker.enabled ? '#e50914' : '#1a1a1e'}; border: none; position: relative; cursor: pointer;">
            <span style="width: 18px; height: 18px; border-radius: 50%; background: #ffffff; position: absolute; top: 3px; ${marker.enabled ? 'right: 3px;' : 'left: 3px;'}"></span>
          </button>
        </div>
        <p style="font-size: 11px; color: #71717a; margin-bottom: 12px;">marks every enemy on your screen.</p>
        
        <div style="font-size: 10px; color: #52525b; letter-spacing: 1px; margin-bottom: 8px; font-weight: bold;">MARK STYLE</div>
        
        <!-- شبكة الأشكال مع التأثير الشفاف عند الإيقاف -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; position: relative; transition: all 0.3s ease; ${!marker.enabled ? 'opacity: 0.35; pointer-events: none; filter: grayscale(1);' : ''}">
          ${markerTypes.map(type => `
            <button data-marker-type="${type}" style="border: 1px solid #1a1a1e; border-radius: 8px; padding: 8px 4px; font-size: 10px; font-weight: bold; cursor: pointer; background: ${marker.type === type ? '#e50914' : '#141418'}; color: ${marker.type === type ? '#ffffff' : '#71717a'}; transition: all 0.2s;">${type}</button>
          `).join('')}
        </div>
      </div>

      <!-- ميزة Aimpoint -->
      <div style="background: #0c0c0e; border: 1px solid #1a1a1e; border-radius: 16px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 12px; color: #71717a; font-weight: bold;">02</span>
            <span style="font-family: 'Anton', sans-serif; font-size: 22px; letter-spacing: 1px; color: #ffffff;">AIMPOINT</span>
            <span style="background: #222226; color: #ffffff; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">NEW</span>
          </div>
          <button type="button" data-toggle="aimpoint" style="width: 44px; height: 24px; border-radius: 12px; background: ${aimpoint.enabled ? '#e50914' : '#1a1a1e'}; border: none; position: relative; cursor: pointer;">
            <span style="width: 18px; height: 18px; border-radius: 50%; background: #ffffff; position: absolute; top: 3px; ${aimpoint.enabled ? 'right: 3px;' : 'left: 3px;'}"></span>
          </button>
        </div>
        <p style="font-size: 11px; color: #71717a;">moves your aim from the chest to the neck, so body shots land as headshots.</p>
      </div>

      <!-- ميزة Aim Lag -->
      <div style="background: #0c0c0e; border: 1px solid #1a1a1e; border-radius: 16px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 12px; color: #71717a; font-weight: bold;">03</span>
            <span style="font-family: 'Anton', sans-serif; font-size: 22px; letter-spacing: 1px; color: #ffffff;">AIM LAG</span>
          </div>
          <button type="button" data-toggle="aimLag" style="width: 44px; height: 24px; border-radius: 12px; background: ${aimLag.enabled ? '#e50914' : '#1a1a1e'}; border: none; position: relative; cursor: pointer;">
            <span style="width: 18px; height: 18px; border-radius: 50%; background: #ffffff; position: absolute; top: 3px; ${aimLag.enabled ? 'right: 3px;' : 'left: 3px;'}"></span>
          </button>
        </div>
        <p style="font-size: 11px; color: #71717a;">freezes the enemy for a moment while you fire or scope, so they're easier to hit.</p>
      </div>
    </div>
  `;
}

function renderManageTab() {
  const discordUrl = CONFIG.SOCIAL_DISCORD_URL || 'https://discord.gg/Km6Hsxk7Y4';
  const googlePlayUrl = CONFIG.HAPP_ANDROID_URL || 'https://play.google.com/store/apps/details?id=com.happ.proxy';
  const appStoreUrl = CONFIG.HAPP_IOS_URL || 'https://apps.apple.com/app/happ-proxy-utility/id6504287215';

  return `
    <div style="width: 100%; display: flex; flex-direction: column; gap: 14px; text-align: left; max-height: 70vh; overflow-y: auto;">
      <h1 style="font-family: 'Anton', sans-serif; font-size: 32px; letter-spacing: 1px; color: #ffffff; margin-bottom: 4px;">MANAGE</h1>
      
      <!-- Device Lock Card -->
      <div style="background: #0c0c0e; border: 1px solid #1a1a1e; border-radius: 16px; padding: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <span style="font-size: 10px; color: #71717a; letter-spacing: 1px;">THIS DEVICE</span>
          <span style="background: #222226; color: #ffffff; font-size: 9px; font-weight: 700; padding: 4px 8px; border-radius: 4px;">LOCKED TO THIS KEY</span>
        </div>
        <div style="font-family: 'Anton', sans-serif; font-size: 32px; color: #ffffff; margin-bottom: 2px;">Nacer_X_Rida</div>
        <div style="font-size: 12px; color: #71717a; margin-bottom: 8px;">Android Device</div>
        <div style="font-size: 10.5px; color: #3f3f46; word-break: break-all; margin-bottom: 16px;">HWID: ${(state.auth.me && state.auth.me.bound_hwid) || state.hwid || 'Nacer-DEV-ACTIVE'}</div>

        <button id="unbind-hwid-btn" style="width: 100%; background: #141418; border: 1px solid #222228; color: #71717a; padding: 14px; font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; letter-spacing: 1px; cursor: pointer; border-radius: 10px;">
          RESET DEVICE LOCK (UNBIND)
        </button>
      </div>

      <!-- Links & Community -->
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <a href="${discordUrl}" target="_blank" style="background: #0c0c0e; border: 1px solid #1a1a1e; border-radius: 14px; padding: 14px 16px; color: #5865F2; font-size: 11.5px; font-weight: 700; text-decoration: none; display: flex; justify-content: space-between; align-items: center;">
          <span>Discord Community</span>
          <span>↗</span>
        </a>
        <a href="${googlePlayUrl}" target="_blank" style="background: #0c0c0e; border: 1px solid #1a1a1e; border-radius: 14px; padding: 14px 16px; color: #22c55e; font-size: 11.5px; font-weight: 700; text-decoration: none; display: flex; justify-content: space-between; align-items: center;">
          <span>Happ VPN (Google Play)</span>
          <span>↗</span>
        </a>
        <a href="${appStoreUrl}" target="_blank" style="background: #0c0c0e; border: 1px solid #1a1a1e; border-radius: 14px; padding: 14px 16px; color: #ffffff; font-size: 11.5px; font-weight: 700; text-decoration: none; display: flex; justify-content: space-between; align-items: center;">
          <span>Happ VPN (App Store)</span>
          <span>↗</span>
        </a>
      </div>
      
      <!-- Logout Button -->
      <div style="margin-top: 6px;">
        <button id="logout-btn" style="width: 100%; background: transparent; border: 1px solid #e50914; color: #e50914; padding: 14px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 800; cursor: pointer; border-radius: 12px;">
          LOG OUT SESSION
        </button>
      </div>
    </div>
  `;
}

function renderBottomNav() {
  const tabs = [
    { id: 'status', label: 'HOME', icon: Icons.skull(18) },
    { id: 'features', label: 'FEATURES', icon: Icons.slidersHorizontal(18) },
    { id: 'manage', label: 'MANAGE', icon: Icons.settings(18) }
  ];

  return `
    <div style="position: fixed; bottom: 16px; left: 0; right: 0; display: flex; justify-content: center; z-index: 50; pointer-events: none;">
      <div style="pointer-events: auto; background: rgba(12, 12, 14, 0.95); border: 1px solid #1a1a1e; border-radius: 20px; padding: 6px; display: flex; gap: 6px; backdrop-filter: blur(12px); box-shadow: 0 10px 30px rgba(0,0,0,0.8);">
        ${tabs.map(item => `
          <button data-nav-tab="${item.id}" style="width: 86px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border-radius: 14px; padding: 8px 0; border: none; background: ${state.tab === item.id ? '#e50914' : 'transparent'}; color: ${state.tab === item.id ? '#ffffff' : '#71717a'}; cursor: pointer; transition: 0.2s;">
            ${item.icon}
            <span style="font-size: 9px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">${item.label}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function attachDashboardEvents() {
  const langBtn = document.getElementById('lang-toggle-icon');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      state.lang = state.lang === 'en' ? 'ar' : 'en';
      localStorage.setItem('nxr_lang', state.lang);
      renderDashboard();
    });
  }

  const copyBtn = document.getElementById('copy-key-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(state.auth.key);
      alert('KEY COPIED TO CLIPBOARD');
    });
  }

  const happBtn = document.getElementById('happ-btn');
  if (happBtn) {
    happBtn.addEventListener('click', async () => {
      const key = (state.auth && state.auth.key) || '';
      const ua = navigator.userAgent || '';
      const isAndroid = /Android/i.test(ua);
      const isIOS = /iPhone|iPad|iPod/i.test(ua);

      if (key && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(key).catch(() => {});
      }

      const subUrl = await resolveHappSubscriptionUrl(key);
      const deepLink = subUrl ? ('happ://add/' + subUrl) : 'happ://';

      let appOpened = false;
      const markOpened = () => { appOpened = true; };
      document.addEventListener('visibilitychange', markOpened, { once: true });
      window.addEventListener('blur', markOpened, { once: true });
      window.addEventListener('pagehide', markOpened, { once: true });

      try { window.location.href = deepLink; } catch (e) {}

      setTimeout(() => {
        if (appOpened || document.hidden) return;
        if (isAndroid) {
          window.location.href = CONFIG.HAPP_ANDROID_URL || 'https://play.google.com/store/apps/details?id=com.happ.proxy';
        } else if (isIOS) {
          window.location.href = CONFIG.HAPP_IOS_URL || 'https://apps.apple.com/app/happ-proxy-utility/id6504287215';
        } else {
          alert('Happ VPN is a mobile app.\n\n' +
            (subUrl ? 'Your subscription link:\n' + subUrl + '\n\n'
                    : 'Your key was copied automatically:\n' + key + '\n\n') +
            'Open Happ on your phone and add the subscription.');
        }
      }, 1600);

      state.isConnected = true;
      localStorage.setItem('nxr_vpn_connected', 'true');
      renderDashboard();
    });
  }

  document.querySelectorAll('[data-nav-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.tab = btn.getAttribute('data-nav-tab');
      renderDashboard();
    });
  });

  document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.getAttribute('data-toggle');
      if (!state.auth.me.features) state.auth.me.features = {};
      const f = state.auth.me.features;
      
      if (field === 'marker') f.marker = { ...f.marker, enabled: !f.marker?.enabled };
      else if (field === 'aimpoint') f.aimpoint = { ...f.aimpoint, enabled: !f.aimpoint?.enabled };
      else if (field === 'aimLag') f.aimLag = { ...f.aimLag, enabled: !f.aimLag?.enabled };
      
      renderDashboard();
      saveFeatures(f);
    });
  });

  document.querySelectorAll('[data-marker-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!state.auth.me.features) state.auth.me.features = {};
      if (!state.auth.me.features.marker) state.auth.me.features.marker = {};
      state.auth.me.features.marker.type = btn.getAttribute('data-marker-type');
      renderDashboard();
      saveFeatures(state.auth.me.features);
    });
  });

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
}

async function saveFeatures(f) {
  localStorage.setItem('nxr_session', JSON.stringify({ key: state.auth.key, me: state.auth.me, features: f }));
  try {
    await fetch('/api/features', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ features: f, key: state.auth.key }) });
  } catch (e) {}
}

function logout() {
  localStorage.removeItem('nxr_session');
  localStorage.removeItem('nxr_vpn_connected');
  state.auth.loggedIn = false;
  state.isConnected = false;
  state.auth.key = '';
  location.reload();
}

const REASON_MESSAGES = {
  code_not_found: 'This key is not in the verification server database. Copy it again from your dashboard. If it is visible there but still rejected here, the dashboard and verification service are not reading the same database.',
  not_found: 'This key was not found. Check it and try again.',
  missing_params: 'The key request was incomplete. Refresh the page and try again.',
  invalid_format: 'The key format is invalid. Use Nacer-XXXX-XXXX-XXXX with 12 hexadecimal characters.',
  code_disabled: 'This key has been disabled by the administrator.',
  banned: 'This key has been disabled.',
  code_expired: 'This key has expired.',
  expired: 'This key activation has expired.',
  max_devices_reached: 'This key has reached its device limit. Ask the administrator to reset its device lock.',
  hwid_mismatch: 'This key is locked to another device.',
  device_mismatch: 'This key is locked to another device.',
  too_many_requests: 'Too many attempts. Please wait a moment and try again.',
  invalid: 'Key was not accepted.'
};

async function authenticate(key, dev) {
  const endpoint = String(CONFIG.AUTH_API_URL || '').trim();
  if (!endpoint) throw new Error('The verification server URL is not configured.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(CONFIG.AUTH_TIMEOUT) || 75000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({ code: key, device_id: dev.hwid }),
      signal: controller.signal
    });

    const raw = await res.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (_) {
      throw new Error('The verification server returned an invalid response. Try again later.');
    }

    if (!res.ok || data.valid !== true) {
      const reason = String(data.reason || '').toLowerCase();
      const message = data.message || data.error || REASON_MESSAGES[reason]
        || (res.status === 429 ? REASON_MESSAGES.too_many_requests
          : res.status >= 500 ? 'The verification server is temporarily unavailable.'
          : 'Key was not accepted.');
      throw new Error(message);
    }

    return data.me || {
      status: 'active',
      bound_hwid: dev.hwid,
      device_model: dev.device_model,
      device_os: dev.device_os,
      expires_at: data.expires_at || null,
      features: JSON.parse(JSON.stringify(CONFIG.DEFAULT_FEATURES))
    };
  } finally {
    clearTimeout(timer);
  }
}

function setAuthStatus(message, isError = true) {
  const status = document.getElementById('auth-status');
  if (!status) {
    if (message) alert(message);
    return;
  }
  status.textContent = message || '';
  status.style.display = message ? 'block' : 'none';
  status.style.color = isError ? '#ff626b' : '#22c55e';
}

document.addEventListener('DOMContentLoaded', () => {
  const keyInput = document.getElementById('access-key-input');
  const unlockBtn = document.getElementById('unlock-btn');

  if (keyInput) {
    keyInput.addEventListener('input', () => {
      keyInput.value = formatKey(keyInput.value);
      setAuthStatus('');
    });
    keyInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && unlockBtn && !unlockBtn.disabled) {
        event.preventDefault();
        unlockBtn.click();
      }
    });
  }

  if (unlockBtn) {
    unlockBtn.addEventListener('click', async () => {
      const val = normalizeAccessKey(keyInput ? keyInput.value : '');
      if (!val) {
        setAuthStatus('Enter a complete key in the format Nacer-XXXX-XXXX-XXXX.');
        if (keyInput) keyInput.focus();
        return;
      }

      if (keyInput) keyInput.value = val;
      setAuthStatus('');
      const originalText = unlockBtn.textContent;
      unlockBtn.textContent = 'VERIFYING...';
      unlockBtn.disabled = true;

      try {
        const dev = await getRealClientDevice();
        const me = await authenticate(val, dev);

        state.auth.loggedIn = true;
        state.auth.key = val;
        state.auth.me = { ...state.auth.me, ...me };
        localStorage.setItem('nxr_session', JSON.stringify({ key: val, me: state.auth.me }));
        renderDashboard();
      } catch (err) {
        const message = err && err.name === 'AbortError'
          ? 'The verification server did not respond in time. Try again.'
          : (err && err.message) || 'Could not verify this key. Check your connection and try again.';
        setAuthStatus(message);
      } finally {
        if (document.body.contains(unlockBtn)) {
          unlockBtn.textContent = originalText;
          unlockBtn.disabled = false;
        }
      }
    });
  }

  if (state.auth.loggedIn) {
    renderDashboard();
  }
});

function formatKey(value) {
  const raw = String(value || '').normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();

  if (!raw) return '';
  if (raw.length <= 5 && 'NACER'.startsWith(raw)) {
    return raw === 'NACER' ? 'Nacer' : raw;
  }

  if (raw.startsWith('NACER')) {
    const suffix = raw.slice(5, 17);
    const groups = suffix.match(/.{1,4}/g) || [];
    return 'Nacer' + (groups.length ? '-' + groups.join('-') : '');
  }

  return raw.slice(0, 17);
}

function normalizeAccessKey(value) {
  const raw = String(value || '').normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();

  if (!raw.startsWith('NACER') || raw.length !== 17) return '';
  const suffix = raw.slice(5);
  if (!/^[A-F0-9]{12}$/.test(suffix)) return '';
  return 'Nacer-' + suffix.slice(0, 4) + '-' + suffix.slice(4, 8) + '-' + suffix.slice(8, 12);
}

async function getRealClientDevice() {
  // Match the original activation page's device ID contract exactly.
  const KEY = 'nacer_device_id';
  const VALID = /^DEV-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let hwid = localStorage.getItem(KEY);

  if (!hwid || !VALID.test(hwid)) {
    if (window.crypto && typeof crypto.randomUUID === 'function') {
      hwid = 'DEV-' + crypto.randomUUID();
    } else {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      const hex = Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');
      hwid = 'DEV-' + hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' +
        hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20, 32);
    }
    localStorage.setItem(KEY, hwid);
  }

  state.hwid = hwid;
  const ua = navigator.userAgent || '';
  let os = 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  return { hwid, device_model: os + ' Device', device_os: os };
}
