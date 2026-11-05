'use strict';

/* ------------------------------------------------------------------ *
 * Nacer_X_Rida — الصفحة الرئيسية
 * تحمي الصفحة وتتأكد من وجود جلسة تحقق صالحة قبل العرض.
 * ------------------------------------------------------------------ */

const SESSION_KEY = 'nxr_session';

const els = {
  key: document.getElementById('card-key'),
  expiry: document.getElementById('card-expiry'),
  expiryHint: document.getElementById('card-expiry-hint'),
  device: document.getElementById('card-device'),
  session: document.getElementById('card-session'),
  logout: document.getElementById('logout-button'),
  year: document.getElementById('year'),
};

if (els.year) els.year.textContent = String(new Date().getFullYear());

/* ------------------------- جلسة ------------------------- */

function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

function isExpired(session) {
  if (!session.expires_at) return false;
  const date = new Date(session.expires_at);
  if (Number.isNaN(date.getTime())) return false;
  if (date.getFullYear() >= 9000) return false; // صلاحية دائمة
  return date.getTime() <= Date.now();
}

/* ------------------------- عرض البيانات ------------------------- */

function maskKey(value) {
  if (!value) return '—';
  const clean = String(value).trim();
  if (clean.length <= 10) return clean;
  return clean.slice(0, 6) + '••••' + clean.slice(-4);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  if (date.getFullYear() >= 9000) return 'صلاحية دائمة';
  return date.toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' }) +
    ' — ' + date.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
}

function daysLeft(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() >= 9000) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function render(session) {
  if (els.key) els.key.textContent = maskKey(session.key);
  if (els.device) els.device.textContent = session.device_id || '—';

  if (els.expiry) {
    els.expiry.textContent = formatDate(session.expires_at);
    const left = daysLeft(session.expires_at);
    if (left === null) {
      els.expiry.classList.add('ok');
    } else if (left <= 0) {
      els.expiry.classList.add('warn');
    } else if (left <= 7) {
      els.expiry.classList.add('warn');
    } else {
      els.expiry.classList.add('ok');
    }
    if (els.expiryHint) {
      if (left === null) els.expiryHint.textContent = 'هذا المفتاح صالح بدون تاريخ انتهاء.';
      else if (left <= 0) els.expiryHint.textContent = 'انتهت الصلاحية — أعد التحقق من البوابة.';
      else els.expiryHint.textContent = 'متبقٍ ' + left + ' يومًا على انتهاء الصلاحية.';
    }
  }

  if (els.session) {
    els.session.textContent = formatDate(session.started_at || new Date().toISOString());
  }
}

/* ------------------------- الحماية ------------------------- */

const session = readSession();

if (!session) {
  // لا توجد جلسة — أعد المستخدم إلى بوابة الدخول
  window.location.replace('index.html');
} else if (isExpired(session)) {
  clearSession();
  window.location.replace('index.html?expired=1');
} else {
  render(session);
}

/* ------------------------- تسجيل الخروج ------------------------- */

if (els.logout) {
  els.logout.addEventListener('click', () => {
    clearSession();
    window.location.replace('index.html');
  });
}
