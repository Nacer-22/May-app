# Nacer_X_Rida — Secure Access Portal

نسخة مستقلة بواجهة دخول فقط، بتصميم أسود/أحمر وشعار الجمجمة.

## ما الموجود في هذه النسخة؟

- واجهة دخول واحدة باسم `Nacer_X_Rida`.
- إرسال المفتاح عبر `POST` من الخادم المحلي إلى خدمة التحقق المحددة في `AUTH_API_URL`.
- لا توجد لوحة تحكم أو صفحة إدارة أو واجهات إعدادات لعب.
- لا توجد وحدات نفق UDP أو اعتراض/تعديل حزم أو تكامل مع خوادم الألعاب. هذه النسخة منفصلة عن تلك الأجزاء.
- لا يتم حفظ مفتاح المستخدم في `localStorage` أو في ملفات المشروع.

## إعداد عنوان POST

الإعداد الافتراضي:

```text
https://key-system-yn0o.onrender.com/api/redeem
```

اخترت المسار `/api/redeem` لأن هذا هو مسار POST الموجود في خادم المشروع الأصلي. لم أتمكن من التحقق من عقد API للخادم البعيد من بيئة البناء؛ لذلك تأكد أن خادمك يستخدم هذا المسار ويقبل JSON بالشكل التالي:

```json
{ "key": "YOUR-ACCESS-KEY" }
```

يجب أن يعيد الخادم JSON يؤكد النجاح صراحةً باستخدام واحد من الحقول `ok: true` أو `success: true` أو `valid: true`. لا تعتبر البوابة أي استجابة HTTP ناجحة تصريحًا تلقائيًا.

لتغيير المسار، عيّن متغير البيئة `AUTH_API_URL` إلى رابط POST الكامل الصحيح.

## التشغيل محليًا

يتطلب Node.js 20 أو أحدث، ولا توجد تبعيات خارجية:

```bash
npm start
```

ثم افتح `http://localhost:3000`.

مثال لتشغيله مع عنوان POST مختلف:

```bash
AUTH_API_URL=https://example.com/custom/verify npm start
```

على Windows PowerShell:

```powershell
$env:AUTH_API_URL="https://example.com/custom/verify"
npm start
```

## النشر على Render

أنشئ Web Service جديدًا واربط هذا المستودع، ثم استخدم:

- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variable: `AUTH_API_URL` = رابط POST الكامل لخادم المفاتيح.

## فحص الملفات

```bash
npm run check
```

## النشر على GitHub Pages (واجهة فقط)

الواجهة موجودة في مجلد `docs` في جذر المستودع، وGitHub Pages مضبوط على النشر
من الفرع `main` والمجلد `/docs`، لذا يُحدَّث الموقع تلقائيًا مع كل دفع.

- رابط الموقع: `https://nacer-22.github.io/May-app/`
- GitHub Pages استضافة ثابتة ولا تشغّل Node.js، لذلك مسار `/api/login` غير متاح هناك.
- لتشغيل التحقق من المفاتيح على النسخة المنشورة، انشر `server.js` على Render (أو أي خادم Node)
  ثم ضع رابط الخادم الكامل في `docs/config.js`:

```js
window.NXR_AUTH_ENDPOINT = 'https://your-service.onrender.com/api/login';
```

يجب أن يسمح الخادم بطلبات CORS من نطاق `https://nacer-22.github.io`، وأن يعيد
`{ "ok": true }` عند نجاح التحقق.

## بنية المستودع

```text
docs/                # ملفات الواجهة الثابتة المنشورة على GitHub Pages
portal/
  server.js          # خادم Node.js للتحقق من المفاتيح (يخدم مجلد docs)
  package.json
  README.md
```
