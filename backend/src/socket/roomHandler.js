/**
 * Room Socket Handler
 * Manages real-time room events: join, leave, player list, start game, kick
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Clean up empty rooms and guest users that are no longer active
 */
async function cleanupRoomAndGuests(roomId) {
  try {
    if (!roomId) return;
    
    // Check if room still has players
    const playersRemaining = await prisma.roomPlayer.count({
      where: { roomId }
    });

    if (playersRemaining === 0) {
      console.log(`🧹 Room ${roomId} has 0 players. Deleting room and cascading...`);
      await prisma.room.delete({
        where: { id: roomId }
      });
    }

    // Clean up temporary guest users who are no longer in any room
    const deletedGuests = await prisma.user.deleteMany({
      where: {
        username: { contains: "#" },
        roomPlayers: { none: {} },
        createdRooms: { none: {} }
      }
    });
    if (deletedGuests.count > 0) {
      console.log(`🧹 Cleaned up ${deletedGuests.count} inactive guest users.`);
    }
  } catch (err) {
    console.error("Error in cleanupRoomAndGuests:", err);
  }
}

/**
 * Initialize room socket event handlers
 * @param {object} io - Socket.IO server instance
 * @param {object} socket - Connected socket instance
 * @param {Map} connectedUsers - Map of userId -> socketId
 */
export default function roomHandler(io, socket, connectedUsers) {
  /**
   * room:join — Join a room by code
   * Adds player to DB and socket room, broadcasts updated player list
   */
  socket.on("room:join", async (code, callback) => {
    try {
      const room = await prisma.room.findUnique({
        where: { code: code.toUpperCase() },
        include: { players: true },
      });

      if (!room) {
        return callback?.({ error: "ไม่พบห้องนี้" });
      }

      if (room.status === "FINISHED") {
        return callback?.({ error: "ห้องนี้จบเกมแล้ว" });
      }

      // Check max players
      if (room.players.length >= room.maxPlayers) {
        return callback?.({ error: "ห้องเต็มแล้ว" });
      }

      // Add player to DB (upsert to handle rejoin)
      await prisma.roomPlayer.upsert({
        where: {
          roomId_userId: {
            roomId: room.id,
            userId: socket.user.id,
          },
        },
        create: {
          roomId: room.id,
          userId: socket.user.id,
        },
        update: {}, // No-op if already exists
      });

      // Join the socket room
      socket.join(room.id);

      // Fetch updated player list
      const players = await prisma.roomPlayer.findMany({
        where: { roomId: room.id },
        include: {
          user: { select: { id: true, username: true, avatar: true } },
        },
        orderBy: { joinedAt: "asc" },
      });

      // Broadcast updated player list to all in room
      io.to(room.id).emit("room:playerList", players);

      // Notify room that someone joined
      io.to(room.id).emit("room:playerJoined", {
        userId: socket.user.id,
        username: socket.user.username,
      });

      callback?.({ success: true, room });
    } catch (error) {
      console.error("room:join error:", error);
      callback?.({ error: "เกิดข้อผิดพลาดในการเข้าห้อง" });
    }
  });

  /**
   * room:leave — Leave a room
   * Removes player from DB and socket room, broadcasts update
   */
  socket.on("room:leave", async (roomIdOrCode, callback) => {
    try {
      let roomId = roomIdOrCode;
      if (roomIdOrCode && roomIdOrCode.length === 6) {
        const r = await prisma.room.findUnique({ where: { code: roomIdOrCode.toUpperCase() } });
        if (r) roomId = r.id;
      }

      // Remove player from DB
      await prisma.roomPlayer.deleteMany({
        where: {
          roomId,
          userId: socket.user.id,
        },
      });

      // Leave socket room
      socket.leave(roomId);

      // Fetch updated player list
      const players = await prisma.roomPlayer.findMany({
        where: { roomId },
        include: {
          user: { select: { id: true, username: true, avatar: true } },
        },
        orderBy: { joinedAt: "asc" },
      });

      // Broadcast updated player list
      io.to(roomId).emit("room:playerList", players);

      // Notify room that someone left
      io.to(roomId).emit("room:playerLeft", {
        userId: socket.user.id,
        username: socket.user.username,
      });

      callback?.({ success: true });

      // Perform room and guest cleanup
      await cleanupRoomAndGuests(roomId);
    } catch (error) {
      console.error("room:leave error:", error);
      callback?.({ error: "เกิดข้อผิดพลาดในการออกห้อง" });
    }
  });

  /**
   * room:players — Request current player list for a room
   */
  socket.on("room:players", async (roomIdOrCode, callback) => {
    try {
      let roomId = roomIdOrCode;
      if (roomIdOrCode && roomIdOrCode.length === 6) {
        const r = await prisma.room.findUnique({ where: { code: roomIdOrCode.toUpperCase() } });
        if (r) roomId = r.id;
      }

      const players = await prisma.roomPlayer.findMany({
        where: { roomId },
        include: {
          user: { select: { id: true, username: true, avatar: true } },
        },
        orderBy: { joinedAt: "asc" },
      });

      callback?.({ players });
    } catch (error) {
      console.error("room:players error:", error);
      callback?.({ error: "เกิดข้อผิดพลาด" });
    }
  });

  /**
   * room:start — Start the game (host only)
   * Changes room status to PLAYING and broadcasts game start
   */
  socket.on("room:start", async (roomIdOrCode, callback) => {
    try {
      let roomId = roomIdOrCode;
      if (roomIdOrCode && roomIdOrCode.length === 6) {
        const r = await prisma.room.findUnique({ where: { code: roomIdOrCode.toUpperCase() } });
        if (r) roomId = r.id;
      }

      const room = await prisma.room.findUnique({ where: { id: roomId } });

      if (!room) {
        return callback?.({ error: "ไม่พบห้องนี้" });
      }

      // Only the host can start the game
      if (room.hostId !== socket.user.id) {
        return callback?.({ error: "เฉพาะเจ้าของห้องเท่านั้นที่เริ่มเกมได้" });
      }

      // Update room status
      await prisma.room.update({
        where: { id: roomId },
        data: { status: "PLAYING" },
      });

      // Broadcast game start to all players in the room
      io.to(roomId).emit("room:gameStarted", {
        roomId,
        gameType: room.gameType,
      });

      callback?.({ success: true });
    } catch (error) {
      console.error("room:start error:", error);
      callback?.({ error: "เกิดข้อผิดพลาดในการเริ่มเกม" });
    }
  });

  /**
   * room:kick — Kick a player from the room (host only)
   */
  socket.on("room:kick", async ({ roomId: roomIdOrCode, userId }, callback) => {
    try {
      let roomId = roomIdOrCode;
      if (roomIdOrCode && roomIdOrCode.length === 6) {
        const r = await prisma.room.findUnique({ where: { code: roomIdOrCode.toUpperCase() } });
        if (r) roomId = r.id;
      }

      const room = await prisma.room.findUnique({ where: { id: roomId } });

      if (!room) {
        return callback?.({ error: "ไม่พบห้องนี้" });
      }

      // Only the host can kick
      if (room.hostId !== socket.user.id) {
        return callback?.({ error: "เฉพาะเจ้าของห้องเท่านั้นที่เตะผู้เล่นได้" });
      }

      // Can't kick yourself
      if (userId === socket.user.id) {
        return callback?.({ error: "ไม่สามารถเตะตัวเองได้" });
      }

      // Remove player from DB
      await prisma.roomPlayer.deleteMany({
        where: { roomId, userId },
      });

      // Notify the kicked player via their socket
      const kickedSocketId = connectedUsers.get(userId);
      if (kickedSocketId) {
        const kickedSocket = io.sockets.sockets.get(kickedSocketId);
        if (kickedSocket) {
          kickedSocket.emit("room:kicked", { roomId });
          kickedSocket.leave(roomId);
        }
      }

      // Broadcast updated player list
      const players = await prisma.roomPlayer.findMany({
        where: { roomId },
        include: {
          user: { select: { id: true, username: true, avatar: true } },
        },
        orderBy: { joinedAt: "asc" },
      });

      io.to(roomId).emit("room:playerList", players);

      callback?.({ success: true });

      // Perform room and guest cleanup
      await cleanupRoomAndGuests(roomId);
    } catch (error) {
      console.error("room:kick error:", error);
      callback?.({ error: "เกิดข้อผิดพลาดในการเตะผู้เล่น" });
    }
  });

  /**
   * room:changeGame — Change game type of the room (host only)
   */
  socket.on("room:changeGame", async ({ roomId, gameType, settings }, callback) => {
    try {
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) {
        return callback?.({ error: "ไม่พบห้องนี้" });
      }

      if (room.hostId !== socket.user.id) {
        return callback?.({ error: "เฉพาะเจ้าของห้องเท่านั้นที่เปลี่ยนเกมได้" });
      }

      const updateData = { gameType };
      if (settings !== undefined) {
        updateData.settings = settings;
      }

      // Update room game type and settings
      await prisma.room.update({
        where: { id: roomId },
        data: updateData,
      });

      // Broadcast game change to all players in the room
      io.to(roomId).emit("room:gameChanged", { gameType, settings });

      callback?.({ success: true });
    } catch (error) {
      console.error("room:changeGame error:", error);
      callback?.({ error: "เกิดข้อผิดพลาดในการเปลี่ยนเกม" });
    }
  });

  /**
   * room:backToLobby — Return all players in the room to the lobby (host only)
   */
  socket.on("room:backToLobby", async (roomIdOrCode, callback) => {
    try {
      let roomId = roomIdOrCode;
      if (roomIdOrCode && roomIdOrCode.length === 6) {
        const r = await prisma.room.findUnique({ where: { code: roomIdOrCode.toUpperCase() } });
        if (r) roomId = r.id;
      }

      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) {
        return callback?.({ error: "ไม่พบห้องนี้" });
      }

      if (room.hostId !== socket.user.id) {
        return callback?.({ error: "เฉพาะเจ้าของห้องเท่านั้นที่ดึงผู้เล่นกลับห้องได้" });
      }

      // Update room status back to WAITING
      await prisma.room.update({
        where: { id: roomId },
        data: { status: "WAITING" },
      });

      // Broadcast back to lobby event
      io.to(roomId).emit("room:goBackToLobby");

      callback?.({ success: true });
    } catch (error) {
      console.error("room:backToLobby error:", error);
      callback?.({ error: "เกิดข้อผิดพลาดในการดึงผู้เล่นกลับห้อง" });
    }
  });
}

