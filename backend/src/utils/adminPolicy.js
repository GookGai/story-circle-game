export function isAdminUser(user, allowlist = process.env.ADMIN_USERNAMES || '') {
  return user?.isGuest === false && typeof user.username === 'string' &&
    allowlist.split(',').map(name => name.trim()).filter(Boolean).includes(user.username);
}

export function isReservedAdminUsername(username) {
  return (process.env.ADMIN_USERNAMES || '').split(',').map(name => name.trim()).filter(Boolean).includes(username);
}
