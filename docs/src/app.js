import { CONFIG } from './config.js';

const els = {
  input: () => document.getElementById('access-key-input'),
  unlock: () => document.getElementById('unlock-btn'),
  status: () => document.getElementById('status'),
  statusTitle: () => document.getElementById('status-title'),
  statusText: () => document.getElementById('status-text')
};

function formatKey(value) {
  return (value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16).match(/.{1,4}/g) || []).join('-');
}

function setStatus(title, message, visible = true) {
  const box = els.status();
  if (!box) return;
  els.statusTitle().textContent = title;
  els.statusText().textContent = message;
  box.classList.toggle('show', visible);
}

function getClientDevice() {
  let hwid = localStorage.getItem('powerup_hwid');
  if (!hwid) {
    hwid = `PWUP-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    localStorage.setItem('powerup_hwid', hwid);
  }
  return {
    hwid,
    device_model: 'Android Device',
    device_os: 'Android'
  };
}

function saveSession(key, me) {
  localStorage.setItem('powerup_session', JSON.stringify({ key, me }));
}

const REASONS = {
  missing_params: 'Incomplete request.',
  invalid_code: 'That key format is not valid.',
  code_not_found: 'Key not found. Check it and try again.',
  code_disabled: 'This key has been disabled.',
  code_expired: 'This key has expired.',
  expired: 'Your activation on this device has expired.',
  max_devices_reached: 'This key is already used on the maximum number of devices.',
  too_many_requests: 'Too many attempts. Wait a few minutes and try again.'
};

async function authenticate() {
  const input = els.input();
  const button = els.unlock();
  const key = input?.value.trim() || '';

  if (!key) {
    setStatus('ACCESS DENIED', 'Enter your access key.', true);
    return;
  }

  button.disabled = true;
  button.textContent = 'CHECKING...';
  setStatus('CONNECTING', 'Contacting the access server...', true);

  try {
    const device = getClientDevice();
    const response = await fetch(CONFIG.AUTH_API_URL, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        code: key,
        device_id: device.hwid,
        key,
        hwid: device.hwid,
        device_model: device.device_model,
        device_os: device.device_os
      })
    });

    const data = await response.json().catch(() => ({}));
    const accepted = data.valid === true || data.ok === true;
    if (!accepted) {
      throw new Error(data.message || data.error || REASONS[data.reason] || `Authentication failed (${response.status})`);
    }

    const me = data.me || { expires_at: data.expires_at || null, bound_hwid: device.hwid };
    saveSession(key, me);
    setStatus('ACCESS GRANTED', me.expires_at ? `Active until ${new Date(me.expires_at).toLocaleString()}` : 'Authentication successful.', true);
    button.textContent = 'AUTHENTICATED';
  } catch (error) {
    setStatus('ACCESS FAILED', error.message === 'Failed to fetch' ? 'Unable to reach the access server.' : error.message, true);
    button.disabled = false;
    button.textContent = 'UNLOCK';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const input = els.input();
  const button = els.unlock();
  const paste = document.getElementById('paste-btn');

  input?.addEventListener('input', event => {
    event.target.value = formatKey(event.target.value);
  });
  button?.addEventListener('click', authenticate);
  input?.addEventListener('keydown', event => {
    if (event.key === 'Enter') authenticate();
  });
  paste?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) input.value = formatKey(text);
    } catch {
      setStatus('CLIPBOARD', 'Clipboard permission was not granted.', true);
    }
  });
});
