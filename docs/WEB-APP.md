# Installed web app

Visual thesis: keep the existing cartoon/navy identity and offer one clear “ติดตั้งเว็บแอป” action, with a matching dice icon on the user's device.
Content plan: install action, standalone/installed status, browser-specific instructions when needed, then the existing APK as a secondary option.
Interaction thesis: request installation only on a user click, let the browser own confirmation, and show helpful steps when the install event is unavailable. No automatic prompts during games.

The manifest uses a stable `/` app ID, root scope, a standalone display, unrestricted orientation and 192/512px PNG dice icons. Apple devices get a 180px touch icon and web-app metadata. The app is online-only: there is no service worker caching gameplay, accounts or HTTP navigation. This keeps new launches on the current web deployment and avoids forcing a reload during an active game. Existing open windows receive a new frontend when reopened/refreshed; server rules still update normally.

Chromium's `beforeinstallprompt` is captured before React mounts. The single-use prompt is called directly from a click, only one request can be active, and cancelled/failed requests are not reported as successful installs. `appinstalled` or standalone display confirms installation for the current session. No permanent installed flag is stored, since the user can uninstall outside the site. Without a prompt, device-specific instructions explain the browser's own install menu. iPhone/iPad instructions use Safari, Share, Add to Home Screen and Open as Web App when present. Embedded browsers direct users to Safari/Chrome/Edge.

The user must confirm installation; the website cannot silently create an app or shortcut. Launching from an installed icon uses the web account/storage available in that browser/app context; it does not import identity from the APK. Multiplayer requires internet. APK 1.3.0 remains downloadable under a secondary disclosure. Android CI is manual-only so ordinary web changes do not build APKs or run device checks.

Sources checked 2026-10-28: [MDN installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [MDN install prompt](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event), [Apple Open as Web App](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios). A service worker is not required by the currently documented installability criteria.
