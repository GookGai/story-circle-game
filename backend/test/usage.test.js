import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAdminUser } from '../src/utils/adminPolicy.js';
import { usageData, dashboardDays, sourceOf } from '../src/usage/policy.js';
import { UsageBuffer } from '../src/usage/buffer.js';

test('dashboard authority is fail-closed and excludes Guests and client role claims', () => {
  assert.equal(isAdminUser({ username: 'gaiyang', isGuest: false }, 'gaiyang'), true);
  for (const user of [null, { username: 'gaiyang', isGuest: true }, { username: 'gaiyang#123', isGuest: true }, { username: 'other', isGuest: false, isAdmin: true }, { username: 'Gaiyang', isGuest: false }, { username: 'gaiyang' }]) assert.equal(isAdminUser(user, 'gaiyang'), false);
  assert.equal(isAdminUser({ username: 'gaiyang', isGuest: false }, ''), false);
});
test('usage projection cannot retain credentials, private words or command payloads', () => {
  const row = usageData({ type: 'GAME_STARTED', user: { id: 'player', username: 'เมย์#123', isGuest: true, password: 'NEVER_STORE' }, roomCode: 'ABC123', gameType: 'FORBIDDEN_WORD', source: 'ANDROID', token: 'NEVER_STORE', payload: { words: ['NEVER_STORE'] }, ip: 'NEVER_STORE', userAgent: 'NEVER_STORE' });
  assert.equal(row.username, 'เมย์');
  assert.equal(row.source, 'ANDROID');
  assert.ok(!JSON.stringify(row).includes('NEVER_STORE'));
  assert.equal(usageData({ type: 'ERROR', roomCode: '../secret', gameType: 'secret', errorCode: 'password=secret' }).roomCode, null);
  assert.equal(usageData({ type: 'LOGIN', user: { id: 'x', username: 'member#123', isGuest: false } }).username, 'member#123');
  assert.throws(() => usageData({ type: 'ARBITRARY_PAYLOAD' }));
});
test('dashboard ranges are bounded and native source uses the app origin', () => {
  for (const day of [1, 7, 30]) assert.equal(dashboardDays(String(day)), day);
  for (const value of ['0', '365', 'hello', '', ['7', '30']]) assert.throws(() => dashboardDays(value));
  assert.equal(sourceOf({ headers: { origin: 'https://localhost' } }), 'ANDROID');
  assert.equal(sourceOf({ headers: { origin: 'https://example.com' } }), 'WEB');
});
test('usage writes are bounded and concurrent flush calls share one batch', async () => {
  const writes = [];
  const buffer = new UsageBuffer(async rows => { writes.push(rows); }, 2);
  buffer.add({ id: 'one' }); buffer.add({ id: 'two' }); buffer.add({ id: 'three' });
  assert.equal(buffer.dropped, 1);
  await Promise.all([buffer.flush(), buffer.flush()]);
  assert.deepEqual(writes, [[{ id: 'two' }, { id: 'three' }]]);
  assert.equal(buffer.rows.length, 0);
});
test('a failed log write retries the same identifiers without blocking or growing unbounded', async () => {
  let fail = true;
  const written = [];
  const buffer = new UsageBuffer(async rows => { if (fail) throw new Error('Database unavailable'); written.push(...rows); }, 2);
  buffer.add({ id: 'stable-id' });
  await buffer.flush();
  assert.deepEqual(buffer.rows, [{ id: 'stable-id' }]);
  fail = false;
  await buffer.flush();
  assert.deepEqual(written, [{ id: 'stable-id' }]);
});
