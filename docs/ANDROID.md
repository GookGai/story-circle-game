# Story Circle Android

Visual thesis: the existing charcoal, cream and orange game fills the phone, with a matching dice icon and a quiet native splash.
Content plan: create/join remain the main actions; a saved live circle can be reopened from the first screen; connection problems show one retry action without clearing identity.
Interaction thesis: native invitations open the join dialog; returning from another app resyncs the game; Android back asks before returning home during play.

The Android app bundles the React UI with Capacitor 8. It connects over HTTPS/WSS to the existing Railway service. Internet is required; no new server or subscription is needed. Web guests can keep playing alongside Android users. There are no ads or purchases.

Package: `com.storycircle.game`. The public invitation origin is configured in `src/utils/appLinks.mjs`. Never distribute a build with `server.url` or `allowNavigation: ['*']`; production assets are bundled locally. Native requests originate from `https://localhost`, which the API explicitly allows.

## Build

Use Node 22+, JDK 21 and Android SDK as specified by the checked-in Gradle project. From `frontend`: `npm ci`, `npm run android:sync`, then `cd android && ./gradlew assembleRelease bundleRelease`. `npm run android:open` opens Android Studio. Native builds set the Railway API origin; ordinary `npm run build` keeps the same-origin web deployment.

The Android workflow builds and checks the web UI, runs Gradle/lint and uploads unsigned APK/AAB plus checksums. No signing key is sent to GitHub and no store publishing occurs. The workflow's apksigner tool and its notice are provided only for local signing; they are not included in the app.

Sign locally with `scripts/sign-android.ps1` and JRE/JDK 21. The initial PKCS12 key is under the ignored `.tools/android-signing` folder; its random password is protected with Windows DPAPI for the current Windows account. The script decrypts the password only in memory and passes it to Java via a process environment variable. The private signing key is never committed or uploaded as an artifact. Back up the keystore and recover the password securely before changing Windows accounts/machines: updates must use the same key. DPAPI alone is not a portable backup.

The APK is for direct installation and testing. Installing from a downloaded file requires Android's per-source install permission. App data is separate from browser data: enter a name once in the app or sign into an existing account. Clearing app data/uninstalling removes guest identity. Guest rooms still follow normal server retention; the app cannot restore a room that has expired.

## Invitations and checks

HTTPS `/join/CODE` links and QR codes remain usable in browsers. Android App Links require a matching SHA-256 signing certificate in `frontend/public/.well-known/assetlinks.json` and the same host in AndroidManifest.xml. The explicit `storycircle://join/CODE` route also works for direct app launch. Check both cold launch and already-open app, hardware back/dialog dismissal, keyboard visibility, offline/retry, Wi-Fi/mobile switching, process restart, and playing with a browser friend before a public store rollout.

Google Play still needs the owner's developer account, store listing, content/policy review, required testing and submission. An APK/AAB build is not Play Store approval.
