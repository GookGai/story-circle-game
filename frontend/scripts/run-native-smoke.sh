#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/../android"
ANDROID_NATIVE_TEST=true ./gradlew --no-daemon connectedReleaseAndroidTest
test_result=$?
mkdir -p ../../artifacts/screenshots
adb pull /sdcard/Android/data/com.storycircle.game/files/. ../../artifacts/screenshots/ || true
exit "$test_result"
