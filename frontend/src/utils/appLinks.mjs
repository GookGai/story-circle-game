export const PRODUCTION_URL = 'https://striking-sparkle-production-adf7.up.railway.app';

export function invitePath(value, publicOrigin = PRODUCTION_URL) {
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    const path = url.protocol === 'storycircle:' && url.host === 'join'
      ? `/join${url.pathname}`
      : url.protocol === 'https:' && url.origin === new URL(publicOrigin).origin
        ? url.pathname : '';
    const match = /^\/join\/([a-z0-9]{6})\/?$/i.exec(path);
    return match ? `/join/${match[1].toUpperCase()}` : null;
  } catch {
    return null;
  }
}

export function roomInviteUrl(code, publicOrigin) {
  if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error('Invalid room code');
  return `${new URL(publicOrigin).origin}/join/${code}`;
}
