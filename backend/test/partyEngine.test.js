import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  applyCommand,
  advanceState,
  projectState,
} from "../src/party/engine.js";
import { QUESTIONS, pickQuestion } from "../src/party/questions.js";

const members = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    username: `Friend ${i}`,
    avatar: "cat",
    online: true,
  }));
function setup(n = 3, gameType = "MINORITY_VOTE") {
  let state = initialState();
  state.config.gameType = gameType;
  state.ready = members(n).map((p) => p.id);
  let revision = 0,
    counter = 0;
  const context = {
    userId: "p0",
    hostId: "p0",
    members: members(n),
    now: 100000,
    revision,
  };
  function send(type, payload = {}, ctx = {}) {
    const result = applyCommand(
      state,
      {
        type,
        commandId: `c${++counter}`,
        expectedRevision: revision,
        roundId: state.round?.id,
        ...payload,
      },
      { ...context, revision, ...ctx },
    );
    state = result.state;
    if (result.changed) revision++;
    return result;
  }
  send("START");
  context.now = state.round.startsAt + 1;
  return {
    send,
    get state() {
      return state;
    },
    context,
    get revision() {
      return revision;
    },
  };
}

test("120 distinct editorial questions and no repeat until each deck is exhausted", () => {
  assert.equal(QUESTIONS.length, 120);
  assert.equal(new Set(QUESTIONS.map((q) => q.id)).size, 120);
  assert.equal(new Set(QUESTIONS.map((q) => q.question)).size, 120);
  for (const category of ["warmup", "friends", "chaos", "match"]) {
    const seen = [];
    for (let i = 0; i < 30; i++) {
      const question = pickQuestion(category, seen, category === "match");
      assert.ok(!seen.includes(question.id));
      seen.push(question.id);
    }
  }
});

test("two players match together; result cannot score twice", () => {
  const t = setup(2);
  assert.equal(t.state.round.mode, "MATCH");
  t.send("VOTE", { choice: "A" });
  t.send("VOTE", { choice: "A" }, { userId: "p1" });
  assert.equal(t.state.phase, "RESULTS");
  assert.equal(t.state.scores.p0.MINORITY_VOTE, 1);
  assert.throws(() => t.send("VOTE", { choice: "B" }, { userId: "p1" }));
  assert.equal(t.state.scores.p0.MINORITY_VOTE, 1);
});

test("an absent vote in two-player mode is skipped, not a mismatch", () => {
  const t = setup(2);
  t.send("VOTE", { choice: "A" });
  advanceState(t.state, t.state.round.deadlineAt);
  assert.ok(
    t.state.round.result.players.every((p) => p.missed && p.points === 0),
  );
  assert.equal(Object.keys(t.state.scores).length, 0);
});

test("party vote hides choices until reveal and tie is safe", () => {
  const t = setup(4);
  t.send("VOTE", { choice: "A" });
  const projected = projectState(t.state, "p1");
  assert.equal(projected.round.actions, undefined);
  assert.equal(projected.round.myAction, null);
  assert.equal(projected.round.submitted, 1);
  assert.equal(projected.seen, undefined);
  assert.equal(projected.commands, undefined);
  for (const [id, choice] of [
    ["p1", "B"],
    ["p2", "A"],
    ["p3", "B"],
  ])
    t.send("VOTE", { choice }, { userId: id });
  assert.ok(t.state.round.result.players.every((p) => p.safe));
});

test("10 jumps get unique order and result points match the scoreboard", () => {
  const t = setup(10, "PANIC_JUMP");
  assert.equal(t.state.round.quota, 4);
  for (let i = 0; i < 10; i++)
    t.send("JUMP", {}, { userId: `p${i}`, now: t.context.now + i });
  assert.equal(t.state.phase, "RESULTS");
  assert.equal(
    new Set(Object.values(t.state.round.actions).map((a) => a.order)).size,
    10,
  );
  for (const row of t.state.round.result.players)
    assert.equal(row.points, t.state.scores[row.userId].PANIC_JUMP);
  assert.equal(t.state.scores.p0.PANIC_JUMP, 0);
  assert.equal(t.state.scores.p4.PANIC_JUMP, 2);
});

test("repeated jump cannot claim another order or extend the deadline", () => {
  const t = setup(3, "PANIC_JUMP");
  t.send("JUMP");
  t.send("JUMP");
  assert.equal(Object.keys(t.state.round.actions).length, 1);
  assert.equal(t.state.round.actions.p0.order, 1);
});

test("host controls, stale revisions, strangers and wrong rounds are rejected", () => {
  const t = setup(3);
  assert.throws(() => t.send("END", {}, { userId: "p1" }), /เจ้าวง/);
  assert.throws(
    () => t.send("VOTE", { choice: "A" }, { userId: "stranger" }),
    /ไม่ได้อยู่/,
  );
  assert.throws(
    () => t.send("VOTE", { choice: "A", roundId: "old" }),
    /จบไปแล้ว/,
  );
  assert.throws(() => t.send("SKIP", { expectedRevision: -1 }), /เปลี่ยนสถานะ/);
});

test("duplicate commands return the existing result, including END and RESET", () => {
  const t = setup(3);
  const cmd = { type: "END", commandId: "same", expectedRevision: t.revision };
  const ctx = { ...t.context, revision: t.revision };
  const first = applyCommand(t.state, cmd, ctx);
  const second = applyCommand(first.state, cmd, {
    ...ctx,
    revision: ctx.revision + 1,
  });
  assert.equal(second.changed, false);
  assert.deepEqual(first.state, second.state);
});

test("horse race closes on server time, survives serialized reload, scores once", () => {
  const t = setup(3, "HORSE_RACE");
  t.send("CHOOSE", { choice: 1 });
  assert.equal(projectState(t.state, "p0").round.horses[0].speed, undefined);
  const restored = JSON.parse(JSON.stringify(t.state));
  assert.ok(advanceState(restored, restored.round.deadlineAt));
  assert.equal(restored.phase, "RACING");
  assert.ok(restored.round.frames.length > 0);
  assert.equal(restored.round.raceEndsAt - restored.round.raceStartedAt, 12000);
  advanceState(restored, restored.round.raceEndsAt);
  assert.equal(restored.phase, "RESULTS");
  const scores = JSON.stringify(restored.scores);
  assert.equal(
    advanceState(restored, restored.round.raceEndsAt + 100000),
    false,
  );
  assert.equal(JSON.stringify(restored.scores), scores);
  assert.equal(restored.round.result.players.filter((p) => p.missed).length, 2);
});

test("skip never awards points; old round actions cannot affect a new round", () => {
  const t = setup(3, "PANIC_JUMP");
  t.send("JUMP");
  const previous = t.state.round.id;
  t.send("SKIP");
  assert.equal(Object.keys(t.state.scores).length, 0);
  t.send("READY", {}, { userId: "p1" });
  t.send("READY", {}, { userId: "p2" });
  t.send("NEXT");
  assert.notEqual(t.state.round.id, previous);
  assert.throws(() => t.send("JUMP", { roundId: previous }), /จบไปแล้ว/);
});

test("participants and match mode stay fixed if someone joins or disconnects mid-round", () => {
  const t = setup(2);
  t.context.members = members(3);
  t.context.members[1].online = false;
  t.send("VOTE", { choice: "A" });
  assert.equal(t.state.round.mode, "MATCH");
  assert.deepEqual(t.state.round.participantIds, ["p0", "p1"]);
  assert.throws(
    () => t.send("VOTE", { choice: "A" }, { userId: "p2" }),
    /รอบถัดไป/,
  );
});

test("pause only between rounds and finite session ends without another round", () => {
  const t = setup(3);
  assert.throws(() => t.send("PAUSE"), /หลังเฉลย/);
  t.send("SKIP");
  t.send("PAUSE");
  assert.equal(t.state.phase, "PAUSED");
  t.send("RESUME");
  assert.equal(t.state.phase, "RESULTS");
  t.state.config.totalRounds = 1;
  t.send("NEXT");
  assert.equal(t.state.phase, "FINISHED");
});

test("custom question is validated, used once, and cannot be overwritten by a non-host", () => {
  const t = setup(3);
  t.send("SKIP");
  const question = {
    question: "คืนนี้จะไปไหนต่อ?",
    optionA: "ร้านข้าวต้ม",
    optionB: "กลับไปนอน",
  };
  assert.throws(
    () => t.send("CUSTOM_QUESTION", question, { userId: "p1" }),
    /เจ้าวง/,
  );
  assert.throws(
    () => t.send("CUSTOM_QUESTION", { ...question, optionA: "" }),
    /คำถาม/,
  );
  t.send("CUSTOM_QUESTION", question);
  t.send("READY", {}, { userId: "p1" });
  t.send("READY", {}, { userId: "p2" });
  t.send("NEXT");
  assert.equal(t.state.round.question.question, question.question);
  assert.equal(t.state.customQuestion, undefined);
});

test("late or premature actions are rejected even if a browser timer is wrong", () => {
  const t = setup(3, "PANIC_JUMP");
  assert.throws(
    () => t.send("JUMP", {}, { now: t.state.round.startsAt - 1 }),
    /ยังไม่เริ่ม/,
  );
  assert.throws(
    () => t.send("JUMP", {}, { now: t.state.round.deadlineAt + 1 }),
    /ยังไม่เริ่ม/,
  );
  assert.equal(Object.keys(t.state.round.actions).length, 0);
});
