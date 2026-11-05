'use strict';

const form = document.getElementById('login-form');
const keyInput = document.getElementById('access-key');
const submitButton = document.getElementById('submit-button');
const pasteButton = document.getElementById('paste-button');
const statusNode = document.getElementById('login-status');
const buttonLabel = submitButton.querySelector('.button-label');

document.getElementById('year').textContent = String(new Date().getFullYear());

function setStatus(message, state = '') {
  statusNode.textContent = message;
  if (state) statusNode.dataset.state = state;
  else delete statusNode.dataset.state;
}

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

form.addEventListener('submit', async event => {
  event.preventDefault();
  const key = keyInput.value.trim();

  if (!key) {
    setStatus('أدخل مفتاح الوصول أولًا.', 'error');
    keyInput.focus();
    return;
  }

  submitButton.disabled = true;
  buttonLabel.textContent = 'جارٍ التحقق...';
  setStatus('يتم إرسال طلب POST إلى خدمة التحقق...', '');

  try {
    const endpoint = (typeof window !== 'undefined' && window.NXR_AUTH_ENDPOINT) || '/api/login';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ key }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok !== true) {
      throw new Error(result.message || 'لم يتم قبول المفتاح.');
    }

    setStatus(result.message || 'تم التحقق من المفتاح بنجاح.', 'success');
    keyInput.value = '';
  } catch (error) {
    setStatus(error.message || 'تعذر إكمال عملية التحقق.', 'error');
  } finally {
    submitButton.disabled = false;
    buttonLabel.textContent = 'تحقق من المفتاح';
  }
});
