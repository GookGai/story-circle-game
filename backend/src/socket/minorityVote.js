/**
 * Minority Vote Socket Handler
 * Manages the minority vote game: set question, cast votes, reveal results
 * The minority side drinks — if tied, everyone drinks!
 */

import prisma from "../utils/prisma.js";


// Pre-defined local questions for offline fallbacks
const FALLBACK_QUESTIONS = {
  general: [
    { question: "ถ้าต้องเลือกอย่างหนึ่ง ตลอดชีวิตนี้คุณจะเลือกอะไร?", optionA: "กินบุฟเฟต์ได้ไม่อั้นแต่เหงา", optionB: "มีเพื่อนเยอะแยะแต่กินได้แค่ข้าวไข่เจียว" },
    { question: "คุณยอมรับข้อเสนอไหนมากกว่ากัน?", optionA: "เงิน 10 ล้านบาทแต่ห้ามใช้มือถือ 1 ปี", optionB: "เงิน 1 แสนบาทแต่ใช้ชีวิตปกติ" }
  ],
  travel: [
    { question: "จัดทริปเที่ยววันหยุดยาวนี้ ไปไหนดี?", optionA: "ไปลุยปีนเขาเดินป่า ⛰️", optionB: "ไปนอนรับลมชิลๆ ที่ทะเล 🌊" },
    { question: "ถ้าต้องเลือกนอนค้างคืน?", optionA: "โรงแรมหรู 5 ดาวริมหาด 🏨", optionB: "กางเต็นท์นอนดูดาวบนดอย ⛺" }
  ],
  food: [
    { question: "เย็นนี้กินอะไรกันดีในวง?", optionA: "ชาบูร้อนๆ น้ำดำเข้มข้น 🍲", optionB: "หมูกระทะเกรียมๆ หอมเนย 🥓" },
    { question: "ข้อพิพาทระดับชาติเกี่ยวกับกะเพรา?", optionA: "กะเพราแท้ต้องใส่แค่ใบกะเพรา! 🌿", optionB: "ใส่ถั่วฝักยาว/ข้าวโพดอ่อนได้ อร่อยดี 🌽" }
  ],
  love: [
    { question: "ถ้าต้องเจอสถานการณ์แบบนี้?", optionA: "แฟนเก่าที่ยังรักทักมาชวนคุย 💬", optionB: "เจอคนใหม่ที่ตรงสเปกทุกอย่างเข้ามาจีบ 😍" },
    { question: "คุณอยากได้แฟนแบบไหนมากกว่ากัน?", optionA: "ขี้บ่นแต่ทำอาหารอร่อยดูแลดี 🍳", optionB: "พูดเพราะหวานเจี๊ยบแต่ทำกับข้าวไม่เป็นเลย 🧁" }
  ],
  funny: [
    { question: "ถ้าตื่นมาแล้วพบว่าตัวเองกลายเป็นสัตว์?", optionA: "เป็นแมวนอนอืดมีคนคอยเลี้ยง 🐱", optionB: "เป็นนกบินไปไหนก็ได้ตามใจชอบ 🐦" },
    { question: "พลังพิเศษที่คุณอยากได้?", optionA: "ล่องหนได้แต่อดนอน 👻", optionB: "บินได้แต่บินช้าเท่าความเร็วเดิน 🦅" }
  ],
  party: [
    { question: "สไตล์การดื่มของคุณคือแบบไหน?", optionA: "เน้นชนแก้วรัวๆ สายเต้นยับ 💃", optionB: "นั่งจิบชิลๆ เม้าท์มอยเรื่องชีวิต 🗣️" },
    { question: "เครื่องดื่มหลักประจำวงคืนนี้?", optionA: "เบียร์เย็นเจี๊ยบฟองนุ่ม 🍺", optionB: "เหล้าผสมเข้มๆ สเปเชียลมิกซ์ 🥃" }
  ]
};

// Request question from OpenRouter or return null on failure
async function queryOpenRouter(category) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.log("⚠️ OPENROUTER_API_KEY not found in env. Using offline fallback.");
    return null;
  }

  const catMap = {
    general: "ทั่วไป กวนๆ ชวนฮา",
    travel: "การท่องเที่ยว เดินทาง ผจญภัย",
    food: "ของกิน อาหารการกิน บุฟเฟต์ ร้านเด็ด",
    love: "ความรัก แฟนเก่า แฟนใหม่ การจีบ ความสัมพันธ์",
    funny: "เรื่องสมมติสุดฮา เรื่องตลก พลังวิเศษ",
    party: "ปาร์ตี้ วงเหล้า การดื่ม กิจกรรมสนุกๆ"
  };

  const categoryName = catMap[category] || "ทั่วไป";

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Story Circle"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `คุณเป็น AI ผู้ช่วยคิดคำถามสำหรับเกมปาร์ตี้วงเหล้า 'เลือกเสียงส่วนน้อย' (Minority Vote)
เมื่อได้รับหมวดหมู่คำถาม ให้คุณสุ่มคำถามกวนๆ สนุกๆ หรือประเด็นที่ชวนถกเถียง ที่คนในวงเหล้ามักมีความคิดแตกแยกเป็น 2 ฝ่าย
โดยต้องตอบกลับในรูปแบบ JSON วัตถุที่มี 3 คีย์ดังนี้เท่านั้น:
{
  "question": "คำถามภาษาไทยกวนๆ ชวนฮา (เช่น ระหว่างเที่ยวภูเขากับเที่ยวทะเลคุณเลือกอะไร?)",
  "optionA": "ตัวเลือก A สั้นๆ ได้ใจความ (เช่น ไปลุยภูเขา ⛰️)",
  "optionB": "ตัวเลือก B สั้นๆ ได้ใจความ (เช่น ไปชิลทะเล 🌊)"
}
ห้ามมีข้อความอื่นนอกเหนือจาก JSON ห้ามใส่ Markdown code block`
          },
          {
            role: "user",
            content: `ขอคำถามหมวดหมู่: ${categoryName}`
          }
        ],
        max_tokens: 250,
        temperature: 0.9,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API response status ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content.trim());
      if (parsed.question && parsed.optionA && parsed.optionB) {
        return parsed;
      }
    }
    return null;
  } catch (err) {
    console.error("❌ OpenRouter API call failed:", err.message);
    return null;
  }
}

// Fetch a random offline question from local fallbacks
function getOfflineQuestion(category) {
  const list = FALLBACK_QUESTIONS[category] || FALLBACK_QUESTIONS.general;
  const randomIndex = Math.floor(Math.random() * list.length);
  return list[randomIndex];
}

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

  // Count total players in the room to check for Mind Match condition
  const totalPlayers = await prisma.roomPlayer.count({
    where: { roomId: round.roomId }
  });
  const isMindMatch = totalPlayers === 2;

  // Determine who drinks
  let drinkers = [];
  let drinkReason = "";

  if (isMindMatch) {
    if (countA === 2 || countB === 2) {
      // Both voted the same (Mind Match Win)
      drinkers = [];
      drinkReason = "ใจตรงกัน! รอดทั้งคู่! 🎉";
    } else {
      // 1 vs 1 (Mind Match Lose)
      drinkers = round.votes.map((v) => v.user);
      drinkReason = "ใจไม่ตรงกัน! ดื่มทั้งคู่! 🍻";
    }
  } else {
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
    isMindMatch,
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

      // Delete old vote rounds in this room to keep DB clean (cascades and deletes votes)
      await prisma.voteRound.deleteMany({
        where: { roomId }
      });

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

  /**
   * vote:generateAIQuestion — Generate an AI question (or offline fallback) for the setter
   */
  socket.on("vote:generateAIQuestion", async ({ category }, callback) => {
    try {
      console.log(`🤖 AI Question requested for category: ${category}`);
      let q = await queryOpenRouter(category);
      if (!q) {
        console.log(`⚠️ AI generation failed or API key missing. Using offline fallback.`);
        q = getOfflineQuestion(category);
      }
      callback?.({ success: true, ...q });
    } catch (error) {
      console.error("vote:generateAIQuestion error:", error);
      callback?.({ error: "เกิดข้อผิดพลาดในการสุ่มคำถามด้วย AI" });
    }
  });
}
