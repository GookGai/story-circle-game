/**
 * Horse Race Socket Handler
 * Manages horse race game events: create race, bet, run simulation
 */

import prisma from "../utils/prisma.js";
import { simulateRace } from "../utils/horseEngine.js";


// Seeded random number generator
function seedRandom(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 1000) / 1000;
}

// Compute deterministic guru ratings for all horses in a race
// Enforces: exactly one 5-star, one 1-star, and remaining 6 horses get 2-4 stars.
function computeGuruRatings(raceId, horses) {
  // Sort horses by potential: speed * 0.4 + stamina * 0.3 + luck * 0.3
  const sorted = [...horses].sort((a, b) => {
    const potentialA = a.speed * 0.4 + a.stamina * 0.3 + a.luck * 0.3;
    const potentialB = b.speed * 0.4 + b.stamina * 0.3 + b.luck * 0.3;
    return potentialB - potentialA;
  });

  const ratingsMap = {};
  horses.forEach(h => {
    ratingsMap[h.id] = { notknow: 3, guess: 3, random: 3 };
  });

  const guruNames = ["notknow", "guess", "random"];

  guruNames.forEach(guru => {
    const seed = `${raceId}_${guru}`;
    const randAccuracy = seedRandom(seed + "_accuracy");
    
    let fiveStarIndex = 0;
    let oneStarIndex = 7;

    if (randAccuracy < 0.50) {
      // 50% accurate:
      // Pick 5-star from top 3 (ranks 0, 1, 2)
      const r5 = Math.floor(seedRandom(seed + "_5star") * 3);
      const h5 = sorted[r5];
      
      // Pick 1-star from bottom 3 (ranks 5, 6, 7)
      const r1 = 5 + Math.floor(seedRandom(seed + "_1star") * 3);
      const h1 = sorted[r1];

      fiveStarIndex = sorted.findIndex(h => h.id === h5.id);
      oneStarIndex = sorted.findIndex(h => h.id === h1.id);
    } else {
      // 50% chaotic:
      // Pick 5-star completely randomly
      fiveStarIndex = Math.floor(seedRandom(seed + "_5star_chaos") * 8);
      // Pick 1-star completely randomly (not equal to 5-star)
      oneStarIndex = Math.floor(seedRandom(seed + "_1star_chaos") * 8);
      while (oneStarIndex === fiveStarIndex) {
        oneStarIndex = (oneStarIndex + 1) % 8;
      }
    }

    // Assign ratings
    sorted.forEach((h, idx) => {
      let stars = 3;
      if (idx === fiveStarIndex) {
        stars = 5;
      } else if (idx === oneStarIndex) {
        stars = 1;
      } else {
        // Random 2 to 4
        const rndVal = seedRandom(`${seed}_stars_${h.id}`);
        if (rndVal < 0.33) stars = 2;
        else if (rndVal < 0.66) stars = 3;
        else stars = 4;
      }
      
      ratingsMap[h.id][guru] = stars;
    });
  });

  return ratingsMap;
}

// Thai horse names and their colors
const HORSE_TEMPLATES = [
  { name: "พญาลม", color: "#ff2d78" },
  { name: "เจ้าฟ้า", color: "#00d4ff" },
  { name: "หมูตัน", color: "#7cff2d" },
  { name: "จอมซิ่ง", color: "#ff6b35" },
  { name: "มังกรดำ", color: "#b44dff" },
  { name: "สิงห์สนามซ้อม", color: "#00ff99" },
  { name: "เต่าบินเกียร์ห้า", color: "#ffea00" },
  { name: "สายฟ้าหน้ามึน", color: "#ff3333" },
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

      // Delete old races in this room to keep DB clean (cascade deletes horses & bets)
      await prisma.horseRace.deleteMany({
        where: { roomId }
      });

      // Create race record
      const race = await prisma.horseRace.create({
        data: {
          roomId,
          status: "BETTING",
        },
      });

      // Create 8 horses with randomized stats
      const horses = await prisma.horse.createManyAndReturn({
        data: HORSE_TEMPLATES.map((template) => ({
          raceId: race.id,
          name: template.name,
          color: template.color,
          speed: randomStat(),
          stamina: randomStat(),
          luck: randomStat(),
        })),
      });

      // Pre-compute ratings mapping for this race
      const ratingsMap = computeGuruRatings(race.id, horses);

      // Broadcast new race and horses to all players in the room (hiding real stats, showing guru ratings)
      io.to(roomId).emit("horse:raceCreated", {
        race: { id: race.id, status: race.status },
        horses: horses.map((h) => ({
          id: h.id,
          name: h.name,
          color: h.color,
          guruNotKnow: ratingsMap[h.id].notknow,
          guruGuess: ratingsMap[h.id].guess,
          guruRandom: ratingsMap[h.id].random,
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

      // One upsert replaces the previous delete + insert pair.
      await prisma.bet.upsert({
        where: {
          raceId_userId: { raceId, userId: socket.user.id },
        },
        create: { raceId, horseId, userId: socket.user.id },
        update: { horseId },
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
      const totalBettors = await prisma.bet.count({ where: { raceId } });

      // Broadcast bet counts to the room
      io.to(race.roomId).emit("horse:betUpdate", {
        raceId,
        betCounts,
        totalBettors,
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

      // Send one compact timeline and let each browser animate it locally.
      // Sampling every second simulation tick preserves the same duration while
      // cutting position payload roughly in half and Socket.IO events by >99%.
      const frameIntervalMs = 200;
      const compactFrames = result.frames
        .filter((_, index) => index % 2 === 1 || index === result.frames.length - 1)
        .map((frame) =>
          frame.horses.map((horse) => [horse.horseId, horse.distance, horse.event])
        );

      io.to(race.roomId).emit("horse:timeline", {
        raceId,
        intervalMs: frameIntervalMs,
        frames: compactFrames,
      });

      await new Promise((resolve) =>
        setTimeout(resolve, compactFrames.length * frameIntervalMs)
      );

      // Fetch all bets for this race
      const allBets = await prisma.bet.findMany({
        where: { raceId },
        include: {
          user: { select: { id: true, username: true, avatar: true } },
          horse: { select: { id: true, name: true, color: true } },
        },
      });

      // Determine rankings map for quick lookup
      const rankingMap = {};
      result.rankings.forEach((r) => {
        rankingMap[r.id] = r.rank;
      });

      // Winners (Safe): bet on horse that finished 1st, 2nd, or 3rd
      const winners = allBets.filter((b) => rankingMap[b.horseId] <= 3);
      // Losers (Must drink): bet on horse that finished 4th or lower (ranks 4-8)
      const losers = allBets.filter((b) => rankingMap[b.horseId] > 3);

      // Commit all score/stat changes in one database transaction rather than
      // waiting on a separate network round-trip for every player.
      const resultWrites = [
        prisma.horseRace.update({
          where: { id: raceId },
          data: { winnerId: result.winner.id, status: "FINISHED" },
        }),
        ...losers.map((loser) =>
          prisma.drinkStat.upsert({
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
          })
        ),
      ];

      // Add points to user scores based on rankings (1st: 8 pts, 2nd: 7 pts, ... 8th: 1 pt)
      for (const bet of allBets) {
        const horseRank = rankingMap[bet.horseId] || 8;
        const pointsToAdd = Math.max(1, 9 - horseRank);

        if (pointsToAdd > 0) {
          resultWrites.push(
            prisma.roomPlayer.update({
              where: {
                roomId_userId: {
                  roomId: race.roomId,
                  userId: bet.userId,
                },
              },
              data: {
                score: { increment: pointsToAdd },
              },
            })
          );
        }
      }

      await prisma.$transaction(resultWrites);

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
        bets: allBets.map((b) => ({
          userId: b.user.id,
          username: b.user.username,
          avatar: b.user.avatar,
          horseId: b.horseId,
        })),
      });

      callback?.({ success: true });
    } catch (error) {
      console.error("horse:startRace error:", error);
      callback?.({ error: "เกิดข้อผิดพลาดในการเริ่มแข่ง" });
    }
  });
}
