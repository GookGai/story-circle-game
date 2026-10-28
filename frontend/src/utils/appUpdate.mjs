const versionParts = (value) => typeof value === 'string' && /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(value)
  ? value.split('.').map(Number) : null;

export const UPDATE_SNOOZE_KEY = 'storycircle:update-snooze';
export const SNOOZE_MS = 24 * 60 * 60 * 1000;

export function parseAndroidRelease(value) {
  if (!value || !versionParts(value.version) || !Number.isSafeInteger(value.versionCode) || value.versionCode < 1) return null;
  const expected = `https://github.com/GookGai/story-circle-game/releases/download/android-v${value.version}/story-circle-${value.version}.apk`;
  if (value.url !== expected || !/^[a-f0-9]{64}$/.test(value.sha256)) return null;
  return {
    version: value.version, versionCode: value.versionCode, url: expected, sha256: value.sha256,
    size: typeof value.size === 'string' ? value.size.slice(0, 30) : '',
    notes: typeof value.notes === 'string' ? value.notes.slice(0, 300) : '',
  };
}

export function isNewerRelease(installed, release) {
  const current = versionParts(installed?.version), next = versionParts(release?.version);
  const build = Number(installed?.build);
  if (!current || !next || !Number.isSafeInteger(build) || build < 1 || release.versionCode <= build) return false;
  for (let i = 0; i < 3; i++) if (next[i] !== current[i]) return next[i] > current[i];
  return true; // A higher Android build of the same version can be installed too.
}

export async function fetchAndroidRelease(origin = '', fetcher = fetch) {
  const response = await fetcher(`${origin}/api/app/android`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Update check unavailable');
  return parseAndroidRelease(await response.json());
}

export function createUpdateChecker({ getInfo, fetchRelease, now = Date.now, interval = 5 * 60 * 1000 }) {
  let pending, checkedAt = null, candidate = null;
  return function check() {
    if (pending) return pending;
    if (checkedAt !== null && now() - checkedAt < interval) return Promise.resolve(candidate);
    checkedAt = now();
    pending = (async () => {
      try {
        const [info, raw] = await Promise.all([getInfo(), fetchRelease()]);
        const release = parseAndroidRelease(raw);
        candidate = release && isNewerRelease(info, release) ? release : null;
      } catch { candidate = null; } // Updates must never stop a game or show an offline error.
      return candidate;
    })().finally(() => { pending = null; });
    return pending;
  };
}

export function canPromptUpdate(pathname, party, connected) {
  const match = /^\/(?:room\/|game\/[^/]+\/)([a-z0-9]{6})\/?$/i.exec(pathname);
  if (!match) return !pathname.startsWith('/room/') && !pathname.startsWith('/game/');
  if (!connected || party?.code !== match[1].toUpperCase()) return false;
  if (['LOBBY', 'RESULTS', 'FINISHED'].includes(party.phase)) return true;
  return party.phase === 'PAUSED' && ['LOBBY', 'RESULTS'].includes(party.resumePhase);
}

export function readUpdateSnooze(storage) {
  try { return JSON.parse(storage.getItem(UPDATE_SNOOZE_KEY)) || null; } catch { return null; }
}
export function isUpdateSnoozed(release, snooze, now = Date.now()) {
  return snooze?.version === release?.version && snooze?.versionCode === release?.versionCode &&
    Number.isFinite(snooze.until) && snooze.until > now && snooze.until <= now + SNOOZE_MS;
}
export function snoozeUpdate(release, storage, now = Date.now()) {
  const snooze = { version: release.version, versionCode: release.versionCode, until: now + SNOOZE_MS };
  try { storage.setItem(UPDATE_SNOOZE_KEY, JSON.stringify(snooze)); } catch { /* In-memory snooze still works. */ }
  return snooze;
}
