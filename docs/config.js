/*
 * Nacer_X_Rida — إعدادات الاتصال بخادم المفاتيح
 * ------------------------------------------------------------------
 * endpoint  : رابط التحقق الكامل على خادمك
 * contract  : 'verify' لعقد { code, device_id } → { valid }
 *             'portal' لعقد { key } → { ok }
 * timeoutMs : مهلة الانتظار (Render يستيقظ من السكون خلال ~50 ثانية)
 * homeUrl   : الصفحة التي تُفتح بعد نجاح التحقق
 * redirectDelay : تأخير بسيط (مللي ثانية) قبل الانتقال للصفحة الرئيسية
 * ------------------------------------------------------------------
 */
window.NXR_CONFIG = {
  endpoint: 'https://key-system-yn0o.onrender.com/api/verify',
  contract: 'verify',
  timeoutMs: 75000,
  homeUrl: 'home.html',
  redirectDelay: 900,
};
