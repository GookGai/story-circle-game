import { randomUUID } from "node:crypto";

export const ROTATION_MS = 180000;
export const GRACE_MS = 5000;
const PROMPT_MS = 45000;
const normalize = (text) =>
  text.normalize("NFKC").trim().toLocaleLowerCase("th");
const error = (message, code = "INVALID_ACTION") => {
  const e = new Error(message);
  e.code = code;
  throw e;
};
const decks = [
  [
    "food",
    "ของกิน",
    "กาแฟ,ชาบู,หมูกระทะ,ส้มตำ,ไข่เจียว,ข้าวผัด,ก๋วยเตี๋ยว,พิซซ่า,น้ำแข็ง,กับแกล้ม,เฟรนช์ฟรายส์,ไก่ทอด,ปลาเผา,ต้มยำ,หมูกรอบ,ขนม,หิว,อิ่ม,เผ็ด,อร่อย",
  ],
  [
    "work",
    "ชีวิตออฟฟิศ",
    "ประชุม,หัวหน้า,เดดไลน์,เงินเดือน,ลาออก,วันหยุด,ลูกค้า,อีเมล,เอกสาร,ทำงาน,โอที,โปรเจกต์,โบนัส,ลา,สาย,ลืม,พรุ่งนี้,วันนี้,เหนื่อย,พัก",
  ],
  [
    "friends",
    "เรื่องของเพื่อน",
    "เพื่อน,แฟน,แฟนเก่า,โสด,คิดถึง,รัก,แต่งงาน,เดต,ทัก,โทร,ไลน์,กลุ่ม,ขำ,กลับบ้าน,นอน,ตื่น,เที่ยว,รูป,ถ่าย,จำได้",
  ],
  [
    "table",
    "วงเล่นเกม",
    "ตบมือ,เริ่มใหม่,สลับที่,ห้องน้ำ,โต๊ะ,เก้าอี้,การ์ด,ลูกเต๋า,จาน,ช้อน,ขนม,เพลง,นักร้อง,เสียงดัง,เต้น,เพื่อนบ้าน,โซฟา,คะแนน,แบ่งทีม,รอ",
  ],
  [
    "travel",
    "เที่ยวไหนดี",
    "ทะเล,ภูเขา,โรงแรม,สนามบิน,เครื่องบิน,รถไฟ,รถติด,ฝนตก,ร้อน,หนาว,เชียงใหม่,กรุงเทพ,ญี่ปุ่น,เกาหลี,พาสปอร์ต,กระเป๋า,เดิน,ขับรถ,หลง,แผน",
  ],
  [
    "common",
    "คำติดปาก",
    "จริง,ใช่,ไม่ใช่,อะไร,ทำไม,เดี๋ยว,โอเค,แน่นอน,สุดยอด,ดีมาก,ไม่ได้,ไม่รู้,เออ,แบบว่า,เหมือน,แล้วไง,มาก,นิดนึง,ขอบคุณ,ขอโทษ",
  ],
];
const prompts = [
  "เล่าเมนูที่อยากกินตอนนี้ให้เพื่อนฟัง",
  "วันนี้มีเรื่องอะไรอยากบ่นให้วงฟังบ้าง",
  "ถ้าพรุ่งนี้หยุด จะชวนวงนี้ไปไหน",
  "เล่าเรื่องตลกที่เกิดขึ้นกับคุณเมื่อเร็ว ๆ นี้",
  "ถ้าได้เปิดร้านกับเพื่อนในวง จะขายอะไร",
  "เพลงไหนที่อยากให้ร้านเปิดตอนนี้",
  "ทริปไหนที่อยากกลับไปอีกครั้ง",
  "ใครในวงน่าจะจัดทริปเก่งที่สุด เพราะอะไร",
  "เล่าความสามารถแปลก ๆ ของตัวเองหนึ่งอย่าง",
  "ถ้าได้หยุดยาวหนึ่งเดือน จะทำอะไร",
  "อาหารที่เคยกินแล้วจำไม่ลืมคืออะไร",
  "เล่าเรื่องที่เพื่อนในวงยังไม่เคยรู้เกี่ยวกับคุณ",
];

export function defaultForbiddenConfig() {
  return {
    builtinDeckVersion: 2,
    durationMinutes: 10,
    wordCount: 1,
    autoRotate: true,
    prompts: true,
    enabledCategories: ["food", "work", "friends", "table"],
    categories: decks.map(([id, name, text]) => ({
      id,
      name,
      custom: false,
      words: text
        .split(",")
        .map((word, i) => ({ id: `${id}-${i}`, text: word, aliases: [] })),
    })),
  };
}
export function ensureForbiddenConfig(state) {
  const config = (state.forbiddenConfig ||= defaultForbiddenConfig());
  if (config.builtinDeckVersion !== 2) {
    const defaults = new Map(defaultForbiddenConfig().categories.map((c) => [c.id, c]));
    config.categories = config.categories.map((c) =>
      c.custom === false && defaults.has(c.id) ? defaults.get(c.id) : c,
    );
    config.builtinDeckVersion = 2;
  }
  return config;
}
const tokens = (w) => [w.text, ...w.aliases].map(normalize);
const conflicts = (w, used) => tokens(w).some((t) => used.has(t));
function pool(state) {
  const c = ensureForbiddenConfig(state);
  return c.categories
    .filter((cat) => c.enabledCategories.includes(cat.id))
    .flatMap((cat) => cat.words.map((w) => ({ ...w, category: cat.name })));
}
function record(round, entry, now) {
  round.events.push({ id: randomUUID(), at: now, ...entry });
  round.events = round.events.slice(-100);
}
function assign(state, userId, now, reason) {
  const r = state.round,
    old = r.assignments[userId];
  const used = new Set(r.burned);
  old?.words?.flatMap(tokens).forEach((t) => used.add(t));
  for (const [id, a] of Object.entries(r.assignments))
    if (id !== userId && a.status === "ACTIVE")
      for (const w of a.words) tokens(w).forEach((t) => used.add(t));
  const recent = r.recent[userId] || [];
  recent.forEach((t) => used.add(t));
  const candidates = pool(state),
    words = [];
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  for (const w of candidates)
    if (!conflicts(w, used)) {
      words.push(w);
      tokens(w).forEach((t) => used.add(t));
      if (words.length === r.wordCount) break;
    }
  const active = words.length === r.wordCount;
  if (old?.words?.length)
    r.recent[userId] = [...old.words.flatMap(tokens), ...recent].slice(0, 12);
  r.assignments[userId] = {
    userId,
    generation: randomUUID(),
    status: active ? "ACTIVE" : "WAITING_WORDS",
    words: active ? words : [],
    assignedAt: now,
    activeAt: now + GRACE_MS,
    rotateAt: r.autoRotate ? now + ROTATION_MS : null,
    resting: old?.resting || false,
    ...(old?.resting ? { restedAt: now } : {}),
    lastHit: old?.lastHit || null,
  };
  if (active) record(r, { type: reason, userId }, now);
  return active;
}
export function startForbidden(state, participants, now) {
  const c = ensureForbiddenConfig(state);
  state.round = {
    id: randomUUID(),
    gameType: "FORBIDDEN_WORD",
    participantIds: participants.map((p) => p.id),
    actions: {},
    startsAt: now,
    endsAt: c.durationMinutes ? now + c.durationMinutes * 60000 : null,
    wordCount: c.wordCount,
    autoRotate: c.autoRotate,
    prompt: c.prompts ? prompts[0] : null,
    promptIndex: 0,
    promptAt: c.prompts ? now + PROMPT_MS : null,
    assignments: {},
    recent: {},
    burned: [],
    events: [],
    stats: {},
  };
  state.roundNumber++;
  for (const p of participants) {
    state.round.stats[p.id] = { kills: 0, hits: 0 };
    if (!assign(state, p.id, now, "JOIN"))
      error("คำไม่พอแจกไม่ซ้ำ ลองเปิดหมวดหรือเพิ่มคำก่อนเริ่ม");
  }
  state.phase = "FORBIDDEN";
}
export function nextForbiddenDeadline(state) {
  if (state.phase !== "FORBIDDEN") return null;
  const r = state.round;
  const times = [
    r.endsAt,
    r.promptAt,
    ...Object.values(r.assignments)
      .filter((a) => a.status === "ACTIVE" && !a.resting)
      .map((a) => a.rotateAt),
  ].filter((t) => Number.isFinite(t) && t > 0);
  return times.length ? Math.min(...times) : null;
}
export function advanceForbidden(state, now) {
  const r = state.round;
  let changed = false;
  for (const a of Object.values(r.assignments))
    if (
      a.status === "ACTIVE" &&
      !a.resting &&
      a.rotateAt &&
      now >= a.rotateAt
    ) {
      assign(state, a.userId, now, "ROTATE");
      changed = true;
    }
  if (r.promptAt && now >= r.promptAt) {
    r.promptIndex = (r.promptIndex + 1) % prompts.length;
    r.prompt = prompts[r.promptIndex];
    r.promptAt = now + PROMPT_MS;
    changed = true;
  }
  return changed;
}
export function pauseForbidden(state, now) {
  state.round.pausedAt = now;
}
export function resumeForbidden(state, now) {
  const r = state.round,
    delta = now - r.pausedAt;
  for (const key of ["endsAt", "promptAt"]) if (r[key]) r[key] += delta;
  for (const a of Object.values(r.assignments)) {
    a.activeAt = Math.max(now + GRACE_MS, a.activeAt + delta);
    if (a.rotateAt) a.rotateAt += delta;
    if (a.restedAt) a.restedAt += delta;
  }
  delete r.pausedAt;
}
export function removeForbiddenMember(state, userId) {
  if (state.round?.gameType !== "FORBIDDEN_WORD") return;
  delete state.round.assignments[userId];
  state.round.participantIds = state.round.participantIds.filter(
    (id) => id !== userId,
  );
}
export function configureForbidden(state, command, ctx) {
  const c = ensureForbiddenConfig(state);
  if (!["LOBBY", "FORBIDDEN", "PAUSED"].includes(state.phase))
    error("ตั้งค่าคำได้ก่อนเริ่มหรือระหว่างเกมคำต้องห้าม");
  if (state.phase === "PAUSED" && state.resumePhase !== "FORBIDDEN")
    error("วงไม่ได้เล่นคำต้องห้าม");
  if (command.type === "FORBIDDEN_ADD_CATEGORY") {
    if (
      typeof command.name !== "string" ||
      !command.name.trim() ||
      command.name.trim().length > 35
    )
      error("ชื่อหมวดต้องมี 1–35 ตัวอักษร");
    if (c.categories.length >= 18) error("เก็บได้สูงสุด 18 หมวดต่อวง");
    if (
      c.categories.some(
        (cat) => normalize(cat.name) === normalize(command.name),
      )
    )
      error("มีชื่อหมวดนี้แล้ว");
    if (typeof command.lines !== "string" || command.lines.length > 12000)
      error("ใส่รายการคำไม่เกิน 12,000 ตัวอักษร");
    const lines = command.lines
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      seen = new Set(),
      words = [];
    if (!lines.length || lines.length > 120) error("เพิ่มได้ครั้งละ 1–120 คำ");
    for (const line of lines) {
      const parts = line
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length > 5 || parts.some((p) => p.length > 40))
        error("คำละไม่เกิน 40 ตัวอักษร และคำที่นับรวมไม่เกิน 4 คำ");
      if (!parts[0]) continue;
      if (seen.has(normalize(parts[0]))) continue;
      seen.add(normalize(parts[0]));
      words.push({ id: randomUUID(), text: parts[0], aliases: parts.slice(1) });
    }
    const cat = {
      id: randomUUID(),
      name: command.name.trim(),
      custom: true,
      words,
    };
    c.categories.push(cat);
    c.enabledCategories.push(cat.id);
  } else {
    if (command.enabledCategories !== undefined) {
      if (
        !Array.isArray(command.enabledCategories) ||
        command.enabledCategories.some(
          (id) => !c.categories.some((cat) => cat.id === id),
        )
      )
        error("เลือกหมวดไม่ถูกต้อง");
      c.enabledCategories = [...new Set(command.enabledCategories)];
    }
    for (const [key, allowed] of Object.entries({
      durationMinutes: [0, 10, 15],
      wordCount: [1, 2],
      autoRotate: [true, false],
      prompts: [true, false],
    }))
      if (command[key] !== undefined) {
        if (state.phase !== "LOBBY") error("เปลี่ยนเวลาและโหมดได้ก่อนเริ่มเกม");
        if (!allowed.includes(command[key])) error("ตั้งค่าไม่ถูกต้อง");
        c[key] = command[key];
      }
  }
}
export function forbiddenCommand(state, command, ctx) {
  if (state.phase !== "FORBIDDEN") error("รอเริ่มเกมหรือกลับจากพักก่อน");
  const r = state.round;
  if (command.roundId !== r.id)
    error("เกมนี้จบหรือเปลี่ยนไปแล้ว", "STALE_ROUND");
  const caller = ctx.members.find((p) => p.id === ctx.userId);
  if (!caller?.online) error("กลับเข้าวงก่อน");
  const mine = r.assignments[ctx.userId],
    host = ctx.userId === ctx.hostId;
  if (command.type === "FORBIDDEN_JOIN") {
    if (mine) error("คุณอยู่ในเกมนี้แล้ว");
    r.participantIds.push(ctx.userId);
    r.stats[ctx.userId] ||= { kills: 0, hits: 0 };
    assign(state, ctx.userId, ctx.now, "JOIN");
    return;
  }
  if (command.type === "FORBIDDEN_KILL") {
    if (
      !mine ||
      mine.status !== "ACTIVE" ||
      mine.resting ||
      ctx.now < mine.activeAt
    )
      error("รับคำและรอพร้อมก่อนจับเพื่อน");
    const a = r.assignments[command.targetId];
    if (
      !a ||
      a.userId === ctx.userId ||
      !ctx.members.some((p) => p.id === a.userId && p.online) ||
      a.resting ||
      a.status !== "ACTIVE" ||
      ctx.now < a.activeAt
    )
      error("คนนี้ยังจับไม่ได้");
    if (a.generation !== command.generation)
      error("คำของเพื่อนเปลี่ยนแล้ว ตรวจคำใหม่ก่อนจับ", "STALE_WORD");
    const word = a.words.find((w) => w.id === command.wordId);
    if (!word) error("คำนี้เปลี่ยนไปแล้ว", "STALE_WORD");
    const entry = {
      type: "KILL",
      actorId: ctx.userId,
      targetId: a.userId,
      word: word.text,
      words: a.words.map((w) => w.text),
      generation: a.generation,
      voided: false,
      disputed: false,
    };
    record(r, entry, ctx.now);
    a.status = "HIT";
    a.lastHit = {
      at: ctx.now,
      actorId: ctx.userId,
      word: word.text,
      words: entry.words,
    };
    a.rotateAt = null;
    a.words.flatMap(tokens).forEach((t) => {
      if (!r.burned.includes(t)) r.burned.push(t);
    });
    r.stats[ctx.userId].kills++;
    r.stats[a.userId].hits++;
    return;
  }
  if (command.type === "FORBIDDEN_RESET") {
    const id = command.targetId || ctx.userId,
      a = r.assignments[id];
    if (!a || (!host && id !== ctx.userId))
      error("เปลี่ยนคำได้เฉพาะตัวเองหรือเจ้าวง");
    if (a.generation !== command.generation)
      error("คำเปลี่ยนไปแล้ว ตรวจสถานะล่าสุดก่อน", "STALE_WORD");
    if (!host && !["HIT", "WAITING_WORDS"].includes(a.status))
      error("ให้เจ้าวงเปลี่ยนคำที่หลุดให้");
    assign(state, id, ctx.now, "RESET");
    return;
  }
  if (command.type === "FORBIDDEN_REST") {
    if (!mine) error("รับคำเข้าวงก่อน");
    if (command.resting !== false && !mine.resting) {
      mine.resting = true;
      mine.restedAt = ctx.now;
    } else if (command.resting === false && mine.resting) {
      if (mine.rotateAt) mine.rotateAt += ctx.now - mine.restedAt;
      mine.activeAt = ctx.now + GRACE_MS;
      mine.resting = false;
      delete mine.restedAt;
    }
    return;
  }
  if (["FORBIDDEN_REVIEW", "FORBIDDEN_VOID"].includes(command.type)) {
    const e = r.events.find(
      (e) => e.id === command.eventId && e.type === "KILL",
    );
    if (!e || e.voided) error("รายการนี้ถูกยกเลิกหรือหมดประวัติแล้ว");
    if (command.type === "FORBIDDEN_REVIEW") {
      if (e.targetId !== ctx.userId) error("เจ้าตัวเท่านั้นที่ขอทบทวนได้");
      e.disputed = true;
      return;
    }
    if (!host) error("เฉพาะเจ้าวงที่ยกเลิกผลได้");
    e.voided = true;
    r.stats[e.actorId].kills--;
    r.stats[e.targetId].hits--;
    const a = r.assignments[e.targetId];
    if (a?.generation === e.generation)
      assign(state, e.targetId, ctx.now, "VOID_RESET");
    return;
  }
  error("คำสั่งเกมไม่ถูกต้อง");
}
export function forbiddenResult(state) {
  const r = state.round;
  return {
    title: "จบวงคำต้องห้าม",
    description: "คะแนนนักล่าและจำนวนโดนจับ · ไม่คิดโทษซ้ำตอนจบ",
    players: Object.entries(r.stats).map(([userId, s]) => ({
      userId,
      kills: s.kills,
      hits: s.hits,
      points: s.kills,
      reason: `จับได้ ${s.kills} · โดนจับ ${s.hits}`,
      safe: s.hits === 0,
    })),
  };
}
export function projectForbidden(result, userId) {
  const r = result.round;
  if (
    result.forbiddenConfig &&
    ["FORBIDDEN", "PAUSED", "FINISHED"].includes(result.phase)
  )
    result.forbiddenConfig.categories = result.forbiddenConfig.categories.map(
      ({ words, ...cat }) => ({ ...cat, wordCount: words.length }),
    );
  if (r?.gameType !== "FORBIDDEN_WORD") return;
  delete r.recent;
  delete r.burned;
  const participant = r.participantIds.includes(userId);
  for (const [id, a] of Object.entries(r.assignments)) {
    if (id === userId || !participant) delete a.words;
  }
}
