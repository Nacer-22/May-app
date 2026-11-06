export const CONFIG = {
  /* ------------------------------------------------------------------ *
   * Branding — names only (site content/copy left untouched)
   * ------------------------------------------------------------------ */
  "BRAND_WORDMARK": "Nacer_X_Rida",
  "BRAND_TAGLINE": "key login, tunnel status, live match features.",
  "KEY_PREFIX": "Nacer",
  "KEY_PLACEHOLDER": "Nacer-XXXX-XXXX-XXXX",
  "IS_XREG": false,

  /* ------------------------------------------------------------------ *
   * Auth — linked to the owner's own key server (Render)
   * AUTH_API_URL  : full URL of the key verification endpoint
   * AUTH_CONTRACT : 'verify' -> sends { code, device_id }  expects { valid, expires_at }
   *                 'redeem' -> sends { key, hwid, ... }     expects { ok, me }
   * AUTH_TIMEOUT  : request timeout in ms (the server may cold-start)
   * ------------------------------------------------------------------ */
  "AUTH_API_URL": "https://key-system-yn0o.onrender.com/api/verify",
  "AUTH_CONTRACT": "verify",
  "AUTH_TIMEOUT": 75000,

  /* Bundled Node server sync (disabled for the static GitHub Pages build) */
  "SERVER_SYNC": false,
  "API_BASE": "",

  /* Happ VPN subscription deep-link (set HAPP_SUB_URL or template) */
  "HAPP_SUB_URL": "",
  "HAPP_SUB_URL_TEMPLATE": "",

  "SOCIAL_DISCORD_URL": "https://discord.gg/Km6Hsxk7Y4",
  "SOCIAL_TELEGRAM_URL": "",
  "SOCIAL_WHATSAPP_URL": "",
  "HAPP_IOS_URL": "https://apps.apple.com/app/happ-proxy-utility/id6504287215",
  "HAPP_ANDROID_URL": "https://play.google.com/store/apps/details?id=com.happ.proxy",

  "MARKER_TYPES": [
    "Power",
    "Phantom",
    "Dreamland",
    "Ice Wall",
    "Moco",
    "Clu",
    "Shirou",
    "Iris",
    "Dreki"
  ],
  "DEFAULT_FEATURES": {
    "marker": {
      "enabled": true,
      "type": "Power"
    },
    "aimLag": {
      "enabled": false,
      "onFire": false,
      "onScope": false
    },
    "fastLanding": {
      "enabled": false,
      "spot": "Peak"
    },
    "fastRevive": {
      "enabled": false
    },
    "gloo": {
      "enabled": false,
      "yawDeg": 180
    },
    "aimpoint": {
      "enabled": false
    }
  },
  "UPDATE_NOTES": [
    {
      "version": "v1.7",
      "title": "Nacer_X_Rida System Launch",
      "body": "Welcome to Nacer_X_Rida! Integrated with Happ VPN tunneling and updated community links."
    }
  ]
};
export default CONFIG;
