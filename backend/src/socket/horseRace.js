/**
 * Horse Race Socket Handler
 * Manages horse race game events: create race, bet, run simulation
 */

import { PrismaClient } from "@prisma/client";
import { simulateRace } from "../utils/horseEngine.js";

const prisma = new PrismaClient();

// Thai horse names and their colors
const HORSE_TEMPLATES = [
  { name: "พญาลม", color: "#ff2d78" },
  { name: "เจ้าฟ้า", color: "#00d4ff" },
  { name: "หมูตัน", color: "#7cff2d" },
  { name: "จอมซิ่ง", color: "#ff6b35" },
  { name: "มังกรดำ", color: "#b44dff" },
];

/**
 * Generate randomized stats for a horse
 * Stats range from 70-90 for high competitiveness
 */
function randomStat() {
  return Math.floor(Math.random() * 21) + 70; // 70 to 90
}

/**
 * Initialize horse race socket event handlers
 * @param {object} io - Socket.IO server instance
 * @param {object} socket - Connected socket instance
 * @param {Map} connectedUsers - Map of userId -> socketId
 */
export default function horseRaceHandler(io, socket, connectedUsers) {
  /**
   * horse:newRace — Create a new race with 5 horses
   * Generates horses with randomized stats and saves to DB
   */
  socket.on("horse:newRace", async (roomIdOrCode, callback) => {
    try {
      let roomId = roomIdOrCode;
      if (roomIdOrCode && roomIdOrCode.length === 6) {
        const r = await prisma.room.findUnique({ where: { code: roomIdOrCode.toUpperCase() } });
        if (r) roomId = r.id;
      }

      // Verify room exists and user is host
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) {
        return callback?.({ error: "ไม่พบห้องนี้" });
      }

      // Create race record
      const race = await prisma.horseRace.create({
        data: {
          roomId,
          status: "BETTING",
        },
      });

      // Create 5 horses with randomized stats
      const horses = await Promise.all(
        HORSE_TEMPLATES.map((template) =>
          prisma.horse.create({
            data: {
              raceId: race.id,
              name: template.name,
              color: template.color,
              speed: randomStat(),
              stamina: randomStat(),
              luck: randomStat(),
            },
          })
        )
      );

      // Broadcast new race and horses to all players in the room
      io.to(roomId).emit("horse:raceCreated", {
        race: { id: race.id, status: race.status },
        horses: horses.map((h) => ({
          id: h.id,
          name: h.name,
          color: h.color,
          speed: h.speed,
          stamina: h.stamina,
          luck: h.luck,
        })),
      });

      callback?.({ success: true, raceId: race.id });
    } catch (error) {
      console.error("horse:newRace error:", error);
      callback?.({ error: "เกิดข้อผิดพลาดในการสร้างการแข่ง" });
    }
  });

  /**
   * horse:bet — Place a bet on a horse
   * Records the bet and broadcasts updated bet counts
   */
  socket.on("horse:bet", async ({ raceId, horseId }, callback) => {
    try {
      const race = await prisma.horseRace.findUnique({
        where: { id: raceId },
      });

      if (!race) {
        return callback?.({ error: "ไม่พบการแข่งนี้" });
      }

      if (race.status !== "BETTING") {
        return callback?.({ error: "หมดเวลาแทงแล้ว" });
      }

      // Remove any existing bet by this user for this race (allow changing bet)
      await prisma.bet.deleteMany({
        where: {
          raceId,
          userId: socket.user.id,
        },
      });

      // Place new bet
      await prisma.bet.create({
        data: {
          raceId,
          horseId,
          userId: socket.user.id,
        },
      });

      // Get bet counts per horse (don't reveal who bet on what)
      const bets = await prisma.bet.groupBy({
        by: ["horseId"],
        where: { raceId },
        _count: { id: true },
      });

      const betCounts = bets.map((b) => ({
        horseId: b.horseId,
        count: b._count.id,
      }));

      // Get total unique bettors
      const totalBettors = await prisma.bet.findMany({
        where: { raceId },
        select: { userId: true },
        distinct: ["userId"],
      });

      // Broadcast bet counts to the room
      io.to(race.roomId).emit("horse:betUpdate", {
        raceId,
        betCounts,
        totalBettors: totalBettors.length,
      });

      callback?.({ success: true });
    } catch (error) {
      console.error("horse:bet error:", error);
      callback?.({ error: "เกิดข้อผิดพลาดในการแทง" });
    }
  });

  /**
   * horse:startRace — Start the race simulation (host only)
   * Runs the simulation engine, sends animation frames, determines winner,
   * and assigns drinks to losers
   */
  socket.on("horse:startRace", async (raceId, callback) => {
    try {
      const race = await prisma.horseRace.findUnique({
        where: { id: raceId },
        include: {
          horses: true,
          room: true,
        },
      });

      if (!race) {
        return callback?.({ error: "ไม่พบการแข่งนี้" });
      }

      // Only host can start
      if (race.room.hostId !== socket.user.id) {
        return callback?.({ error: "เฉพาะเจ้าของห้องเท่านั้นที่เริ่มแข่งได้" });
      }

      if (race.status !== "BETTING") {
        return callback?.({ error: "การแข่งเริ่มไปแล้ว" });
      }

      // Update race status to RACING
      await prisma.horseRace.update({
        where: { id: raceId },
        data: { status: "RACING" },
      });

      // Notify room that race is starting
      io.to(race.roomId).emit("horse:raceStarting", { raceId });

      // Run simulation
      const result = simulateRace(race.horses);

      // Send animation frames at ~100ms intervals
      for (let i = 0; i < result.frames.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        io.to(race.roomId).emit("horse:frame", {
          raceId,
          frame: result.frames[i],
          isLast: i === result.frames.length - 1,
        });
      }

      // Update race with winner
      await prisma.horseRace.update({
        where: { id: raceId },
        data: {
          winnerId: result.winner.id,
          status: "FINISHED",
        },
      });

      // Determine who bet wrong (losers who need to drink)
      const allBets = await prisma.bet.findMany({
        where: { raceId },
        include: {
          user: { select: { id: true, username: true, avatar: true } },
          horse: { select: { id: true, name: true, color: true } },
        },
      });

      const winners = allBets.filter((b) => b.horseId === result.winner.id);
      const losers = allBets.filter((b) => b.horseId !== result.winner.id);

      // Increment drink count for losers
      for (const loser of losers) {
        await prisma.drinkStat.upsert({
          where: {
            userId_roomId: {
              userId: loser.userId,
              roomId: race.roomId,
            },
          },
          create: {
            userId: loser.userId,
            roomId: race.roomId,
            count: 1,
          },
          update: {
            count: { increment: 1 },
          },
        });
      }

      // Add points to user scores based on rankings
      // 1st: 5 pts, 2nd: 4 pts, 3rd: 3 pts, 4th: 2 pts, 5th: 1 pt
      for (const bet of allBets) {
        const horseRank = result.rankings.find((r) => r.id === bet.horseId)?.rank || 5;
        const pointsToAdd = Math.max(1, 6 - horseRank);

        if (pointsToAdd > 0) {
          await prisma.roomPlayer.update({
            where: {
              roomId_userId: {
                roomId: race.roomId,
                userId: bet.userId,
              },
            },
            data: {
              score: { increment: pointsToAdd },
            },
          });
        }
      }

      // Fetch the updated leaderboard for the room
      const leaderboard = await prisma.roomPlayer.findMany({
        where: { roomId: race.roomId },
        include: {
          user: { select: { id: true, username: true, avatar: true } },
        },
        orderBy: { score: "desc" },
      });

      // Broadcast final results
      io.to(race.roomId).emit("horse:result", {
        raceId,
        winner: result.winner,
        rankings: result.rankings,
        leaderboard: leaderboard.map((l) => ({
          userId: l.user.id,
          username: l.user.username,
          avatar: l.user.avatar,
          score: l.score,
        })),
        winnerBettors: winners.map((b) => ({
          userId: b.user.id,
          username: b.user.username,
          avatar: b.user.avatar,
        })),
        loserBettors: losers.map((b) => ({
          userId: b.user.id,
          username: b.user.username,
          avatar: b.user.avatar,
          betOn: { name: b.horse.name, color: b.horse.color },
        })),
      });

      callback?.({ success: true });
    } catch (error) {
      console.error("horse:startRace error:", error);
      callback?.({ error: "เกิดข้อผิดพลาดในการเริ่มแข่ง" });
    }
  });
}
