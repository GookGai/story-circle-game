import { randomUUID } from 'node:crypto';
import prisma from '../utils/prisma.js';
import { UsageBuffer } from './buffer.js';
import { usageData } from './policy.js';

const users = new Map();
const buffer = new UsageBuffer(rows => prisma.usageEvent.createMany({ data: rows, skipDuplicates: true }));

export function rememberUsageUser(user) {
  if (users.size >= 500) users.delete(users.keys().next().value);
  users.set(user.id, { user: { id: user.id, username: user.username, isGuest: user.isGuest }, until: Date.now() + 300000 });
}

export function recordUsage(event) {
  try {
    if (event.user) rememberUsageUser(event.user);
    buffer.add({ id: randomUUID(), createdAt: new Date(), ...usageData(event) });
  } catch { /* Operational logging must never interrupt a game. */ }
}

export function recordUserUsage(userId, event) {
  const cached = users.get(userId);
  if (cached && cached.until > Date.now()) return recordUsage({ ...event, user: cached.user });
  prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, isGuest: true } })
    .then(user => recordUsage({ ...event, user })).catch(() => {});
}

export const usageStatus = () => ({ queued: buffer.rows.length, dropped: buffer.dropped });
export const flushUsage = () => buffer.flush();

async function prune() {
  try {
    await prisma.usageEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 86400000) } } });
    await prisma.$executeRaw`DELETE FROM "UsageEvent" WHERE "id" IN (SELECT "id" FROM "UsageEvent" ORDER BY "createdAt" DESC, "id" DESC OFFSET 100000)`;
  } catch { /* The next hourly sweep retries after a transient database failure. */ }
}

export function startUsage() {
  const flush = setInterval(flushUsage, 5000);
  const retention = setInterval(prune, 3600000);
  flush.unref(); retention.unref();
  prune();
  return async () => {
    clearInterval(flush); clearInterval(retention);
    for (let attempt = 0; attempt < 6 && (buffer.rows.length || buffer.pending); attempt++) await flushUsage();
  };
}
