import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invitePath, roomInviteUrl, PRODUCTION_URL } from '../src/utils/appLinks.mjs';

test('cold and warm app invitations resolve to the same join route', () => {
  for (const url of [`${PRODUCTION_URL}/join/Ab12cD`, 'storycircle://join/Ab12cD', `${PRODUCTION_URL}/join/AB12CD/?source=qr`]) {
    assert.equal(invitePath(url), '/join/AB12CD');
  }
});
test('deep links reject other origins, credentials and non-invitation paths', () => {
  for (const value of ['https://evil.example/join/ABCDEF', `${PRODUCTION_URL}.evil.example/join/ABCDEF`, `${PRODUCTION_URL}/room/ABCDEF`, 'storycircle://evil/ABCDEF', 'storycircle://join/ABCDEF/extra', 'storycircle://join/../../login', 'javascript:alert(1)', 'storycircle://join/ABC', 'storycircle://user@join/ABCDEF', `${PRODUCTION_URL}/join/ABC%2fEF`, 'http://striking-sparkle-production-adf7.up.railway.app/join/ABCDEF']) assert.equal(invitePath(value), null, value);
});
test('native QR always uses the public web origin', () => {
  assert.equal(roomInviteUrl('ABC123', PRODUCTION_URL), `${PRODUCTION_URL}/join/ABC123`);
  assert.throws(() => roomInviteUrl('../login', PRODUCTION_URL));
});
