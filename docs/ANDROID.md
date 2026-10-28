# Story Circle Android

Visual thesis: a cartoon circle of friends, ink navy, cream and apricot fills the phone, with a matching dice icon and a quiet native splash.
Content plan: create/join remain the main actions; a saved live circle can be reopened from the first screen; connection problems show one retry action without clearing identity.
Interaction thesis: enter a six-character circle code; returning from another app resyncs the game; Android back asks before returning home during play.

The Android app bundles the React UI with Capacitor 8. It connects over HTTPS/WSS to the existing Railway service. Internet is required; no new server or subscription is needed. Web guests can keep playing alongside Android users. There are no ads or purchases.

Package: `com.storycircle.game`. The public invitation origin is configured in `src/utils/appLinks.mjs`. Never distribute a build with `server.url` or `allowNavigation: ['*']`; production assets are bundled locally. Native requests originate from `https://localhost`, which the API explicitly allows.

## Build

Use Node 22+, JDK 21 and Android SDK as specified by the checked-in Gradle project. From `frontend`: `npm ci`, `npm run android:sync`, then `cd android && ./gradlew assembleRelease bundleRelease`. `npm run android:open` opens Android Studio. Native builds set the Railway API origin; ordinary `npm run build` keeps the same-origin web deployment.

The Android workflow builds and checks the web UI, runs Gradle/lint and uploads unsigned APK/AAB plus checksums. No signing key is sent to GitHub and no store publishing occurs. The workflow's apksigner tool and its notice are provided only for local signing; they are not included in the app.

Sign locally with `scripts/sign-android.ps1` and JRE/JDK 21. The initial PKCS12 key is under the ignored `.tools/android-signing` folder; its random password is protected with Windows DPAPI for the current Windows account. The script decrypts the password only in memory and passes it to Java via a process environment variable. The private signing key is never committed or uploaded as an artifact. Back up the keystore and recover the password securely before changing Windows accounts/machines: updates must use the same key. DPAPI alone is not a portable backup.

The APK is for direct installation and testing. Installing from a downloaded file requires Android's per-source install permission. App data is separate from browser data: enter a name once in the app or sign into an existing account. Clearing app data/uninstalling removes guest identity. Guest rooms still follow normal server retention; the app cannot restore a room that has expired.

## Invitations and checks

This trial uses manual six-character code entry. HTTPS invitation links and QR codes keep opening the web version; the manifest does not claim them. Native App Links are deferred after a failed warm-invitation check. The parser and public signing-certificate declaration are retained for future work, but no link-opening capability is promised in this APK. Core acceptance covers creating a circle, joining by code, one shared vote with a browser-protocol companion, reopening the circle and launching the minified APK. Check physical phones before a public store rollout.

Google Play still needs the owner's developer account, store listing, content/policy review, required testing and submission. An APK/AAB build is not Play Store approval.

## Version 1.1.0 — 2026-10-28

The web homepage links to the verified signed APK hosted on GitHub Releases. It reads `/api/app/android`; `frontend/src/utils/androidRelease.js` remains a previously published fallback if the metadata request fails. The download panel is hidden in native builds. APK bytes are served by GitHub rather than the Railway app.

## App update notices — 1.2.0

Visual thesis: a quiet navy/apricot notice above the existing app, with two clear 48px actions and no modal interruption.
Content plan: new version, short release note, “ไว้ทีหลัง” / “อัปเดตเลย”, then a one-line explanation that installation keeps existing app data.
Interaction thesis: detect at launch/resume, wait for a safe game phase, let the user choose when to leave for installation.

The native app gets its installed version/build from Capacitor App and checks the public, anonymous `/api/app/android` metadata endpoint. Concurrent launch/resume checks share one request, with a five-minute throttle and a five-second network timeout. Errors silently leave the game available. Release paths are pinned to this repository's version-matched HTTPS APK URL; invalid metadata, equal versions/builds and downgrades are ignored.

Notices appear on non-room pages or at synced LOBBY/RESULTS/FINISHED states. Active INPUT/RACING/FORBIDDEN states, paused continuous words, unknown room states and disconnected rooms suppress the notice until a safe snapshot arrives. Accepted native game snapshots publish only room code and phase to the notice. “ไว้ทีหลัง” remembers that release/build for 24 hours; a different release can still appear. “อัปเดตเลย” opens the external Android browser and snoozes the same notice. The APK is installed by the user through Android; the app never silently installs or forces an update.

Release procedure: build/sign/verify/publish the new APK first, then update `backend/src/releases/android.json` (version, actual Android versionCode, URL, size, notes, SHA256) and deploy it. This keeps the app and website pointing only to an existing downloadable release. No database, paid service or GitHub API polling is needed. APK 1.1.0 and older need one manual upgrade to 1.2.0 before they can show future notices. A newly installed current version correctly shows no update notice.

Cartoon home illustration and neutral “รับบทลงโทษ” outcomes replace the former venue/drinking presentation. The mobile account control has its own row below the logo, a 48px touch target and truncated long names. Shared page spacing reads Capacitor 8's injected `--safe-area-inset-*` variables, with browser `env()` fallbacks, so headers clear the status bar/cutout and action controls clear the navigation bar. This update uses the existing signing key; install it over 1.0.0. The new layout was checked in responsive browser views; physical-phone inset behavior still needs confirmation on the user's device.

## Trial validation — 2026-10-27

Source `f3443ad28091a73b6364ca8a098081fc36ce9e98`, Android workflow run `40473095242`: release APK/AAB build and Android lint passed. On the Android 15 emulator, the functional test passed creating a circle, joining a separate circle by code, submitting a vote alongside a browser-protocol companion, reaching the same two-player result, reopening the WebView with the same identity and circle, and leaving the disposable circle. The companion report records `passed: true`. Frontend checks and the existing multiplayer CI passed.

The separate release UI check was blocked by an emulator system dialog, `Pixel Launcher isn't responding`; it did not verify the minified release UI. This does not count as a passing release UI check. The locally signed trial APK still needs physical-phone testing. App-link opening is deferred. Emulator checks now run on manual workflow dispatch to avoid repeating expensive device work on every frontend push; the release UI check is an explicit optional input.
