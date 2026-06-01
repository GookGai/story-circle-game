/**
 * Minority Vote Socket Handler
 * Manages the minority vote game: set question, cast votes, reveal results
 * The minority side drinks — if tied, everyone drinks!
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Helper: Reveal the vote results, count votes, determine minority, assign drinks, broadcast
 */
async function revealVotes(roundId, io) {
  const round = await prisma.voteRound.findUnique({
    where: { id: roundId },
    include: {
      votes: {
        include: {
          user: { select: { id: true, username: true, avatar: true } },
        },
      },
      room: true,
    },
  });

  if (!round) {
    throw new Error("ไม่พบรอบโหวตนี้");
  }

  if (round.status !== "VOTING") {
    return; // Already revealed, do nothing
  }

  // Count votes for each option
  const votesA = round.votes.filter((v) => v.choice === "A");
  const votesB = round.votes.filter((v) => v.choice === "B");

  const countA = votesA.length;
  const countB = votesB.length;

  // Determine who drinks
  let drinkers = [];
  let drinkReason = "";

  if (countA === countB) {
    // Tie — everyone drinks!
    drinkers = round.votes.map((v) => v.user);
    drinkReason = "เสมอกัน! ทุกคนดื่ม! 🍻";
  } else if (countA < countB) {
    // A is minority
    drinkers = votesA.map((v) => v.user);
    drinkReason = `ฝ่าย A เป็นเสียงส่วนน้อย (${countA} vs ${countB}) ดื่ม! 🍺`;
  } else {
    // B is minority
    drinkers = votesB.map((v) => v.user);
    drinkReason = `ฝ่าย B เป็นเสียงส่วนน้อย (${countB} vs ${countA}) ดื่ม! 🍺`;
  }

  // Increment drink count for drinkers
  for (const drinker of drinkers) {
    await prisma.drinkStat.upsert({
      where: {
        userId_roomId: {
          userId: drinker.id,
          roomId: round.roomId,
        },
      },
      create: {
        userId: drinker.id,
        roomId: round.roomId,
        count: 1,
      },
      update: {
        count: { increment: 1 },
      },
    });
  }

  // Update round status
  await prisma.voteRound.update({
    where: { id: roundId },
    data: { status: "REVEALED" },
  });

  // Broadcast full results to room
  io.to(round.roomId).emit("vote:revealed", {
    roundId,
    question: round.question,
    optionA: round.optionA,
    optionB: round.optionB,
    votesA: votesA.map((v) => ({
      userId: v.user.id,
      username: v.user.username,
      avatar: v.user.avatar,
    })),
    votesB: votesB.map((v) => ({
      userId: v.user.id,
      username: v.user.username,
      avatar: v.user.avatar,
    })),
    countA,
    countB,
    drinkers: drinkers.map((d) => ({
      userId: d.id,
      username: d.username,
      avatar: d.avatar,
    })),
    drinkReason,
    isTie: countA === countB,
  });
}

/**
 * Initialize minority vote socket event handlers
 * @param {object} io - Socket.IO server instance
 * @param {object} socket - Connected socket instance
 * @param {Map} connectedUsers - Map of userId -> socketId
 */
export default function minorityVoteHandler(io, socket, connectedUsers) {
  /**
   * vote:setQuestion — Create a new vote round with a question and two options
   */
  socket.on("vote:setQuestion", async ({ roomId: roomIdOrCode, question, optionA, optionB }, callback) => {
    try {
      if (!optionA || !optionB) {
        return callback?.({ error: "กรุณากรอกตัวเลือกให้ครบ" });
      }

      let roomId = roomIdOrCode;
      if (roomIdOrCode && roomIdOrCode.length === 6) {
        const r = await prisma.room.findUnique({ where: { code: roomIdOrCode.toUpperCase() } });
        if (r) roomId = r.id;
      }

      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) {
        return callback?.({ error: "ไม่พบห้องนี้" });
      }

      const finalQuestion = question?.trim() || "โหวตเสียงข้างน้อย! 🗳️";

      // Create new vote round
      const round = await prisma.voteRound.create({
        data: {
          roomId,
          question: finalQuestion,
          optionA: optionA.trim(),
          optionB: optionB.trim(),
          setterId: socket.user.id,
        },
      });

      // Broadcast the question to all players in the room
      io.to(roomId).emit("vote:newQuestion", {
        roundId: round.id,
        question: round.question,
        optionA: round.optionA,
        optionB: round.optionB,
        setter: {
          id: socket.user.id,
          username: socket.user.username,
        },
      });

      callback?.({ success: true, roundId: round.id });
    } catch (error) {
      console.error("vote:setQuestion error:", error);
      callback?.({ error: "เกิดข้อผิดพลาดในการตั้งคำถาม" });
    }
  });

  /**
   * vote:cast — Cast a vote (A or B)
   * Broadcasts vote count without revealing individual choices
   */
  socket.on("vote:cast", async ({ roundId, choice }, callback) => {
    try {
      if (!["A", "B"].includes(choice)) {
        return callback?.({ error: "ตัวเลือกไม่ถูกต้อง" });
      }

      const round = await prisma.voteRound.findUnique({
        where: { id: roundId },
      });

      if (!round) {
        return callback?.({ error: "ไม่พบรอบโหวตนี้" });
      }

      if (round.status !== "VOTING") {
        return callback?.({ error: "รอบโหวตนี้จบแล้ว" });
      }

      // Upsert vote (allow changing vote before reveal)
      await prisma.vote.upsert({
        where: {
          roundId_userId: {
            roundId,
            userId: socket.user.id,
          },
        },
        create: {
          roundId,
          userId: socket.user.id,
          choice,
        },
        update: {
          choice,
        },
      });

      // Count total votes (not revealing A vs B split)
      const totalVotes = await prisma.vote.count({
        where: { roundId },
      });

      // Broadcast vote count to room (opaque — don't reveal choices)
      io.to(round.roomId).emit("vote:update", {
        roundId,
        totalVotes,
        // Notify that this user has voted (but not what they chose)
        votedUserId: socket.user.id,
      });

      // Automatically reveal if everyone in the room has voted
      const totalPlayers = await prisma.roomPlayer.count({
        where: { roomId: round.roomId },
      });

      if (totalVotes >= totalPlayers) {
        await revealVotes(roundId, io);
      }

      callback?.({ success: true });
    } catch (error) {
      console.error("vote:cast error:", error);
      callback?.({ error: "เกิดข้อผิดพลาดในการโหวต" });
    }
  });

  /**
   * vote:reveal — Reveal the vote results
   * Counts votes, determines minority side, assigns drinks
   */
  socket.on("vote:reveal", async (roundId, callback) => {
    try {
      await revealVotes(roundId, io);
      callback?.({ success: true });
    } catch (error) {
      console.error("vote:reveal error:", error);
      callback?.({ error: error.message || "เกิดข้อผิดพลาดในการเปิดเผยผลโหวต" });
    }
  });

  /**
   * vote:nextTurn — Determine next question setter (rotate through players)
   */
  socket.on("vote:nextTurn", async (roomIdOrCode, callback) => {
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

      // Get all players in join order
      const players = await prisma.roomPlayer.findMany({
        where: { roomId },
        include: {
          user: { select: { id: true, username: true, avatar: true } },
        },
        orderBy: { joinedAt: "asc" },
      });

      if (players.length === 0) {
        return callback?.({ error: "ไม่มีผู้เล่นในห้อง" });
      }

      // Get the last round to find current setter
      const lastRound = await prisma.voteRound.findFirst({
        where: { roomId },
        orderBy: { id: "desc" },
      });

      let nextSetterIndex = 0;

      if (lastRound) {
        // Find current setter's index and move to next
        const currentIndex = players.findIndex(
          (p) => p.userId === lastRound.setterId
        );
        nextSetterIndex = (currentIndex + 1) % players.length;
      }

      const nextSetter = players[nextSetterIndex];

      // Broadcast next turn to room
      io.to(roomId).emit("vote:nextSetter", {
        userId: nextSetter.user.id,
        username: nextSetter.user.username,
        avatar: nextSetter.user.avatar,
      });

      callback?.({
        success: true,
        nextSetter: {
          userId: nextSetter.user.id,
          username: nextSetter.user.username,
        },
      });
    } catch (error) {
      console.error("vote:nextTurn error:", error);
      callback?.({ error: "เกิดข้อผิดพลาด" });
    }
  });
}
