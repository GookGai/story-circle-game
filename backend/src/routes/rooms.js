/**
 * Room management routes: create, get by code, list user's rooms
 */

import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

/**
 * Generate a random 6-character uppercase alphanumeric room code
 */
function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ─── POST / — Create a new room ─────────────────────────────────────────────
router.post("/", authenticate, async (req, res) => {
  try {
    const { gameType, maxPlayers, settings } = req.body;

    if (!gameType) {
      return res.status(400).json({ error: "กรุณาเลือกประเภทเกม" });
    }

    // Generate unique room code (retry if collision)
    let code;
    let exists = true;
    while (exists) {
      code = generateRoomCode();
      exists = !!(await prisma.room.findUnique({ where: { code } }));
    }

    // Create room and add host as first player in a transaction
    const room = await prisma.$transaction(async (tx) => {
      const newRoom = await tx.room.create({
        data: {
          code,
          hostId: req.user.id,
          gameType,
          maxPlayers: maxPlayers || 15,
          settings: settings || {},
        },
      });

      // Add the host as the first player
      await tx.roomPlayer.create({
        data: {
          roomId: newRoom.id,
          userId: req.user.id,
        },
      });

      return newRoom;
    });

    // Fetch room with players for response
    const roomWithPlayers = await prisma.room.findUnique({
      where: { id: room.id },
      include: {
        players: {
          include: {
            user: { select: { id: true, username: true, avatar: true } },
          },
        },
        host: { select: { id: true, username: true, avatar: true } },
      },
    });

    res.status(201).json({ room: roomWithPlayers });
  } catch (error) {
    console.error("Create room error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการสร้างห้อง" });
  }
});

// ─── GET /my/rooms — Get rooms the current user is in ────────────────────────
// NOTE: This route MUST be defined before /:code to avoid "my" being treated as a code
router.get("/my/rooms", authenticate, async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      where: {
        players: {
          some: { userId: req.user.id },
        },
      },
      include: {
        players: {
          include: {
            user: { select: { id: true, username: true, avatar: true } },
          },
        },
        host: { select: { id: true, username: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ rooms });
  } catch (error) {
    console.error("Get my rooms error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลห้อง" });
  }
});

// ─── POST /:code/join — Join a room by its code ─────────────────────────────────
router.post("/:code/join", authenticate, async (req, res) => {
  try {
    const { code } = req.params;

    const room = await prisma.room.findUnique({
      where: { code: code.toUpperCase() },
      include: { players: true },
    });

    if (!room) {
      return res.status(404).json({ error: "ไม่พบห้องนี้" });
    }

    if (room.status === "FINISHED") {
      return res.status(400).json({ error: "ห้องนี้จบเกมแล้ว" });
    }

    // Check max players
    if (room.players.length >= room.maxPlayers) {
      const alreadyInRoom = room.players.some((p) => p.userId === req.user.id);
      if (!alreadyInRoom) {
        return res.status(400).json({ error: "ห้องเต็มแล้ว" });
      }
    }

    // Add player to room (upsert to handle rejoin seamlessly)
    await prisma.roomPlayer.upsert({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: req.user.id,
        },
      },
      create: {
        roomId: room.id,
        userId: req.user.id,
      },
      update: {}, // No-op if already exists
    });

    res.json({ success: true, room });
  } catch (error) {
    console.error("Join room error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการเข้าร่วมห้อง" });
  }
});

// ─── GET /:code — Get a room by its code ─────────────────────────────────────
router.get("/:code", authenticate, async (req, res) => {
  try {
    const { code } = req.params;

    const room = await prisma.room.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        players: {
          include: {
            user: { select: { id: true, username: true, avatar: true } },
          },
          orderBy: { joinedAt: "asc" },
        },
        host: { select: { id: true, username: true, avatar: true } },
      },
    });

    if (!room) {
      return res.status(404).json({ error: "ไม่พบห้องนี้" });
    }

    res.json({ room });
  } catch (error) {
    console.error("Get room error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลห้อง" });
  }
});

export default router;
