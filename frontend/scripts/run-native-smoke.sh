#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/../android"
./gradlew --no-daemon :app:connectedDebugAndroidTest
test_result=$?
mkdir -p ../../artifacts/screenshots
adb pull /sdcard/Android/data/com.storycircle.game/files/. ../../artifacts/screenshots/ || true
if [ "$test_result" -ne 0 ]; then exit "$test_result"; fi
# Verify the minified release independently of the instrumentation class loader.
adb install -r app/build/outputs/apk/release/app-release.apk
python3 ../scripts/test-release-ui.py
