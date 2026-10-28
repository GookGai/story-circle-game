import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseAndroidRelease, isNewerRelease, createUpdateChecker, canPromptUpdate, snoozeUpdate, readUpdateSnooze, isUpdateSnoozed, SNOOZE_MS, fetchAndroidRelease } from '../src/utils/appUpdate.mjs';

const release = (version = '1.2.0', versionCode = 20) => ({
  version, versionCode, size: '1.2 MB', notes: 'update', sha256: 'a'.repeat(64),
  url: `https://github.com/GookGai/story-circle-game/releases/download/android-v${version}/story-circle-${version}.apk`,
});
test('update versions respect Android build order, numeric versions and already-current installs', () => {
  assert.equal(isNewerRelease({ version: '1.1.0', build: '14' }, release()), true);
  assert.equal(isNewerRelease({ version: '1.2.0', build: '20' }, release()), false);
  assert.equal(isNewerRelease({ version: '1.3.0', build: '21' }, release()), false);
  assert.equal(isNewerRelease({ version: '1.2.0', build: '19' }, release()), true);
  assert.equal(isNewerRelease({ version: '1.9.0', build: '19' }, release('1.10.0')), true);
  assert.equal(isNewerRelease({ version: '1.1.0', build: '21' }, release()), false);
  assert.equal(isNewerRelease({ version: 'invalid', build: '14' }, release()), false);
});
test('metadata only permits a version-matched signed APK path on this repository', () => {
  assert.ok(parseAndroidRelease(release()));
  for (const url of ['javascript:alert(1)', 'https://evil.example/app.apk', release().url + '?redirect=evil', release('1.3.0').url]) {
    assert.equal(parseAndroidRelease({ ...release(), url }), null);
  }
  for (const extra of [{ sha256: '' }, { versionCode: -1 }, { version: '1.2.0-beta' }, { versionCode: '20' }]) assert.equal(parseAndroidRelease({ ...release(), ...extra }), null);
  const published = JSON.parse(readFileSync(new URL('../../backend/src/releases/android.json', import.meta.url)));
  assert.ok(parseAndroidRelease(published));
});
test('no prompt interrupts an active round, paused continuous words or an unsynced/disconnected room', () => {
  const path = '/room/ABC123';
  for (const phase of ['INPUT', 'RACING', 'FORBIDDEN', 'PAUSED', undefined]) assert.equal(canPromptUpdate(path, { code: 'ABC123', phase }, true), false);
  for (const phase of ['LOBBY', 'RESULTS', 'FINISHED']) {
    const party = { code: 'ABC123', phase };
    assert.equal(canPromptUpdate(path, party, true), true);
    assert.equal(canPromptUpdate(path, party, false), false);
    assert.equal(canPromptUpdate('/room/DEF456', party, true), false);
  }
  assert.equal(canPromptUpdate(path, { code: 'ABC123', phase: 'PAUSED', resumePhase: 'FORBIDDEN' }, true), false);
  assert.equal(canPromptUpdate(path, { code: 'ABC123', phase: 'PAUSED', resumePhase: 'RESULTS' }, true), true);
  assert.equal(canPromptUpdate('/game/HORSE_RACE/ABC123', { code: 'ABC123', phase: 'INPUT' }, true), false);
  assert.equal(canPromptUpdate('/room/broken', null, true), false);
  assert.equal(canPromptUpdate('/', null, false), true);
});
test('a detected update stays queued during play and becomes eligible at results', () => {
  const party = { code: 'ABC123', phase: 'RACING' };
  assert.equal(canPromptUpdate('/room/ABC123', party, true), false);
  party.phase = 'RESULTS';
  assert.equal(canPromptUpdate('/room/ABC123', party, true), true);
});
test('later persists for 24 hours, survives reload and does not hide a different release', () => {
  let value;
  const storage = { getItem: () => value, setItem: (_key, next) => { value = next; } };
  const snooze = snoozeUpdate(release(), storage, 100);
  assert.deepEqual(readUpdateSnooze(storage), snooze);
  assert.equal(isUpdateSnoozed(release(), snooze, 101), true);
  assert.equal(isUpdateSnoozed(release(), snooze, 100 + SNOOZE_MS), false);
  assert.equal(isUpdateSnoozed(release('1.3.0'), snooze, 101), false);
  assert.equal(isUpdateSnoozed(release('1.2.0', 21), snooze, 101), false);
  assert.equal(readUpdateSnooze({ getItem() { throw Error('blocked'); } }), null);
  assert.equal(snoozeUpdate(release(), { setItem() { throw Error('full'); } }, 100).until, 100 + SNOOZE_MS);
});
test('startup and repeated resume checks share one request and throttle to five minutes', async () => {
  let calls = 0, now = 100;
  const check = createUpdateChecker({ now: () => now, getInfo: async () => ({ version: '1.1.0', build: '14' }), fetchRelease: async () => { calls++; return release(); } });
  const first = check(), second = check();
  assert.equal(first, second);
  assert.equal((await first).version, '1.2.0');
  await check();
  assert.equal(calls, 1);
  now += 300000;
  await check();
  assert.equal(calls, 2);
});
test('offline, bad metadata and plugin failures never prevent play; checks recover later', async () => {
  let now = 100, fail = true;
  const check = createUpdateChecker({ now: () => now, getInfo: async () => ({ version: '1.1.0', build: '14' }), fetchRelease: async () => { if (fail) throw Error('offline'); return release(); } });
  assert.equal(await check(), null);
  fail = false;
  now += 300000;
  assert.ok(await check());
  assert.equal(await createUpdateChecker({ getInfo: async () => { throw Error('plugin'); }, fetchRelease: async () => release() })(), null);
  assert.equal(await createUpdateChecker({ getInfo: async () => ({ version: '1.1.0', build: '14' }), fetchRelease: async () => ({ url: 'evil' }) })(), null);
});
test('release request uses an anonymous public endpoint, timeout and no cached response', async () => {
  const result = await fetchAndroidRelease('https://game.example', async (url, options) => {
    assert.equal(url, 'https://game.example/api/app/android');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers, undefined);
    assert.ok(options.signal);
    return { ok: true, json: async () => release() };
  });
  assert.equal(result.version, '1.2.0');
  await assert.rejects(fetchAndroidRelease('', async () => ({ ok: false })));
});
