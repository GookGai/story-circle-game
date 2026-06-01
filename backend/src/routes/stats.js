/**
 * Drink statistics routes: room leaderboard and personal stats
 */

import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

// ─── GET / — Get global leaderboard of all players ───────────────────────────
router.get("/", authenticate, async (req, res) => {
  try {
    // Aggregate drink counts per user across all rooms
    const drinkStats = await prisma.drinkStat.groupBy({
      by: ["userId"],
      _sum: {
        count: true,
      },
    });

    // Fetch user details for each aggregated stat
    const players = await Promise.all(
      drinkStats.map(async (stat) => {
        const user = await prisma.user.findUnique({
          where: { id: stat.userId },
          select: { id: true, username: true, avatar: true },
        });
        return {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          drinkCount: stat._sum.count || 0,
        };
      })
    );

    res.json({ players });
  } catch (error) {
    console.error("Get global stats error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงสถิติ" });
  }
});

// ─── GET /room/:roomId — Get drink stats for a specific room ─────────────────
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

    const stats = await prisma.drinkStat.findMany({
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
      drinkCount: s.count,
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

// ─── GET /me — Get current user's total drink count across all rooms ─────────
router.get("/me", authenticate, async (req, res) => {
  try {
    const result = await prisma.drinkStat.aggregate({
      where: { userId: req.user.id },
      _sum: { count: true },
    });

    const totalDrinks = result._sum.count || 0;

    // Also get per-room breakdown
    const breakdown = await prisma.drinkStat.findMany({
      where: { userId: req.user.id },
      include: {
        room: { select: { id: true, code: true, gameType: true } },
      },
      orderBy: { count: "desc" },
    });

    res.json({ totalDrinks, breakdown });
  } catch (error) {
    console.error("Get my stats error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงสถิติ" });
  }
});

export default router;
