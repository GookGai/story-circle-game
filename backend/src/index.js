/**
 * Story Circle — Main Server Entry Point
 *
 * Express + Socket.IO server with:
 * - JWT authentication
 * - REST API routes (auth, rooms, stats, games)
 * - Real-time WebSocket handlers (room management, horse race, minority vote)
 * - PostgreSQL via Prisma ORM
 */

import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import prisma from "./utils/prisma.js";

// Route imports
import authRoutes from "./routes/auth.js";
import roomRoutes from "./routes/rooms.js";
import statsRoutes from "./routes/stats.js";
import { getAllGames } from "./utils/gameRegistry.js";

// Socket handler imports
import { initializeSocketHandlers } from "./socket/index.js";

// ─── Initialize ──────────────────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// ─── CORS Configuration ─────────────────────────────────────────────────────

const configuredOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  // `origin: true` reflects the caller and remains compatible with credentials.
  // A literal "*" plus credentials is rejected by browsers.
  origin: configuredOrigins.includes("*") ? true : configuredOrigins,
  credentials: true,
};

app.use(cors(corsOptions));

// ─── Body Parsing ────────────────────────────────────────────────────────────

app.use(express.json());

// ─── REST API Routes ─────────────────────────────────────────────────────────

app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/stats", statsRoutes);

// Game registry endpoint — returns all available game types
app.get("/api/games", (_req, res) => {
  res.json({ games: getAllGames() });
});

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── Socket.IO Setup ─────────────────────────────────────────────────────────

const io = new Server(httpServer, {
  cors: corsOptions,
});

// Initialize all socket event handlers
initializeSocketHandlers(io);

// ─── Start Server ────────────────────────────────────────────────────────────

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║         🎮 Story Circle Server 🎮        ║
  ║                                          ║
  ║   REST API:  http://0.0.0.0:${PORT}        ║
  ║   Socket.IO: ws://0.0.0.0:${PORT}          ║
  ║   Health:    http://0.0.0.0:${PORT}/health  ║
  ║                                          ║
  ╚══════════════════════════════════════════╝
  `);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  await prisma.$disconnect();
  httpServer.close(() => {
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT received. Shutting down gracefully...");
  await prisma.$disconnect();
  httpServer.close(() => {
    process.exit(0);
  });
});

export { app, httpServer, io };
