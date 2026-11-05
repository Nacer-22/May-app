'use strict';

/* ------------------------------------------------------------------ *
 * Nacer_X_Rida — بوابة التحقق
 * تتصل بخادم المفاتيح وتتحقق من صلاحية المفتاح على الجهاز الحالي.
 * ------------------------------------------------------------------ */

const form = document.getElementById('login-form');
const keyInput = document.getElementById('access-key');
const submitButton = document.getElementById('submit-button');
const pasteButton = document.getElementById('paste-button');
const statusNode = document.getElementById('login-status');
const buttonLabel = submitButton.querySelector('.button-label');

const CONFIG = window.NXR_CONFIG || {};
const ENDPOINT = CONFIG.endpoint || '/api/login';
const CONTRACT = CONFIG.contract || 'portal';
const TIMEOUT_MS = Number(CONFIG.timeoutMs) || 75000;

const DEFAULT_LABEL = buttonLabel ? buttonLabel.textContent : 'تحقق من المفتاح';

document.getElementById('year').textContent = String(new Date().getFullYear());

/* ------------------------------------------------------------------ *
 * بصمة الجهاز — معرّف ثابت لكل متصفح، لا يحتوي أي بيانات شخصية
 * ------------------------------------------------------------------ */

function getDeviceId() {
  const STORAGE_KEY = 'nxr_device_id';
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const seed = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
    ].join('|');

    // FNV-1a 32-bit — توقيع قصير ثابت
    let hash = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }

    const id = 'web-' + hash.toString(16).padStart(8, '0');
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return 'web-anonymous';
  }
}

/* ------------------------------------------------------------------ *
 * رسائل الخادم
 * ------------------------------------------------------------------ */

const REASON_MESSAGES = {
  missing_params: 'بيانات الطلب غير مكتملة.',
  invalid_code: 'صيغة المفتاح غير صحيحة.',
  code_not_found: 'المفتاح غير موجود. تأكد من كتابته بشكل صحيح.',
  code_disabled: 'تم تعطيل هذا المفتاح.',
  code_expired: 'انتهت صلاحية هذا المفتاح.',
  expired: 'انتهت مدة التفعيل على هذا الجهاز.',
  max_devices_reached: 'هذا المفتاح مستخدم على الحد الأقصى من الأجهزة.',
  too_many_requests: 'محاولات كثيرة. انتظر بضع دقائق ثم أعد المحاولة.',
};

function setStatus(message, state = '') {
  statusNode.textContent = message;
  if (state) statusNode.dataset.state = state;
  else delete statusNode.dataset.state;
}

function setBusy(busy, label) {
  submitButton.disabled = busy;
  if (buttonLabel) buttonLabel.textContent = busy ? label : DEFAULT_LABEL;
}

function formatExpiry(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (date.getFullYear() >= 9000) return ' صلاحية دائمة.';
  return ' ينتهي في ' + date.toLocaleDateString('ar', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) + '.';
}

/* ------------------------------------------------------------------ *
 * زر اللصق
 * ------------------------------------------------------------------ */

pasteButton.addEventListener('click', async () => {
  try {
    const value = await navigator.clipboard.readText();
    if (value) {
      keyInput.value = value.trim();
      keyInput.focus();
      setStatus('تم لصق المفتاح. اضغط تحقق للمتابعة.');
    }
  } catch {
    setStatus('تعذر الوصول إلى الحافظة. الصق المفتاح يدويًا.', 'error');
  }
});

/* ------------------------------------------------------------------ *
 * إرسال طلب التحقق
 * ------------------------------------------------------------------ */

async function sendVerification(key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const payload =
    CONTRACT === 'verify'
      ? { code: key, device_id: getDeviceId() }
      : { key, device_id: getDeviceId() };

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    return { response, data };
  } finally {
    clearTimeout(timer);
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();

  const key = keyInput.value.trim();

  if (!key) {
    setStatus('أدخل مفتاح الوصول أولًا.', 'error');
    keyInput.focus();
    return;
  }

  setBusy(true, 'جارٍ التحقق...');
  setStatus('يتم الاتصال بخادم التحقق...');

  // الخادم قد يكون في وضع السكون (Render) — نطمئن المستخدم بعد 6 ثوانٍ
  const slowTimer = setTimeout(() => {
    setStatus('الخادم يستيقظ من وضع السكون، قد يستغرق حتى دقيقة...');
  }, 6000);

  try {
    const { response, data } = await sendVerification(key);
    clearTimeout(slowTimer);

    const accepted =
      CONTRACT === 'verify'
        ? data.valid === true || data.ok === true
        : data.ok === true || data.valid === true;

    if (!accepted) {
      const reason = data.reason || '';
      const message =
        data.message ||
        REASON_MESSAGES[reason] ||
        (response.status === 429
          ? REASON_MESSAGES.too_many_requests
          : 'لم يتم قبول المفتاح.');
      throw new Error(message);
    }

    const expiry = formatExpiry(data.expires_at);
    setStatus('تم التحقق من المفتاح بنجاح.' + expiry, 'success');
    keyInput.value = '';
    keyInput.blur();
  } catch (error) {
    clearTimeout(slowTimer);

    if (error.name === 'AbortError') {
      setStatus('انتهت مهلة الاتصال بالخادم. حاول مرة أخرى.', 'error');
    } else if (error instanceof TypeError) {
      setStatus('تعذر الاتصال بخادم التحقق. تحقق من اتصالك بالإنترنت.', 'error');
    } else {
      setStatus(error.message || 'تعذر إكمال عملية التحقق.', 'error');
    }
  } finally {
    setBusy(false);
  }
});
