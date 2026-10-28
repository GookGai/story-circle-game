import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { onlineUserCount } from '../party/service.js';
import { dashboardDays } from '../usage/policy.js';
import { usageStatus } from '../usage/store.js';

const router = Router();
router.use(authenticate, requireAdmin);
router.get('/dashboard', async (req, res, next) => {
  let days;
  try { days = dashboardDays(req.query.days); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  try {
    const since = new Date(Date.now() - days * 86400000);
    const where = { createdAt: { gte: since } };
    const [users, rooms, rounds, errors, games, events] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(DISTINCT "userId")::int AS count FROM "UsageEvent" WHERE "createdAt" >= ${since}`,
      prisma.usageEvent.count({ where: { ...where, type: 'ROOM_CREATED' } }),
      prisma.usageEvent.count({ where: { ...where, type: 'GAME_STARTED' } }),
      prisma.usageEvent.count({ where: { ...where, type: 'ERROR' } }),
      prisma.usageEvent.groupBy({ by: ['gameType'], where: { ...where, type: 'GAME_STARTED' }, _count: { id: true } }),
      prisma.usageEvent.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100,
        select: { id: true, createdAt: true, username: true, isGuest: true, type: true, roomCode: true, gameType: true, source: true, errorCode: true } }),
    ]);
    res.json({ days, generatedAt: new Date(), retentionDays: 30,
      totals: { users: users[0].count, online: onlineUserCount(), rooms, rounds, errors },
      games: games.map(game => ({ gameType: game.gameType, count: game._count.id })).sort((a, b) => b.count - a.count),
      events, logging: usageStatus(),
    });
  } catch (error) { next(error); }
});
export default router;
