/*
 * Nacer_X_Rida — client configuration
 * ------------------------------------------------------------------
 * AUTH_API_URL  : full URL of the key verification endpoint
 * AUTH_CONTRACT : 'verify' -> sends { code, device_id }  expects { valid, expires_at }
 *                 'redeem' -> sends { key, hwid, device_model, device_os } expects { ok, me }
 * AUTH_TIMEOUT  : request timeout in ms (the server may cold-start)
 * SERVER_SYNC   : set to true only when the bundled Node server is running
 *                 on the same origin (enables /api/features and /api/unbind-hwid)
 * ------------------------------------------------------------------
 */
export const CONFIG = {
  BRAND_WORDMARK: 'Nacer_X_Rida',
  BRAND_TAGLINE: 'Nacer_X_Rida secure access portal.',

  AUTH_API_URL: 'https://key-system-yn0o.onrender.com/api/verify',
  AUTH_CONTRACT: 'verify',
  AUTH_TIMEOUT: 75000,

  SERVER_SYNC: false,
  API_BASE: '',

  KEY_PREFIX: 'Nacer',
  KEY_PLACEHOLDER: 'Nacer-XXXX-XXXX-XXXX',
  IS_XREG: false,

  SOCIAL_DISCORD_URL: 'https://discord.gg/Km6Hsxk7Y4',
  SOCIAL_TELEGRAM_URL: '',
  SOCIAL_WHATSAPP_URL: '',

  HAPP_IOS_URL: 'https://apps.apple.com/app/happ-proxy-utility/id6504287215',
  HAPP_ANDROID_URL: 'https://play.google.com/store/apps/details?id=com.happ.proxy',

  // رابط الاشتراك (Subscription URL) — يُفتح به Happ مباشرة عبر happ://add/<url>
  // اتركه فارغاً إن لم يكن لديك رابط اشتراك.
  HAPP_SUB_URL: '',

  // بديل: قالب يُستبدل فيه {key} بكود المستخدم، مثال:
  // 'https://your-panel.com/sub/{key}'
  HAPP_SUB_URL_TEMPLATE: '',

  MARKER_TYPES: [
    'POWER',
    'DREAM',
    'ICE WALL',
    'MOCO',
    'CLU',
    'SHIROU',
    'IRIS'
  ],

  DEFAULT_FEATURES: {
    marker: { enabled: true, type: 'POWER' },
    aimLag: { enabled: false, onFire: false, onScope: false },
    fastLanding: { enabled: false, spot: 'Peak' },
    fastRevive: { enabled: false },
    gloo: { enabled: false, yawDeg: 180 },
    aimpoint: { enabled: false }
  },

  UPDATE_NOTES: [
    {
      version: 'v1.7',
      title: 'Nacer_X_Rida System Launch',
      body: 'Welcome to Nacer_X_Rida. Secure access portal updated.'
    }
  ]
};

export default CONFIG;
