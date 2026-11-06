import prisma from '../utils/prisma.js';
import { isAdminUser } from '../utils/adminPolicy.js';

export async function requireAdmin(req, res, next) {
  res.set('Cache-Control', 'no-store');
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, username: true, isGuest: true } });
    if (!isAdminUser(user)) return res.status(403).json({ error: 'หน้านี้สำหรับผู้ดูแลเท่านั้น' });
    next();
  } catch (error) { next(error); }
}
