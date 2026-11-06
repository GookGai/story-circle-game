import { test } from "node:test";
import assert from "node:assert/strict";
import { readiness, playerStatus } from "../../frontend/src/utils/readiness.js";
import { canRetryStart } from "../../frontend/src/utils/commandRetry.js";
import { initialState, applyCommand, projectState } from "../src/party/engine.js";

test("open rooms keep the ready controls and scores beyond the old round limit", () => {
  const members = [
    { id: "host", username: "Host", online: true },
    { id: "guest", username: "Guest", online: true },
  ];
  const hostId = "host";
  let state = initialState();
  state.config = { gameType: "MINORITY_VOTE", totalRounds: 6, category: "all", openEnded: true };
  let now = 1_000;
  let sequence = 0;
  const send = (type, userId = hostId, payload = {}) => {
    state = applyCommand(state, {
      type, commandId: String(++sequence), expectedRevision: 0,
      roundId: state.round?.id, ...payload,
    }, { members, userId, hostId, revision: 0, now }).state;
  };

  for (let round = 1; round <= 20; round++) {
    send("READY", "guest");
    send(round === 1 ? "START" : "NEXT");
    assert.equal(state.roundNumber, round);
    now = state.round.startsAt;
    send("VOTE", hostId, { choice: "A" });
    send("VOTE", "guest", { choice: "A" });
    assert.equal(state.phase, "RESULTS");
    now = state.round.deadlineAt;
    const view = projectState(state, "guest");
    assert.equal(readiness({ state: view, members, hostId, userId: "guest" }).finished, false);
    assert.ok(view.config.totalRounds > round); // Older clients still show Ready.
  }

  assert.throws(() => send("CONFIG", hostId, { ...state.config, gameType: "MIXED" }), /ไม่พบเกมนี้/);
  send("CONFIG", hostId, { ...state.config, gameType: "HORSE_RACE" });
  assert.equal(state.config.openEnded, true);
  assert.throws(() => send("CUSTOM_QUESTION", hostId, { question: "Test?", optionA: "A", optionB: "B" }), /โหวตข้างน้อย/);
  send("END");
  assert.equal(state.phase, "FINISHED");
  assert.equal(state.completedRounds, 20);
  assert.equal(state.history.length, 18);
  assert.deepEqual(state.playedGames, ["MINORITY_VOTE"]);
  send("RESET");
  assert.equal(state.config.openEnded, true);
  assert.equal(state.completedRounds, 0);
});

test("readiness shown in the UI agrees with server admission for 1,536 seating and game combinations", () => {
  const values = ["waiting", "ready", "resting", "offline"];
  for (const gameType of [
    "HORSE_RACE",
    "MINORITY_VOTE",
    "PANIC_JUMP",
    "MIXED",
  ]) {
    for (let roundNumber = 0; roundNumber < 6; roundNumber++) {
      for (let code = 0; code < 64; code++) {
        const state = initialState();
        state.config.gameType = gameType;
        state.roundNumber = roundNumber;
        const members = Array.from({ length: 3 }, (_, i) => ({
          id: `p${i}`,
          username: `Friend ${i}`,
          online: values[(code >> (i * 2)) & 3] !== "offline",
        }));
        members.forEach((m, i) => {
          const status = values[(code >> (i * 2)) & 3];
          if (status === "ready") state.ready.push(m.id);
          if (status === "resting") state.sittingOut.push(m.id);
        });
        const model = readiness({ state, members, hostId: "p0", userId: "p1" });
        let accepted = true;
        try {
          applyCommand(
            state,
            { type: "START", commandId: "start-check", expectedRevision: 0 },
            { members, userId: "p0", hostId: "p0", revision: 0, now: 10000 },
          );
        } catch {
          accepted = false;
        }
        assert.equal(
          model.canStart,
          accepted,
          `${gameType} / ${roundNumber} / ${code}`,
        );
      }
    }
  }
});

test("host readiness, sit out, missing seats and final summary have explicit UI states", () => {
  const state = initialState();
  const members = [
    { id: "host", username: "ต้น", online: true },
    { id: "friend", username: "เมย์", online: true },
    { id: "away", username: "บอส", online: false },
  ];
  const model = () =>
    readiness({ state, members, hostId: "host", userId: "host" });
  assert.equal(model().me.status, "ready");
  assert.match(model().message, /เมย์/);
  assert.equal(model().canStart, false);
  state.sittingOut = ["host"];
  state.ready = ["friend"];
  assert.equal(model().me.status, "resting");
  assert.equal(model().missing, 1);
  assert.equal(model().seats[2].status, "offline");
  state.phase = "RESULTS";
  state.roundNumber = state.config.totalRounds;
  assert.equal(model().canStart, true);
  assert.equal(model().finished, true);
});

test("player list describes active participants, observers and reconnects accurately", () => {
  const state = initialState();
  state.phase = "INPUT";
  state.round = { participantIds: ["one"] };
  state.ready = ["one", "two"];
  assert.equal(
    playerStatus({ id: "one", online: true }, state, "one"),
    "กำลังเล่นรอบนี้",
  );
  assert.equal(
    playerStatus({ id: "two", online: true }, state, "one"),
    "ดูรอบนี้ · เล่นตาถัดไป",
  );
  assert.equal(
    playerStatus({ id: "one", online: false }, state, "one"),
    "หลุด · รอกลับมา",
  );
});

test("start retry tolerates readiness updates but never crosses rounds, settings or host transfer", () => {
  const before = {
    room: { code: "CIRCLE", hostId: "host", revision: 1 },
    state: {
      phase: "RESULTS",
      round: { id: "round-1" },
      roundNumber: 1,
      config: { gameType: "HORSE_RACE" },
    },
  };
  const after = structuredClone(before);
  after.room.revision = 2;
  after.state.ready = ["friend"];
  for (const type of ["START", "NEXT", "CLOSE_INPUT"])
    assert.equal(canRetryStart(type, before, after), true);
  for (const type of ["END", "SKIP", "RESET", "CONFIG"])
    assert.equal(canRetryStart(type, before, after), false);
  for (const patch of [
    (s) => (s.state.round.id = "round-2"),
    (s) => (s.state.phase = "INPUT"),
    (s) => (s.room.hostId = "friend"),
    (s) => (s.state.config.gameType = "MIXED"),
  ]) {
    const changed = structuredClone(after);
    patch(changed);
    assert.equal(canRetryStart("NEXT", before, changed), false);
  }
  assert.equal(canRetryStart("NEXT", before, null), false);
});
