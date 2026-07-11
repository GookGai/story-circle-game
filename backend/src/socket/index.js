/**
 * Socket.IO Handler Hub
 * Central socket connection manager — authenticates connections,
 * tracks connected users, and delegates to game-specific handlers
 */

import { authenticateSocket } from "../middleware/auth.js";
import roomHandler, { cleanupRoomAndGuests } from "./roomHandler.js";
import horseRaceHandler from "./horseRace.js";
import minorityVoteHandler from "./minorityVote.js";
import panicJumpHandler from "./panicJump.js";
import prisma from "../utils/prisma.js";

// Track connected users: userId -> socketId
const connectedUsers = new Map();
const activeUserSockets = new Map();
const DISCONNECT_GRACE_MS = Number(process.env.DISCONNECT_GRACE_MS) || 5 * 60 * 1000;

/**
 * Initialize all socket event handlers
 * @param {object} io - Socket.IO server instance
 */
export function initializeSocketHandlers(io) {
  // Authenticate all incoming socket connections via JWT
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const { id: userId, username } = socket.user;

    console.log(`🔌 User connected: ${username} (${userId})`);

    // Track every tab/device for the user while keeping the latest socket for
    // handlers that need to address one client directly.
    const userSockets = activeUserSockets.get(userId) || new Set();
    userSockets.add(socket.id);
    activeUserSockets.set(userId, userSockets);
    connectedUsers.set(userId, socket.id);

    // Initialize all game handlers for this socket
    roomHandler(io, socket, connectedUsers);
    horseRaceHandler(io, socket, connectedUsers);
    minorityVoteHandler(io, socket, connectedUsers);
    panicJumpHandler(io, socket, connectedUsers);

    // ─── Disconnect ────────────────────────────────────────────────────────
    let joinedRoomIds = [];

    socket.on("disconnecting", () => {
      joinedRoomIds = [...socket.rooms].filter((roomId) => roomId !== socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log(`🔌 User disconnected: ${username} (${reason})`);

      const remainingSockets = activeUserSockets.get(userId);
      remainingSockets?.delete(socket.id);
      if (!remainingSockets?.size) {
        activeUserSockets.delete(userId);
        connectedUsers.delete(userId);
      } else if (connectedUsers.get(userId) === socket.id) {
        connectedUsers.set(userId, [...remainingSockets].at(-1));
      }

      // Notify all rooms this socket was in
      // socket.rooms includes the socket's own id, so filter it out
      for (const roomId of joinedRoomIds) {
        if (roomId !== socket.id) {
          io.to(roomId).emit("room:playerDisconnected", {
            userId,
            username,
          });
        }
      }

      // Allow mobile clients to reconnect, then clear abandoned room rows.
      const cleanupTimer = setTimeout(async () => {
        if (activeUserSockets.has(userId)) return;

        for (const roomId of joinedRoomIds) {
          await prisma.roomPlayer.deleteMany({ where: { roomId, userId } });

          const players = await prisma.roomPlayer.findMany({
            where: { roomId },
            include: {
              user: { select: { id: true, username: true, avatar: true } },
            },
            orderBy: { joinedAt: "asc" },
          });
          io.to(roomId).emit("room:playerList", players);
          await cleanupRoomAndGuests(roomId);
        }
      }, DISCONNECT_GRACE_MS);
      cleanupTimer.unref?.();
    });

    // ─── Error handling ────────────────────────────────────────────────────
    socket.on("error", (error) => {
      console.error(`Socket error for ${username}:`, error);
    });
  });
}

export { connectedUsers };
