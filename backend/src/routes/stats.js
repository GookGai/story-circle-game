/**
 * Penalty statistics routes: room leaderboard and personal stats
 */

import { Router } from "express";
import prisma from "../utils/prisma.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// ─── GET / — Get global leaderboard of all players ───────────────────────────
router.get("/", authenticate, async (req, res) => {
  try {
    // Aggregate penalty counts per user across all rooms
    const penaltyStats = await prisma.penaltyStat.groupBy({
      by: ["userId"],
      _sum: {
        count: true,
      },
    });

    // Fetch user details for each aggregated stat
    const users = await prisma.user.findMany({
      where: { id: { in: penaltyStats.map(stat => stat.userId) } },
      select: { id: true, username: true, avatar: true },
    });
    const totals = new Map(penaltyStats.map(stat => [stat.userId, stat._sum.count || 0]));
    const players = users.map(user => ({ ...user, penaltyCount: totals.get(user.id) || 0 }));

    res.json({ players });
  } catch (error) {
    console.error("Get global stats error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงสถิติ" });
  }
});

// ─── GET /room/:roomId — Get penalty stats for a specific room ─────────────────
router.get("/room/:roomId", authenticate, async (req, res) => {
  try {
    const { roomId } = req.params;

    // Resolve 6-character room code to actual Room UUID if needed
    let targetRoomId = roomId;
    if (roomId && roomId.length === 6) {
      const resolvedRoom = await prisma.room.findUnique({
        where: { code: roomId.toUpperCase() },
      });
      if (resolvedRoom) {
        targetRoomId = resolvedRoom.id;
      }
    }

    const stats = await prisma.penaltyStat.findMany({
      where: { roomId: targetRoomId },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
      orderBy: { count: "desc" },
    });

    // Map stats to compatible formats
    const players = stats.map((s) => ({
      id: s.user.id,
      username: s.user.username,
      avatar: s.user.avatar,
      penaltyCount: s.count,
    }));

    const leaderboard = stats.map((s) => ({
      userId: s.user.id,
      username: s.user.username,
      avatar: s.user.avatar,
      count: s.count,
    }));

    res.json({ stats, players, leaderboard });
  } catch (error) {
    console.error("Get room stats error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงสถิติ" });
  }
});

// ─── GET /me — Get current user's total penalty count across all rooms ─────────
router.get("/me", authenticate, async (req, res) => {
  try {
    const result = await prisma.penaltyStat.aggregate({
      where: { userId: req.user.id },
      _sum: { count: true },
    });

    const totalPenalties = result._sum.count || 0;

    // Also get per-room breakdown
    const breakdown = await prisma.penaltyStat.findMany({
      where: { userId: req.user.id },
      include: {
        room: { select: { id: true, code: true, gameType: true } },
      },
      orderBy: { count: "desc" },
    });

    res.json({ totalPenalties, breakdown });
  } catch (error) {
    console.error("Get my stats error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงสถิติ" });
  }
});

export default router;
