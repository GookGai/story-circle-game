import { Router } from "express";
import { randomBytes } from "node:crypto";
import prisma from "../utils/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { GAMES, initialState, displayName } from "../party/engine.js";
import { joinRoom } from "../party/service.js";
import { recordUserUsage } from '../usage/store.js';
import { sourceOf } from '../usage/policy.js';

const router = Router();
const playerInclude = {
  players: {
    include: { user: { select: { id: true, username: true, avatar: true } } },
    orderBy: { joinedAt: "asc" },
  },
};
const roomView = (room) => ({
  id: room.id,
  code: room.code,
  hostId: room.hostId,
  gameType: room.runtime?.config?.gameType || room.gameType,
  maxPlayers: Math.min(room.maxPlayers, 10),
  status: room.status,
  players: room.players.map((p) => ({
    ...p,
    user: { ...p.user, username: displayName(p.user) },
  })),
});

router.get("/:code/preview", async (req, res) => {
  if (!/^[A-Z0-9]{6}$/i.test(req.params.code))
    return res.status(400).json({ error: "รหัสวงต้องมี 6 ตัว" });
  const room = await prisma.room.findUnique({
    where: { code: req.params.code.toUpperCase() },
    select: {
      code: true,
      status: true,
      maxPlayers: true,
      _count: { select: { players: true } },
    },
  });
  if (!room)
    return res.status(404).json({ error: "ไม่พบวงนี้ ตรวจรหัสอีกครั้ง" });
  res.json({
    code: room.code,
    status: room.status,
    count: room._count.players,
    maxPlayers: Math.min(room.maxPlayers, 10),
  });
});

router.post("/", authenticate, async (req, res) => {
  const gameType = req.body.gameType || "MIXED";
  const totalRounds = req.body.settings?.totalRounds || 6;
  if (
    !GAMES.some((g) => g.type === gameType) ||
    ![3, 6, 9].includes(totalRounds)
  )
    return res.status(400).json({ error: "การตั้งค่าวงไม่ถูกต้อง" });
  if (
    req.body.maxPlayers !== undefined &&
    (!Number.isInteger(req.body.maxPlayers) ||
      req.body.maxPlayers < 2 ||
      req.body.maxPlayers > 10)
  )
    return res.status(400).json({ error: "วงรองรับ 2–10 คน" });
  const count = await prisma.room.count({
    where: { hostId: req.user.id, status: { not: "FINISHED" } },
  });
  if (count >= 5)
    return res
      .status(429)
      .json({ error: "คุณมีวงเปิดอยู่แล้ว 5 วง กลับไปเล่นวงเดิมก่อน" });
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, username: true, avatar: true },
      });
      if (!user)
        return res.status(401).json({ error: "กรุณาตั้งชื่อเล่นอีกครั้ง" });
      const runtime = initialState();
      runtime.config.gameType = gameType;
      runtime.config.totalRounds = totalRounds;
      runtime.profiles[user.id] = { ...user, username: displayName(user) };
      runtime.ready = [user.id];
      const code = randomBytes(5).toString("hex").slice(0, 6).toUpperCase();
      const room = await prisma.room.create({
        data: {
          code,
          hostId: user.id,
          gameType,
          maxPlayers: req.body.maxPlayers || 10,
          runtime,
          players: { create: { userId: user.id } },
        },
        include: playerInclude,
      });
      recordUserUsage(user.id, { type: 'ROOM_CREATED', roomCode: code, gameType, source: sourceOf(req) });
      return res.status(201).json({ room: roomView(room) });
    } catch (error) {
      if (error.code === "P2002") continue;
      throw error;
    }
  }
  return res.status(503).json({ error: "เปิดวงไม่สำเร็จ ลองอีกครั้ง" });
});

router.get("/my/rooms", authenticate, async (req, res) => {
  const rooms = await prisma.room.findMany({
    where: { players: { some: { userId: req.user.id } } },
    include: playerInclude,
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  res.json({ rooms: rooms.map(roomView) });
});

router.post("/:code/join", authenticate, async (req, res) => {
  try {
    const room = await joinRoom(req.params.code, req.user.id, sourceOf(req));
    res.json({ success: true, room: roomView(room) });
  } catch (error) {
    res
      .status(error.code === "ROOM_NOT_FOUND" ? 404 : 400)
      .json({ error: error.message });
  }
});

router.get("/:code", authenticate, async (req, res) => {
  const room = await prisma.room.findUnique({
    where: { code: req.params.code.toUpperCase() },
    include: playerInclude,
  });
  if (!room) return res.status(404).json({ error: "ไม่พบวงนี้" });
  if (!room.players.some((p) => p.userId === req.user.id))
    return res.status(403).json({ error: "เข้าร่วมวงก่อนดูรายละเอียด" });
  res.json({ room: roomView(room) });
});

export default router;
