import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  applyCommand,
  advanceState,
  projectState,
} from "../src/party/engine.js";
import {
  ROTATION_MS,
  nextForbiddenDeadline,
  defaultForbiddenConfig,
} from "../src/party/forbiddenWords.js";
function game(n = 3, options = {}) {
  let state = initialState(),
    revision = 0,
    counter = 0;
  state.config.gameType = "FORBIDDEN_WORD";
  state.forbiddenConfig = { ...defaultForbiddenConfig(), ...options };
  const ctx = {
    now: 100000,
    userId: "p0",
    hostId: "p0",
    members: Array.from({ length: n }, (_, i) => ({
      id: `p${i}`,
      username: `Friend ${i}`,
      online: true,
    })),
  };
  state.ready = ctx.members.map((m) => m.id);
  function send(type, payload = {}, userId = "p0") {
    const answer = applyCommand(
      state,
      {
        type,
        commandId: `c${++counter}`,
        expectedRevision: revision,
        roundId: state.round?.id,
        ...payload,
      },
      { ...ctx, userId, revision },
    );
    state = answer.state;
    if (answer.changed) revision++;
    return answer;
  }
  send("START");
  ctx.now += 5001;
  const capture = (targetId = "p1") => ({
    targetId,
    generation: state.round.assignments[targetId].generation,
    wordId: state.round.assignments[targetId].words[0].id,
  });
  return {
    get state() {
      return state;
    },
    ctx,
    send,
    capture,
  };
}
test("own word and word-bank are absent from every live snapshot, including the host", () => {
  const t = game(10, { wordCount: 2 });
  const all = Object.values(t.state.round.assignments).flatMap((a) =>
    a.words.map((w) => w.text),
  );
  assert.equal(new Set(all).size, 20);
  for (const m of t.ctx.members) {
    const view = projectState(t.state, m.id);
    assert.equal(view.round.assignments[m.id].words, undefined);
    assert.equal(view.round.recent, undefined);
    assert.equal(view.round.burned, undefined);
    assert.ok(
      view.forbiddenConfig.categories.every((c) => !c.words && c.wordCount),
    );
    for (const w of t.state.round.assignments[m.id].words)
      assert.ok(!JSON.stringify(view).includes(`"${w.text}"`));
    assert.equal(
      view.round.assignments[m.id === "p0" ? "p1" : "p0"].words.length,
      2,
    );
  }
  const observer = projectState(t.state, "observer");
  assert.ok(Object.values(observer.round.assignments).every((a) => !a.words));
});
test("180-second rotation, five-second grace and serialized recovery use persisted deadlines", () => {
  assert.equal(ROTATION_MS, 180000);
  const t = game();
  const a = t.state.round.assignments.p1,
    old = a.words[0].text,
    original = a.generation;
  assert.equal(a.rotateAt - a.assignedAt, 180000);
  assert.equal(a.activeAt - a.assignedAt, 5000);
  assert.equal(nextForbiddenDeadline(t.state), t.state.round.promptAt);
  const restored = JSON.parse(JSON.stringify(t.state));
  advanceState(restored, a.rotateAt - 1);
  assert.equal(restored.round.assignments.p1.generation, original);
  advanceState(restored, a.rotateAt);
  assert.notEqual(restored.round.assignments.p1.generation, original);
  assert.notEqual(restored.round.assignments.p1.words[0].text, old);
  assert.equal(restored.round.assignments.p1.activeAt, a.rotateAt + 5000);
});
test("two-word capture records exactly one penalty and stale or duplicate captures cannot add scores", () => {
  const t = game(3, { wordCount: 2 });
  const payload = t.capture();
  t.send("FORBIDDEN_KILL", payload);
  assert.equal(t.state.round.stats.p0.kills, 1);
  assert.equal(t.state.round.stats.p1.hits, 1);
  assert.equal(t.state.round.assignments.p1.status, "HIT");
  assert.throws(() => t.send("FORBIDDEN_KILL", payload, "p2"));
  assert.equal(t.state.round.stats.p1.hits, 1);
  const view = projectState(t.state, "p1");
  assert.ok(view.round.assignments.p1.lastHit.words.length === 2);
  assert.equal(view.round.assignments.p1.words, undefined);
  t.send("FORBIDDEN_RESET", { generation: payload.generation }, "p1");
  const after = t.state.round.assignments.p1;
  assert.equal(after.status, "ACTIVE");
  assert.throws(() => t.send("FORBIDDEN_KILL", payload));
  assert.ok(
    !after.words.some((w) =>
      view.round.assignments.p1.lastHit.words.includes(w.text),
    ),
  );
});
test("grace, self captures, offline targets, rest and foreign session actions are rejected", () => {
  const t = game();
  const payload = t.capture();
  t.ctx.now = t.state.round.startsAt + 4999;
  assert.throws(() => t.send("FORBIDDEN_KILL", payload));
  t.ctx.now += 2;
  assert.throws(() => t.send("FORBIDDEN_KILL", t.capture("p0")));
  t.ctx.members[1].online = false;
  assert.throws(() => t.send("FORBIDDEN_KILL", payload));
  t.ctx.members[1].online = true;
  assert.throws(() =>
    t.send("FORBIDDEN_KILL", { ...payload, roundId: "other" }),
  );
  t.send("FORBIDDEN_REST", { resting: true }, "p1");
  assert.throws(() => t.send("FORBIDDEN_KILL", payload));
});
test("personal rest and global pause freeze clocks and allow a full grace period on resume", () => {
  const t = game();
  const original = t.state.round.assignments.p1.rotateAt;
  t.send("FORBIDDEN_REST", { resting: true }, "p1");
  t.ctx.now += 10000;
  advanceState(t.state, t.ctx.now);
  t.send("FORBIDDEN_REST", { resting: false }, "p1");
  assert.equal(t.state.round.assignments.p1.rotateAt, original + 10000);
  const ends = t.state.round.endsAt,
    rotate = t.state.round.assignments.p1.rotateAt;
  t.send("PAUSE");
  t.ctx.now += 60000;
  assert.equal(advanceState(t.state, t.ctx.now), false);
  t.send("RESUME");
  assert.equal(t.state.phase, "FORBIDDEN");
  assert.equal(t.state.round.endsAt, ends + 60000);
  assert.equal(t.state.round.assignments.p1.rotateAt, rotate + 60000);
  assert.equal(t.state.round.assignments.p1.activeAt, t.ctx.now + 5000);
});
test("only host can replace an active word or void; a void never overwrites a newer assignment", () => {
  const t = game();
  const payload = t.capture();
  assert.throws(() =>
    t.send("FORBIDDEN_RESET", { generation: payload.generation }, "p1"),
  );
  t.send("FORBIDDEN_KILL", payload);
  const event = t.state.round.events.find((e) => e.type === "KILL");
  t.send("FORBIDDEN_REVIEW", { eventId: event.id }, "p1");
  assert.equal(
    t.state.round.events.find((e) => e.id === event.id).disputed,
    true,
  );
  t.send("FORBIDDEN_RESET", { generation: payload.generation }, "p1");
  const generation = t.state.round.assignments.p1.generation;
  assert.throws(() => t.send("FORBIDDEN_VOID", { eventId: event.id }, "p2"));
  t.send("FORBIDDEN_VOID", { eventId: event.id });
  assert.equal(t.state.round.stats.p0.kills, 0);
  assert.equal(t.state.round.stats.p1.hits, 0);
  assert.equal(t.state.round.assignments.p1.generation, generation);
  assert.throws(() => t.send("FORBIDDEN_VOID", { eventId: event.id }));
});
test("a fresh voided capture gets replacement words because the old words were revealed", () => {
  const t = game();
  const payload = t.capture();
  t.send("FORBIDDEN_KILL", payload);
  const event = t.state.round.events.find((e) => e.type === "KILL");
  t.send("FORBIDDEN_VOID", { eventId: event.id });
  assert.notEqual(t.state.round.assignments.p1.generation, payload.generation);
  assert.equal(t.state.round.assignments.p1.status, "ACTIVE");
});
test("host can add a custom category with aliases during play without disclosing the pool", () => {
  const t = game();
  assert.throws(() =>
    t.send("FORBIDDEN_ADD_CATEGORY", { name: "ส่วนตัว", lines: "พิเศษ" }, "p1"),
  );
  t.send("FORBIDDEN_ADD_CATEGORY", {
    name: "เฉพาะวง",
    lines: "คำเฉพาะ | คำขยาย\nคำใหม่\nคำใหม่",
  });
  const cat = t.state.forbiddenConfig.categories.at(-1);
  assert.equal(cat.words.length, 2);
  assert.deepEqual(cat.words[0].aliases, ["คำขยาย"]);
  const view = projectState(t.state, "p0");
  assert.equal(view.forbiddenConfig.categories.at(-1).wordCount, 2);
  assert.equal(view.forbiddenConfig.categories.at(-1).words, undefined);
  assert.throws(() => t.send("FORBIDDEN_SETTINGS", { durationMinutes: 0 }));
});
test("exhaustion waits for a new pool and late players must explicitly join", () => {
  const t = game(2);
  t.ctx.members.push({ id: "late", username: "Late", online: true });
  assert.throws(() => t.send("FORBIDDEN_KILL", t.capture(), "late"));
  t.send("FORBIDDEN_JOIN", {}, "late");
  assert.equal(t.state.round.assignments.late.status, "ACTIVE");
  t.send("FORBIDDEN_SETTINGS", { enabledCategories: [] });
  t.send("FORBIDDEN_RESET", {
    targetId: "p1",
    generation: t.state.round.assignments.p1.generation,
  });
  assert.equal(t.state.round.assignments.p1.status, "WAITING_WORDS");
  t.send("FORBIDDEN_ADD_CATEGORY", {
    name: "คำสำรอง",
    lines: "สำรองหนึ่ง\nสำรองสอง\nสำรองสาม\nสำรองสี่",
  });
  t.send(
    "FORBIDDEN_RESET",
    { generation: t.state.round.assignments.p1.generation },
    "p1",
  );
  assert.equal(t.state.round.assignments.p1.status, "ACTIVE");
});
test("host can replace a resting word without breaking the resumed rotation clock", () => {
  const t = game();
  t.send("FORBIDDEN_REST", { resting: true }, "p1");
  t.send("FORBIDDEN_RESET", {
    targetId: "p1",
    generation: t.state.round.assignments.p1.generation,
  });
  const rotateAt = t.state.round.assignments.p1.rotateAt;
  t.ctx.now += 10000;
  t.send("FORBIDDEN_REST", { resting: false }, "p1");
  assert.equal(t.state.round.assignments.p1.rotateAt, rotateAt + 10000);
});

test("end and expiry score once, and ending while paused preserves valid captures", () => {
  const t = game();
  t.send("FORBIDDEN_KILL", t.capture());
  t.send("PAUSE");
  t.send("END");
  assert.equal(t.state.phase, "FINISHED");
  assert.equal(t.state.scores.p0.FORBIDDEN_WORD, 1);
  assert.equal(t.state.scores.p1.penalties, 1);
  assert.equal(
    t.state.round.result.players.find((p) => p.userId === "p1").hits,
    1,
  );
  const scores = JSON.stringify(t.state.scores);
  t.send("END");
  assert.equal(JSON.stringify(t.state.scores), scores);
  const exp = game();
  advanceState(exp.state, exp.state.round.endsAt);
  assert.equal(exp.state.phase, "FINISHED");
  assert.equal(advanceState(exp.state, exp.state.round.endsAt + 1000), false);
});

test("timer-only revisions do not invalidate pause/end but old session IDs still fail", () => {
  const t = game();
  t.send("PAUSE", { expectedRevision: -1 });
  t.send("RESUME", { expectedRevision: -1 });
  assert.throws(() =>
    t.send("END", { expectedRevision: -1, roundId: "old-session" }),
  );
  t.send("END", { expectedRevision: -1 });
  assert.equal(t.state.phase, "FINISHED");
});
