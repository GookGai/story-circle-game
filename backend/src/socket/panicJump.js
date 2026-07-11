import prisma from "../utils/prisma.js";

export default function (io, socket, connectedUsers) {
  
  async function autoRevealRound(roundId, roomId) {
    try {
      const round = await prisma.panicJumpRound.findUnique({ where: { id: roundId }, include: { jumps: true } });
      if (!round || round.status === "REVEALED") return;

      await prisma.panicJumpRound.update({ where: { id: roundId }, data: { status: "REVEALED" } });

      const players = await prisma.roomPlayer.findMany({ where: { roomId }, include: { user: true } });
      const jumpedUserIds = round.jumps.map(j => j.userId);
      const unjumpedUsers = players.filter(p => !jumpedUserIds.includes(p.userId));

      let currentOrder = round.jumps.length;
      const newJumps = [];
      for (const p of unjumpedUsers) {
        currentOrder++;
        newJumps.push({
          roundId: round.id,
          userId: p.userId,
          jumpOrder: currentOrder,
          survived: false,
          points: 0
        });
      }
      
      if (newJumps.length > 0) {
        await prisma.panicJumpAction.createMany({ data: newJumps });
      }

      const allJumps = await prisma.panicJumpAction.findMany({ 
        where: { roundId: round.id },
        orderBy: { jumpOrder: 'asc' },
        include: { user: true }
      });

      const quota = round.quota;
      let drinkers = [];
      let survivors = [];
      const roundWrites = [];

      for (let i = 0; i < allJumps.length; i++) {
        const j = allJumps[i];
        let survived = false;
        let points = 0;
        let reason = "";

        if (i === 0) {
          survived = false;
          reason = "คนแรกตายแน่นอน! (หน่วยกล้าตาย)";
        } else if (i > 0 && i <= quota) {
          // ถ้าไม่ได้กระโดดด้วยตัวเอง (เวลาล่วงเลย 8000ms+) ให้ถือว่าโดดไม่ทันโควต้า
          const timeDiffMs = j.createdAt.getTime() - round.createdAt.getTime();
          if (timeDiffMs >= 8000) {
            survived = false;
            reason = "ช้าเกินไป หมดเวลาโดด! 🐌";
          } else {
            survived = true;
            points = Math.floor(timeDiffMs / 10);
            if (points < 0) points = 0;
            reason = `รอดตาย! (รอ ${(timeDiffMs / 1000).toFixed(2)} วิ) 🎉`;
          }
        } else {
          survived = false;
          reason = "ช้าเกินไป โดดไม่ทันโควต้า! 🐌";
        }

        if (survived) {
          survivors.push({ ...j, reason });
          roundWrites.push(prisma.roomPlayer.update({
            where: { roomId_userId: { roomId, userId: j.userId } },
            data: { score: { increment: points } }
          }));
        } else {
          drinkers.push({ ...j, reason });
          roundWrites.push(prisma.drinkStat.upsert({
            where: { userId_roomId: { userId: j.userId, roomId } },
            create: { userId: j.userId, roomId, count: 1 },
            update: { count: { increment: 1 } }
          }));
        }
        
        roundWrites.push(prisma.panicJumpAction.update({
          where: { id: j.id },
          data: { survived, points }
        }));
      }

      await prisma.$transaction(roundWrites);

      const updatedPlayers = await prisma.roomPlayer.findMany({ 
        where: { roomId },
        include: { user: true },
        orderBy: { score: 'desc' }
      });

      io.to(roomId).emit("jump:revealed", {
        roundId,
        roundNum: round.roundNum,
        survivors: survivors.map(s => ({ user: s.user, jumpOrder: s.jumpOrder, reason: s.reason, points: s.points })),
        drinkers: drinkers.map(d => ({ user: d.user, jumpOrder: d.jumpOrder, reason: d.reason })),
        allScores: updatedPlayers.map(p => ({
          username: p.user.username,
          avatar: p.user.avatar,
          score: p.score
        }))
      });
    } catch (err) {
      console.error("autoRevealRound error:", err);
    }
  }

  socket.on("jump:start", async (roomId, callback) => {
    try {
      const room = await prisma.room.findUnique({ where: { id: roomId }, include: { players: { include: { user: true } } } });
      if (!room) return callback?.({ error: "ไม่พบห้อง" });
      
      const players = room.players;
      if (players.length < 3) return callback?.({ error: "ต้องมีผู้เล่นอย่างน้อย 3 คน" });

      const maxRounds = room.settings?.maxRounds || 3;

      let game = await prisma.panicJumpGame.findUnique({ where: { roomId } });
      if (game) {
        await prisma.panicJumpGame.delete({ where: { id: game.id } });
      }
      game = await prisma.panicJumpGame.create({
        data: {
          roomId,
          currentRound: 1,
          maxRounds,
          status: "ROUND_START"
        }
      });

      await prisma.roomPlayer.updateMany({
        where: { roomId },
        data: { score: 0 }
      });

      const maxQuota = Math.max(1, players.length - 2);
      // Random quota from 1 to maxQuota
      const quota = Math.floor(Math.random() * maxQuota) + 1;
      
      const round = await prisma.panicJumpRound.create({
        data: {
          gameId: game.id,
          roundNum: 1,
          quota,
          status: "JUMPING"
        }
      });

      io.to(roomId).emit("jump:roundStarted", {
        roundId: round.id,
        roundNum: 1,
        maxRounds,
        duration: 8,
        quota
      });
      
      setTimeout(() => {
        autoRevealRound(round.id, roomId);
      }, 8500); // 8 seconds + 500ms buffer
      
      callback?.({ success: true });
    } catch (err) {
      console.error("jump:start error", err);
      callback?.({ error: "เกิดข้อผิดพลาดในการเริ่มเกม" });
    }
  });

  socket.on("jump:action", async ({ roundId, roomId }, callback) => {
    try {
      const round = await prisma.panicJumpRound.findUnique({ where: { id: roundId } });
      if (!round || round.status !== "JUMPING") return callback?.({ error: "ไม่สามารถกระโดดได้ตอนนี้" });

      const existing = await prisma.panicJumpAction.findUnique({
        where: { roundId_userId: { roundId, userId: socket.user.id } }
      });
      if (existing) return callback?.({ error: "คุณกระโดดไปแล้ว" });

      const currentCount = await prisma.panicJumpAction.count({ where: { roundId } });
      
      await prisma.panicJumpAction.create({
        data: {
          roundId,
          userId: socket.user.id,
          jumpOrder: currentCount + 1
        }
      });

      const totalPlayers = await prisma.roomPlayer.count({ where: { roomId } });
      if (currentCount + 1 >= totalPlayers) {
        await autoRevealRound(roundId, roomId);
      }
      
      callback?.({ success: true, jumpOrder: currentCount + 1 });
    } catch (err) {
      console.error("jump:action error", err);
      callback?.({ error: "เกิดข้อผิดพลาดในการกระโดด" });
    }
  });

  socket.on("jump:nextRound", async (roomId, callback) => {
    try {
      const game = await prisma.panicJumpGame.findUnique({ where: { roomId } });
      if (!game) return callback?.({ error: "ไม่พบเกม" });
      
      const nextRoundNum = game.currentRound + 1;
      
      await prisma.panicJumpGame.update({
        where: { id: game.id },
        data: { currentRound: nextRoundNum }
      });

      const playersCount = await prisma.roomPlayer.count({ where: { roomId } });
      const maxQuota = Math.max(1, playersCount - 2);
      const quota = Math.floor(Math.random() * maxQuota) + 1;

      const round = await prisma.panicJumpRound.create({
        data: {
          gameId: game.id,
          roundNum: nextRoundNum,
          quota,
          status: "JUMPING"
        }
      });

      io.to(roomId).emit("jump:roundStarted", {
        roundId: round.id,
        roundNum: nextRoundNum,
        maxRounds: game.maxRounds,
        duration: 8,
        quota
      });

      setTimeout(() => {
        autoRevealRound(round.id, roomId);
      }, 8500);

      callback?.({ success: true });
    } catch (err) {
      console.error("jump:nextRound error", err);
      callback?.({ error: "เกิดข้อผิดพลาดในการเริ่มรอบต่อไป" });
    }
  });

  socket.on("jump:finish", async (roomId, callback) => {
    try {
      const players = await prisma.roomPlayer.findMany({ 
        where: { roomId },
        include: { user: true },
        orderBy: { score: 'asc' }
      });

      if (players.length === 0) return callback?.({ error: "ไม่พบผู้เล่น" });

      const minScore = players[0].score;
      const losers = players.filter(p => p.score === minScore);

      await prisma.panicJumpGame.update({
        where: { roomId },
        data: { status: "ENDED" }
      });

      io.to(roomId).emit("jump:gameFinished", {
        losers: losers.map(l => ({
          id: l.user.id,
          username: l.user.username,
          avatar: l.user.avatar,
          score: l.score
        })),
        allScores: players.map(p => ({
          username: p.user.username,
          avatar: p.user.avatar,
          score: p.score
        }))
      });

      callback?.({ success: true });
    } catch (err) {
      console.error("jump:finish error", err);
      callback?.({ error: "เกิดข้อผิดพลาดในการสรุปผล" });
    }
  });
}
