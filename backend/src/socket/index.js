/**
 * Socket.IO Handler Hub
 * Central socket connection manager — authenticates connections,
 * tracks connected users, and delegates to game-specific handlers
 */

import { authenticateSocket } from "../middleware/auth.js";
import roomHandler from "./roomHandler.js";
import horseRaceHandler from "./horseRace.js";
import minorityVoteHandler from "./minorityVote.js";

// Track connected users: userId -> socketId
const connectedUsers = new Map();

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

    // Track this user's socket
    connectedUsers.set(userId, socket.id);

    // Initialize all game handlers for this socket
    roomHandler(io, socket, connectedUsers);
    horseRaceHandler(io, socket, connectedUsers);
    minorityVoteHandler(io, socket, connectedUsers);

    // ─── Disconnect ────────────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      console.log(`🔌 User disconnected: ${username} (${reason})`);

      // Remove from connected users map
      connectedUsers.delete(userId);

      // Notify all rooms this socket was in
      // socket.rooms includes the socket's own id, so filter it out
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) {
          io.to(roomId).emit("room:playerDisconnected", {
            userId,
            username,
          });
        }
      }
    });

    // ─── Error handling ────────────────────────────────────────────────────
    socket.on("error", (error) => {
      console.error(`Socket error for ${username}:`, error);
    });
  });
}

export { connectedUsers };
