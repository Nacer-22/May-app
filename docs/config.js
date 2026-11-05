/*
 * Nacer_X_Rida — إعدادات الاتصال بخادم المفاتيح
 * ------------------------------------------------------------------
 * endpoint : رابط التحقق الكامل على خادمك
 * contract : 'verify' لعقد { code, device_id } → { valid }
 *            'portal' لعقد { key } → { ok }
 * timeoutMs: مهلة الانتظار (Render يستيقظ من السكون خلال ~50 ثانية)
 * ------------------------------------------------------------------
 */
window.NXR_CONFIG = {
  endpoint: 'https://key-system-yn0o.onrender.com/api/verify',
  contract: 'verify',
  timeoutMs: 75000,
};
