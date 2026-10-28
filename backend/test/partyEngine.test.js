import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  applyCommand,
  advanceState,
  projectState,
} from "../src/party/engine.js";
import { QUESTIONS, pickQuestion } from "../src/party/questions.js";
import { makeHorseField, makeGurus } from "../src/party/horseField.js";
import { inputWakeAt } from '../src/party/parachute.js';

test("eight distinct horse identities and three stable, opinionated gurus", () => {
  const horses = makeHorseField(() => 0.5);
  for (const field of ["name", "style", "color", "ability"])
    assert.equal(new Set(horses.map((h) => h[field])).size, 8);
  const gurus = makeGurus("round-proof", horses);
  assert.deepEqual(makeGurus("round-proof", horses), gurus);
  assert.equal(new Set(gurus.map((g) => g.pickId)).size, 3);
  for (const g of gurus) {
    assert.notEqual(g.pickId, g.avoidId);
    assert.equal(g.ratings[g.pickId], 5);
    assert.equal(g.ratings[g.avoidId], 1);
    assert.ok(g.quote && g.missQuote);
  }
});

test("horse views expose guru recommendations while keeping stats and skills private across phases", () => {
  const t = setup(2, "HORSE_RACE");
  t.state.round.horses[0].form = { speed: 5, stamina: 5, luck: 5 };
  t.state.round.horses[0].privateTuning = 999;
  t.state.round.gurus[0].privateScore = 999;
  t.state.round.gurus[0].ratings.speed = 90;
  const check = (view) => {
    for (const h of view.round.horses) {
      for (const field of ['speed', 'stamina', 'luck', 'form', 'ability', 'abilityDescription', 'privateTuning']) assert.equal(h[field], undefined);
      assert.ok(h.name && h.color && h.personality);
    }
    for (const g of [...view.round.gurus, ...(view.round.result?.gurus || [])]) {
      assert.equal(g.privateScore, undefined);
      assert.equal(g.ratings.speed, undefined);
      assert.equal(Object.keys(g.ratings).length, 8);
      assert.ok(Object.values(g.ratings).every((n) => n >= 1 && n <= 5));
    }
  };
  const before = JSON.stringify(t.state);
  for (const user of ['p0', 'p1']) check(projectState(t.state, user));
  assert.equal(JSON.stringify(t.state), before);
  assert.ok(Number.isFinite(t.state.round.horses[0].speed));
  advanceState(t.state, t.state.round.deadlineAt);
  t.state.round.rankings[0].speed = 90; // A restored legacy ranking is projected too.
  const racing = projectState(t.state, 'p0');
  check(racing);
  assert.equal(racing.round.rankings[0].speed, undefined);
  advanceState(t.state, t.state.round.raceEndsAt);
  check(projectState(t.state, 'p0'));
});
test('guru opinions vary across the field instead of assigning adjacent horse IDs identical levels', () => {
  const horses = makeHorseField(() => 0.5);
  let varied = 0;
  for (let round = 0; round < 64; round++) for (const g of makeGurus(`opinion-${round}`, horses)) {
    const ordinary = horses.filter((h) => h.id !== g.pickId && h.id !== g.avoidId).map((h) => g.ratings[h.id]);
    if (new Set(ordinary).size > 1) varied++;
  }
  assert.ok(varied > 100);
});

test("restored horse rounds regenerate stable guru opinions from private data before projection", () => {
  const t = setup(2, 'HORSE_RACE');
  const expected = projectState(t.state, 'p0').round.gurus;
  delete t.state.round.gurus;
  const restored = JSON.parse(JSON.stringify(t.state));
  assert.deepEqual(projectState(restored, 'p0').round.gurus, expected);
  assert.equal(restored.round.gurus, undefined);
});

test("horse results name every penalized player, keep missing players neutral, and persist picks", () => {
  const t = setup(10, "HORSE_RACE");
  for (let i = 0; i < 8; i++)
    t.send("CHOOSE", { choice: i + 1 }, { userId: `p${i}` });
  const input = projectState(t.state, "p0");
  assert.equal(input.round.picks.length, 8);
  const gurus = input.round.gurus;
  advanceState(t.state, t.state.round.deadlineAt);
  assert.deepEqual(projectState(t.state, "p0").round.gurus, gurus);
  advanceState(t.state, t.state.round.raceEndsAt);
  const result = t.state.round.result;
  assert.equal(result.penaltyIds.length, 5);
  assert.equal(result.safeIds.length, 3);
  assert.equal(result.players.filter((p) => p.missed).length, 2);
  for (const p of result.players) {
    assert.equal(p.hasPenalty, !!p.rank && p.rank > 3);
    assert.equal(p.penalties, p.hasPenalty ? 1 : 0);
    assert.equal(t.state.scores[p.userId]?.penalties || 0, p.penalties);
  }
  assert.equal(projectState(t.state, "p0").round.picks.length, 8);
  const scores = JSON.stringify(t.state.scores);
  advanceState(t.state, t.state.round.raceEndsAt + 100000);
  assert.equal(JSON.stringify(t.state.scores), scores);
});

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
  assert.equal(t.state.phase, 'INPUT');
  assert.equal(t.state.round.result, undefined);
  assert.equal(Object.keys(t.state.scores).length, 0);
  assert.ok(t.state.round.landingAt >= t.state.round.startsAt + 4500);
  advanceState(t.state, t.state.round.revealAt);
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
test('parachute expiry waits for landing and restart recovery scores exactly once', () => {
  const t = setup(3, 'PANIC_JUMP');
  assert.equal(t.state.round.deadlineAt - t.state.round.startsAt, 12000);
  t.send('JUMP');
  t.send('JUMP', {}, {userId:'p1',now:t.context.now+250});
  const copy = JSON.parse(JSON.stringify(t.state));
  assert.equal(advanceState(copy,copy.round.deadlineAt),false);
  assert.equal(copy.round.result,undefined);
  assert.equal(inputWakeAt(copy.round),copy.round.revealAt);
  assert.ok(inputWakeAt(copy.round)>copy.round.deadlineAt);
  assert.equal(advanceState(copy,copy.round.revealAt-1),false);
  assert.equal(advanceState(copy,copy.round.revealAt),true);
  assert.equal(copy.round.result.players.filter((p)=>p.missed).length,1);
  const scores=JSON.stringify(copy.scores);
  assert.equal(advanceState(copy,copy.round.revealAt+10000),false);
  assert.equal(JSON.stringify(copy.scores),scores);
});
test('live parachutes disclose openers without exposing exact input ordering or private actions', () => {
  const t=setup(3,'PANIC_JUMP');
  t.send('JUMP',{}, {userId:'p1',now:t.state.round.startsAt+137});
  t.send('JUMP',{}, {userId:'p0',now:t.state.round.startsAt+169});
  const before=JSON.stringify(t.state);
  const view=projectState(t.state,'p0').round;
  assert.deepEqual(view.opened.map((p)=>p.userId),['p0','p1']);
  assert.ok(view.opened.every((p)=>p.openedAt===t.state.round.startsAt+100));
  assert.equal(view.actions,undefined);
  assert.equal(view.myAction.order,undefined);
  assert.equal(view.myAction.at,undefined);
  assert.equal(JSON.stringify(t.state),before);
});
test('legacy parachute sessions retain their original finish deadline', () => {
  const t=setup(3,'PANIC_JUMP');
  delete t.state.round.jumpFlow;delete t.state.round.revealAt;delete t.state.round.landingAt;
  assert.equal(inputWakeAt(t.state.round),t.state.round.deadlineAt);
  assert.equal(advanceState(t.state,t.state.round.deadlineAt),true);
  assert.equal(t.state.phase,'RESULTS');
});
test('skip during landing cancels scoring and late input cannot reopen a closed flight', () => {
  const t=setup(3,'PANIC_JUMP');
  for(let i=0;i<3;i++)t.send('JUMP',{}, {userId:`p${i}`,now:t.context.now+i});
  assert.throws(()=>t.send('JUMP',{}, {now:t.state.round.deadlineAt+1}),/ยังไม่เริ่มหรือหมดเวลา/);
  t.send('SKIP',{}, {now:t.state.round.landingAt+1});
  assert.equal(t.state.round.result.skipped,true);
  assert.equal(Object.keys(t.state.scores).length,0);
  assert.equal(advanceState(t.state,t.state.round.revealAt+100),false);
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
