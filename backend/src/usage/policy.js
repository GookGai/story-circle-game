export const EVENT_TYPES = new Set(['ACCOUNT_CREATED', 'LOGIN', 'CONNECTED', 'DISCONNECTED', 'ROOM_CREATED', 'ROOM_JOINED', 'ROOM_LEFT', 'GAME_STARTED', 'GAME_ENDED', 'GAME_PAUSED', 'GAME_RESUMED', 'ERROR']);
export const GAME_TYPES = new Set(['MIXED', 'MINORITY_VOTE', 'HORSE_RACE', 'PANIC_JUMP', 'FORBIDDEN_WORD']);

export function sourceOf(request) {
  return request?.headers?.origin === 'https://localhost' ? 'ANDROID' : 'WEB';
}

// Explicit projection: callers can never accidentally persist a token or game payload.
export function usageData(event) {
  if (!EVENT_TYPES.has(event.type)) throw new Error('Unknown usage event');
  const user = event.user;
  return {
    type: event.type,
    userId: typeof user?.id === 'string' ? user.id.slice(0, 80) : null,
    username: typeof user?.username === 'string' ? (user.isGuest ? user.username.replace(/#\d+$/, '') : user.username).slice(0, 64) : null,
    isGuest: user?.isGuest === true,
    roomCode: /^[A-Z0-9]{6}$/.test(event.roomCode || '') ? event.roomCode : null,
    gameType: GAME_TYPES.has(event.gameType) ? event.gameType : null,
    source: event.source === 'ANDROID' ? 'ANDROID' : 'WEB',
    errorCode: /^[A-Z][A-Z0-9_]{1,39}$/.test(event.errorCode || '') ? event.errorCode : null,
  };
}

export function dashboardDays(value) {
  const days = value === undefined ? 7 : Number(value);
  if (![1, 7, 30].includes(days)) throw new Error('เลือกช่วง 1, 7 หรือ 30 วัน');
  return days;
}
