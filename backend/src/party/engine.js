import { randomUUID } from "node:crypto";
import { simulateRace } from "../utils/horseEngine.js";
import { pickQuestion } from "./questions.js";
import { makeHorseField, makeGurus, presentHorse } from "./horseField.js";
import {
  ensureForbiddenConfig,
  startForbidden,
  advanceForbidden,
  configureForbidden,
  forbiddenCommand,
  forbiddenResult,
  projectForbidden,
  pauseForbidden,
  resumeForbidden,
} from "./forbiddenWords.js";

export const GAMES = [
  {
    type: "FORBIDDEN_WORD",
    name: "คำต้องห้ามประจำตัว",
    subtitle: "หลอกให้หลุด จับแล้วเปลี่ยนคำเล่นต่อ",
    minPlayers: 2,
    maxPlayers: 10,
    icon: "secret",
    rule: "เห็นคำเพื่อน แต่ไม่เห็นคำตัวเอง · คำเปลี่ยนทุก 180 วินาที · จับได้ดื่ม 1 ครั้ง",
  },
  {
    type: "MIXED",
    name: "เล่นผสม",
    subtitle: "เปลี่ยนเกม เปลี่ยนจังหวะ",
    minPlayers: 2,
    maxPlayers: 10,
    icon: "spark",
    rule: "เกมสั้นหลายแบบในวงเดียว",
  },
  {
    type: "MINORITY_VOTE",
    name: "โหวตข้างน้อย",
    subtitle: "เลือกข้าง แล้วมาเถียงกัน",
    minPlayers: 2,
    maxPlayers: 10,
    icon: "vote",
    rule: "อย่าอยู่ฝั่งน้อย · เสมอรอดทั้งวง · 2 คนเล่นใจตรงกัน",
  },
  {
    type: "HORSE_RACE",
    name: "แข่งม้า",
    subtitle: "เชียร์ตัวโปรดให้ติดท็อป 3",
    minPlayers: 2,
    maxPlayers: 10,
    icon: "horse",
    rule: "เลือกม้า 1 ตัว · อันดับ 1–3 รอด · อันดับ 4–8 ดื่ม 1 ครั้ง",
  },
  {
    type: "PANIC_JUMP",
    name: "ร่มชูชีพวัดใจ",
    subtitle: "รอให้เป็น แล้วโดดให้ทัน",
    minPlayers: 3,
    maxPlayers: 10,
    icon: "jump",
    rule: "คนแรกหลุด · คนถัดไปแย่งที่รอดให้ทัน 8 วินาที",
  },
];

const ACTIVE = ["INPUT", "RACING", "FORBIDDEN"];
export const fail = (message, code = "INVALID_ACTION") => {
  const err = new Error(message);
  err.code = code;
  throw err;
};
export const displayName = (user) => user.username.replace(/#\d+$/, "");

export function initialState() {
  return {
    schema: 1,
    phase: "LOBBY",
    config: { gameType: "MIXED", totalRounds: 6, category: "all" },
    ready: [],
    sittingOut: [],
    seen: [],
    scores: {},
    profiles: {},
    history: [],
    round: null,
    roundNumber: 0,
    commands: [],
  };
}

function points(state, id, game, amount, wins = 0) {
  const row = (state.scores[id] ||= {
    HORSE_RACE: 0,
    MINORITY_VOTE: 0,
    PANIC_JUMP: 0,
    wins: 0,
    played: 0,
  });
  row[game] = (row[game] || 0) + amount;
  row.wins += wins;
  row.played += 1;
}

export function finish(state, now, skipped = false) {
  const round = state.round;
  if (
    round?.gameType === "FORBIDDEN_WORD" &&
    (state.phase === "FORBIDDEN" ||
      (state.phase === "PAUSED" && state.resumePhase === "FORBIDDEN"))
  ) {
    round.result = forbiddenResult(state);
    for (const p of round.result.players) {
      points(state, p.userId, round.gameType, p.points);
      state.scores[p.userId].drinks =
        (state.scores[p.userId].drinks || 0) + p.hits;
    }
    round.finishedAt = now;
    state.history.push({
      id: round.id,
      number: state.roundNumber,
      gameType: round.gameType,
      title: round.result.title,
      players: round.result.players,
      skipped: false,
    });
    state.history = state.history.slice(-18);
    state.phase = "FINISHED";
    state.ready = [];
    return;
  }
  if (!round || !ACTIVE.includes(state.phase)) return;
  const results = [];
  if (skipped) {
    round.result = {
      skipped: true,
      title: "พักรอบนี้ไว้ก่อน",
      description: "ไม่มีการคิดคะแนน ไปต่อเมื่อวงพร้อม",
      players: [],
    };
  } else if (round.gameType === "HORSE_RACE") {
    for (const id of round.participantIds) {
      const choice = round.actions[id]?.choice;
      const rank = round.rankings.find((h) => h.id === choice)?.rank;
      const amount = rank ? Math.max(1, 9 - rank) : 0;
      const safe = rank && rank <= 3;
      if (rank) points(state, id, round.gameType, amount, safe ? 1 : 0);
      results.push({
        userId: id,
        choice: choice ?? null,
        rank: rank ?? null,
        points: amount,
        safe: !!safe,
        missed: !rank,
        mustDrink: !!rank && !safe,
        drinks: !!rank && !safe ? 1 : 0,
        horseName: round.horses.find((h) => h.id === choice)?.name || null,
        reason: rank
          ? `อันดับ ${rank} · ${safe ? "รอด ไม่ต้องดื่ม" : "ต้องดื่ม 1 ครั้ง"}`
          : "ไม่ได้เลือก · ไม่คิดผลรอบนี้",
      });
    }
    round.result = {
      title: `${round.rankings[0].name} เข้าเส้นชัย!`,
      description:
        "ม้าอันดับ 1–3 รอด · อันดับ 4–8 ดื่ม 1 ครั้ง · ไม่ได้เลือกไม่คิดผล",
      players: results,
      drinkerIds: results.filter((p) => p.mustDrink).map((p) => p.userId),
      safeIds: results.filter((p) => p.safe).map((p) => p.userId),
      gurus: (round.gurus || []).map((g) => ({
        ...g,
        rank: round.rankings.find((h) => h.id === g.pickId)?.rank,
        hit: round.rankings.find((h) => h.id === g.pickId)?.rank <= 3,
      })),
    };
    for (const player of results)
      if (player.mustDrink)
        state.scores[player.userId].drinks =
          (state.scores[player.userId].drinks || 0) + 1;
  } else if (round.gameType === "MINORITY_VOTE") {
    const values = Object.values(round.actions);
    const a = values.filter((v) => v.choice === "A").length;
    const b = values.filter((v) => v.choice === "B").length;
    const complete = values.length === round.participantIds.length;
    const pair = round.mode === "MATCH";
    for (const id of round.participantIds) {
      const choice = round.actions[id]?.choice;
      const missed = !choice || (pair && !complete);
      const safe =
        !missed &&
        (pair
          ? a === 2 || b === 2
          : a === b || (choice === "A" ? a > b : b > a));
      const amount = safe ? 1 : 0;
      if (!missed) points(state, id, round.gameType, amount, safe ? 1 : 0);
      results.push({
        userId: id,
        choice: choice ?? null,
        points: amount,
        safe,
        missed,
        reason: missed
          ? "ส่งไม่ครบ · ไม่คิดผล"
          : pair
            ? safe
              ? "ใจตรงกัน!"
              : "คนละใจ ไว้ลองใหม่"
            : a === b
              ? "เสมอ รอดทั้งวง"
              : safe
                ? "อยู่ฝั่งมาก"
                : "อยู่ฝั่งน้อย",
      });
    }
    round.result = {
      title: pair
        ? !complete
          ? "รอบนี้ยังส่งไม่ครบ"
          : a === 2 || b === 2
            ? "ใจตรงกัน!"
            : "ต่างคนต่างใจ"
        : a === b
          ? "เสมอ รอดทั้งวง!"
          : `ฝั่ง ${a > b ? "A" : "B"} มาเยอะกว่า`,
      description: pair
        ? "ลองเล่าให้กันฟังว่าทำไมถึงเลือกข้างนี้"
        : "ฝั่งน้อยมีเหตุผลอะไร? เล่าให้วงฟังหน่อย",
      a,
      b,
      players: results,
    };
  } else {
    const ordered = Object.entries(round.actions).sort(
      (a, b) => a[1].order - b[1].order,
    );
    for (const id of round.participantIds) {
      const action = round.actions[id];
      const safe =
        !!action && action.order > 1 && action.order <= round.quota + 1;
      const bonus = safe && action.order === round.quota + 1;
      const amount = safe ? (bonus ? 2 : 1) : 0;
      // Absent input is a skipped personal round, not an automatic penalty.
      if (action) points(state, id, round.gameType, amount, safe ? 1 : 0);
      results.push({
        userId: id,
        order: action?.order ?? null,
        safe,
        missed: !action,
        points: amount,
        reason: !action
          ? "ไม่ได้กด · ไม่คิดผล"
          : action.order === 1
            ? "คนแรกหลุด!"
            : safe
              ? bonus
                ? "ที่รอดสุดท้าย · โบนัส +1"
                : "อยู่ในโควต้ารอด"
              : "ที่รอดเต็มแล้ว",
      });
    }
    round.result = {
      title: "ใครรอเป็น ใครโดดทัน?",
      description: `รอดลำดับ 2–${round.quota + 1} · รอด +1 ดาว · ที่รอดสุดท้าย +2 ดาว`,
      players: results,
      order: ordered.map(([id]) => id),
    };
  }
  round.finishedAt = now;
  delete round.frames;
  state.phase = "RESULTS";
  state.history.push({
    id: round.id,
    number: state.roundNumber,
    gameType: round.gameType,
    mode: round.mode,
    title: round.result.title,
    skipped,
    players: round.result.players,
  });
  state.history = state.history.slice(-18);
  state.ready = [];
}

export function advanceState(state, now) {
  if (!state.round) return false;
  const round = state.round;
  if (state.phase === "FORBIDDEN") {
    if (round.endsAt && now >= round.endsAt) {
      finish(state, now);
      return true;
    }
    return advanceForbidden(state, now);
  }
  if (state.phase === "INPUT" && now >= round.deadlineAt) {
    if (round.gameType === "HORSE_RACE") {
      const simulation = simulateRace(round.horses);
      round.frames = simulation.frames
        .filter(
          (_, index) =>
            index % 2 === 1 || index === simulation.frames.length - 1,
        )
        .map((f) => f.horses.map((h) => [h.horseId, h.distance, h.event]));
      round.rankings = simulation.rankings.map((h) => ({
        id: h.id,
        name: h.name,
        rank: h.rank,
      }));
      round.raceStartedAt = now;
      round.raceEndsAt = now + 12000;
      state.phase = "RACING";
    } else finish(state, now);
    return true;
  }
  if (state.phase === "RACING" && now >= round.raceEndsAt) {
    finish(state, now);
    return true;
  }
  return false;
}

function startRound(state, ctx) {
  const available = ctx.members.filter(
    (p) => p.online && !state.sittingOut.includes(p.id),
  );
  const participants = available.filter(
    (p) => state.ready.includes(p.id) || p.id === ctx.hostId,
  );
  const config = state.config;
  const sequence =
    participants.length === 2
      ? ["MINORITY_VOTE", "MINORITY_VOTE", "HORSE_RACE"]
      : [
          "MINORITY_VOTE",
          "MINORITY_VOTE",
          "HORSE_RACE",
          "PANIC_JUMP",
          "PANIC_JUMP",
          "PANIC_JUMP",
        ];
  const type =
    config.gameType === "MIXED"
      ? sequence[state.roundNumber % sequence.length]
      : config.gameType;
  const game = GAMES.find((g) => g.type === type);
  if (participants.length < game.minPlayers)
    fail(`เกมนี้ต้องมีคนพร้อมอย่างน้อย ${game.minPlayers} คน`);
  if (available.some((p) => !state.ready.includes(p.id) && p.id !== ctx.hostId))
    fail("รอให้เพื่อนที่ออนไลน์กดพร้อม หรือให้เพื่อนกดพักก่อน");
  if (type === "FORBIDDEN_WORD") {
    startForbidden(state, participants, ctx.now);
    return;
  }
  state.roundNumber++;
  const startsAt = ctx.now + (type === "PANIC_JUMP" ? 3000 : 1000);
  const round = {
    id: randomUUID(),
    gameType: type,
    mode:
      type === "MINORITY_VOTE" && participants.length === 2 ? "MATCH" : "PARTY",
    participantIds: participants.map((p) => p.id),
    actions: {},
    startsAt,
    deadlineAt:
      startsAt +
      (type === "PANIC_JUMP" ? 8000 : type === "HORSE_RACE" ? 45000 : 20000),
  };
  if (type === "MINORITY_VOTE") {
    round.question =
      state.customQuestion ||
      pickQuestion(config.category, state.seen, round.mode === "MATCH");
    delete state.customQuestion;
    state.seen.push(round.question.id);
    state.seen = state.seen.slice(-120);
  } else if (type === "HORSE_RACE") {
    round.horses = makeHorseField();
    round.gurus = makeGurus(round.id, round.horses);
  } else round.quota = Math.max(1, Math.floor((participants.length - 1) / 2));
  state.round = round;
  state.phase = "INPUT";
}

export function applyCommand(original, command, ctx) {
  const state = structuredClone(original || initialState());
  const { type, roundId } = command;
  if (!ctx.members.some((p) => p.id === ctx.userId))
    fail("คุณไม่ได้อยู่ในวงนี้", "NOT_MEMBER");
  if (
    !command.commandId ||
    typeof command.commandId !== "string" ||
    command.commandId.length > 80
  )
    fail("รหัสคำสั่งไม่ถูกต้อง");
  if (state.commands.includes(command.commandId))
    return { state, changed: false };
  for (const member of ctx.members)
    state.profiles[member.id] = {
      id: member.id,
      username: member.username,
      avatar: member.avatar,
    };
  advanceState(state, ctx.now);
  const hostOnly = [
    "CONFIG",
    "CUSTOM_QUESTION",
    "START",
    "NEXT",
    "PAUSE",
    "RESUME",
    "SKIP",
    "END",
    "RESET",
    "CLOSE_INPUT",
    "FORBIDDEN_SETTINGS",
    "FORBIDDEN_ADD_CATEGORY",
  ];
  if (hostOnly.includes(type) && ctx.hostId !== ctx.userId)
    fail("เฉพาะเจ้าวงเท่านั้น", "HOST_ONLY");
  const liveWordControl =
    state.round?.gameType === "FORBIDDEN_WORD" &&
    ["END", "PAUSE", "RESUME"].includes(type);
  if (liveWordControl && command.roundId !== state.round.id)
    fail("เกมนี้เปลี่ยนไปแล้ว", "STALE_ROUND");
  // Clock/prompt updates must not invalidate a confirmed control for this same
  // continuous session. Ordinary game/config controls retain revision checks.
  if (
    hostOnly.includes(type) &&
    !liveWordControl &&
    command.expectedRevision !== ctx.revision
  )
    fail("วงเปลี่ยนสถานะแล้ว ลองอีกครั้ง", "STALE_STATE");
  if (
    ["CHOOSE", "VOTE", "JUMP", "SKIP"].includes(type) &&
    roundId !== state.round?.id
  )
    fail("รอบนี้จบไปแล้ว", "STALE_ROUND");
  switch (type) {
    case "FORBIDDEN_SETTINGS":
    case "FORBIDDEN_ADD_CATEGORY":
      configureForbidden(state, command, ctx);
      break;
    case "FORBIDDEN_JOIN":
    case "FORBIDDEN_KILL":
    case "FORBIDDEN_RESET":
    case "FORBIDDEN_REST":
    case "FORBIDDEN_REVIEW":
    case "FORBIDDEN_VOID":
      forbiddenCommand(state, command, ctx);
      break;
    case "CUSTOM_QUESTION":
      if (!["LOBBY", "RESULTS"].includes(state.phase))
        fail("เขียนคำถามได้ระหว่างรอบ");
      if (
        ![command.question, command.optionA, command.optionB].every(
          (v) => typeof v === "string" && v.trim(),
        ) ||
        command.question.length > 140 ||
        command.optionA.length > 70 ||
        command.optionB.length > 70
      )
        fail("คำถามไม่เกิน 140 ตัวอักษร ตัวเลือกละไม่เกิน 70 ตัวอักษร");
      state.customQuestion = {
        id: `custom-${randomUUID()}`,
        category: "custom",
        question: command.question.trim(),
        optionA: command.optionA.trim(),
        optionB: command.optionB.trim(),
      };
      state.config.gameType = "MINORITY_VOTE";
      break;
    case "CONFIG": {
      if (!["LOBBY", "RESULTS"].includes(state.phase))
        fail("เปลี่ยนการตั้งค่าได้ระหว่างรอบ");
      if (!GAMES.some((g) => g.type === command.gameType)) fail("ไม่พบเกมนี้");
      if (![3, 6, 9].includes(command.totalRounds))
        fail("เลือกรอบ 3, 6 หรือ 9");
      if (!["all", "warmup", "friends", "chaos"].includes(command.category))
        fail("หมวดคำถามไม่ถูกต้อง");
      state.config = {
        gameType: command.gameType,
        totalRounds: command.totalRounds,
        category: command.category,
      };
      if (command.gameType === "FORBIDDEN_WORD") ensureForbiddenConfig(state);
      break;
    }
    case "READY":
      if (!["LOBBY", "RESULTS"].includes(state.phase))
        fail("กดพร้อมได้ระหว่างรอบ");
      state.ready = state.ready.filter((id) => id !== ctx.userId);
      state.sittingOut = state.sittingOut.filter((id) => id !== ctx.userId);
      if (command.ready !== false) state.ready.push(ctx.userId);
      else state.sittingOut.push(ctx.userId);
      break;
    case "START":
      if (state.phase !== "LOBBY") fail("วงเริ่มไปแล้ว");
      startRound(state, ctx);
      break;
    case "NEXT":
      if (state.phase !== "RESULTS") fail("รอเฉลยรอบนี้ก่อน");
      if (state.roundNumber >= state.config.totalRounds) {
        state.phase = "FINISHED";
        break;
      }
      startRound(state, ctx);
      break;
    case "CLOSE_INPUT":
      if (state.phase !== "INPUT" || state.round?.gameType !== "HORSE_RACE")
        fail("ยังเริ่มแข่งไม่ได้");
      if (
        Object.keys(state.round.actions).length <
        state.round.participantIds.length
      )
        fail("รอให้ทุกคนเลือกก่อน");
      state.round.deadlineAt = ctx.now;
      advanceState(state, ctx.now);
      break;
    case "CHOOSE":
    case "VOTE":
    case "JUMP": {
      const round = state.round;
      if (
        state.phase !== "INPUT" ||
        ctx.now < round.startsAt ||
        ctx.now >= round.deadlineAt
      )
        fail("รอบนี้ยังไม่เริ่มหรือหมดเวลาแล้ว", "OUTSIDE_WINDOW");
      if (!round.participantIds.includes(ctx.userId))
        fail("คุณจะได้เล่นรอบถัดไป");
      if (type === "CHOOSE") {
        if (
          round.gameType !== "HORSE_RACE" ||
          !round.horses.some((h) => h.id === command.choice)
        )
          fail("เลือกม้าไม่ถูกต้อง");
        round.actions[ctx.userId] = { choice: command.choice };
      } else if (type === "VOTE") {
        if (
          round.gameType !== "MINORITY_VOTE" ||
          !["A", "B"].includes(command.choice)
        )
          fail("เลือกข้างไม่ถูกต้อง");
        round.actions[ctx.userId] = { choice: command.choice };
      } else {
        if (round.gameType !== "PANIC_JUMP") fail("ไม่ใช่รอบกระโดด");
        if (round.actions[ctx.userId]) break;
        round.actions[ctx.userId] = {
          order: Object.keys(round.actions).length + 1,
          at: ctx.now,
        };
      }
      if (
        type !== "CHOOSE" &&
        Object.keys(round.actions).length === round.participantIds.length
      )
        finish(state, ctx.now);
      break;
    }
    case "PAUSE":
      if (!["LOBBY", "RESULTS", "FORBIDDEN"].includes(state.phase))
        fail("พักวงได้หลังเฉลย หรือข้ามรอบก่อน");
      if (state.phase === "FORBIDDEN") pauseForbidden(state, ctx.now);
      state.resumePhase = state.phase;
      state.phase = "PAUSED";
      break;
    case "RESUME":
      if (state.phase !== "PAUSED") fail("วงไม่ได้พักอยู่");
      if (state.resumePhase === "FORBIDDEN") resumeForbidden(state, ctx.now);
      state.phase = state.resumePhase || "LOBBY";
      break;
    case "SKIP":
      if (state.phase === "FORBIDDEN")
        fail("เกมคำต้องห้ามใช้ปุ่มจบเกมเพื่อเก็บผล");
      if (!ACTIVE.includes(state.phase)) fail("ไม่มีรอบให้ข้าม");
      finish(state, ctx.now, true);
      break;
    case "END":
      if (
        state.round?.gameType === "FORBIDDEN_WORD" &&
        (state.phase === "FORBIDDEN" ||
          (state.phase === "PAUSED" && state.resumePhase === "FORBIDDEN"))
      ) {
        finish(state, ctx.now);
        break;
      }
      if (ACTIVE.includes(state.phase)) finish(state, ctx.now, true);
      state.phase = "FINISHED";
      break;
    case "RESET": {
      if (state.phase !== "FINISHED") fail("จบวงก่อนเริ่มใหม่");
      const fresh = initialState();
      fresh.config = state.config;
      fresh.profiles = state.profiles;
      if (state.forbiddenConfig) fresh.forbiddenConfig = state.forbiddenConfig;
      Object.assign(state, fresh);
      break;
    }
    default:
      fail("คำสั่งไม่ถูกต้อง");
  }
  state.commands.push(command.commandId);
  state.commands = state.commands.slice(-128);
  return { state, changed: true };
}

// A separate projection for each player prevents leaking unrevealed votes or
// millisecond jump ordering. Private runtime never leaves the server wholesale.
export function projectState(state, userId) {
  const result = structuredClone(state || initialState());
  if (result.config.gameType === "FORBIDDEN_WORD")
    ensureForbiddenConfig(result);
  delete result.commands;
  delete result.seen;
  if (result.round) {
    const round = result.round;
    round.submitted = Object.keys(round.actions).length;
    round.myAction = round.actions[userId] || null;
    if (round.gameType === "HORSE_RACE") {
      round.horses = round.horses.map(presentHorse);
      round.gurus ||= makeGurus(round.id, round.horses);
      if (round.result && !round.result.skipped)
        round.result.gurus ||= round.gurus.map((g) => {
          const rank = round.rankings.find((h) => h.id === g.pickId)?.rank;
          return { ...g, rank, hit: rank <= 3 };
        });
      round.picks = Object.entries(round.actions).map(([id, value]) => ({
        userId: id,
        horseId: value.choice,
      }));
    }
    if (result.phase === "INPUT") {
      if (round.gameType === "HORSE_RACE") {
        round.horses.forEach((h) => {
          delete h.speed;
          delete h.stamina;
          delete h.luck;
        });
      }
      delete round.actions;
    }
  }
  projectForbidden(result, userId);
  return result;
}
