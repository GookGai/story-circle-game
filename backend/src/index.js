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
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import prisma from "./utils/prisma.js";

// Route imports
import authRoutes from "./routes/auth.js";
import roomRoutes from "./routes/rooms.js";
import statsRoutes from "./routes/stats.js";
import { GAMES } from "./party/engine.js";
import { rateLimit } from "./middleware/rateLimit.js";

// Socket handler imports
import { initializeParty } from "./party/service.js";

// ─── Initialize ──────────────────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required in production");
}
app.disable("x-powered-by");
app.set('trust proxy', 1);

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

app.use(express.json({ limit: '16kb' }));
app.use('/api/auth', rateLimit({ limit: 80, windowMs: 15 * 60 * 1000 }));
app.use('/api/rooms', rateLimit({ limit: 240, windowMs: 60 * 1000 }));

// ─── REST API Routes ─────────────────────────────────────────────────────────

app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/stats", statsRoutes);

// Game registry endpoint — returns all available game types
app.get("/api/games", (_req, res) => {
  res.json({ games: GAMES });
});

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/health/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

// Serve the Vite build from the same process and origin as API and sockets.
const frontendDir = fileURLToPath(new URL("../../frontend/dist/", import.meta.url));
if (existsSync(path.join(frontendDir, "index.html"))) {
  app.use("/assets", express.static(path.join(frontendDir, "assets"), {
    maxAge: "1y", immutable: true,
  }));
  app.use(express.static(frontendDir, { maxAge: 0 }));
  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/health/") || path.extname(req.path)) return next();
    res.sendFile(path.join(frontendDir, "index.html"));
  });
}

// ─── Socket.IO Setup ─────────────────────────────────────────────────────────

const io = new Server(httpServer, {
  cors: corsOptions,
});

// Initialize all socket event handlers
initializeParty(io);

app.use((error, _req, res, _next) => {
  console.error('Request failed:', error.code || error.message);
  res.status(error.status || 500).json({ error: error.status === 413 ? 'ข้อมูลมีขนาดใหญ่เกินไป' : 'ระบบขัดข้องชั่วคราว ลองอีกครั้ง' });
});

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

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  io.close(async () => {
    await prisma.$disconnect();
    clearTimeout(deadline);
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { app, httpServer, io };
