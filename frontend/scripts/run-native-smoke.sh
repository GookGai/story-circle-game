#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/../android"
node ../scripts/android-companion.mjs > ../../artifacts-companion.log 2>&1 &
companion_pid=$!
trap 'kill "$companion_pid" 2>/dev/null || true' EXIT
for attempt in $(seq 1 40); do
  if [ -f ../../artifacts/android-room-code.txt ]; then break; fi
  if ! kill -0 "$companion_pid" 2>/dev/null; then cat ../../artifacts-companion.log; exit 1; fi
  sleep 1
done
room_code=$(cat ../../artifacts/android-room-code.txt)
./gradlew --no-daemon :app:connectedDebugAndroidTest -Pandroid.experimental.androidTest.leaveApksInstalledAfterRun=true -Pandroid.testInstrumentationRunnerArguments.roomCode="$room_code"
test_result=$?
mkdir -p ../../artifacts/screenshots
adb pull /sdcard/Android/data/com.storycircle.game/files/. ../../artifacts/screenshots/ || true
if [ "$test_result" -ne 0 ]; then exit "$test_result"; fi
wait "$companion_pid" || { cat ../../artifacts-companion.log; exit 1; }
# Verify the minified release independently of the instrumentation class loader.
adb install -r app/build/outputs/apk/release/app-release.apk
python3 ../scripts/test-release-ui.py
