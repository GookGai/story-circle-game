import assert from "node:assert/strict";
import { io } from "../../frontend/node_modules/socket.io-client/build/esm-debug/index.js";
import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";

const base =
  process.argv.find((v) => v.startsWith("--url="))?.slice(6) ||
  "http://127.0.0.1:3105";
const production = process.argv.includes("--production");
if (!production && !/^http:\/\/(127\.0\.0\.1|localhost):/.test(base))
  throw new Error(
    "Load tests must use local test server; pass --production for limited smoke checks",
  );
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitUntil(predicate, ms = 20000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > ms)
      throw new Error("Timed out waiting for game state");
    await sleep(50);
  }
}
async function request(path, user, body) {
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`${path}: ${r.status} ${data.error}`);
  return data;
}
function emit(socket, name, ...args) {
  return new Promise((resolve, reject) =>
    socket
      .timeout(20000)
      .emit(name, ...args, (err, reply) =>
        err ? reject(err) : resolve(reply),
      ),
  );
}
const sockets = [],
  createdRooms = [],
  report = [];
async function guest(index) {
  return request("/api/auth/guest", null, {
    username: `QA${index}`,
    avatar: index % 2 ? "fox" : "cat",
  });
}
async function connect(user, code) {
  const client = { ...user, code, state: null };
  const socket = io(base, {
    auth: { token: user.token },
    transports: ["websocket"],
    forceNew: true,
    reconnection: true,
  });
  sockets.push(socket);
  socket.qaCode = code;
  client.socket = socket;
  socket.on("party:state", (data) => {
    if (!client.state || data.room.revision >= client.state.room.revision)
      client.state = data;
  });
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  const reply = await emit(socket, "party:sync", code);
  assert.ok(reply.ok, reply.error);
  if (
    !client.state ||
    reply.snapshot.room.revision >= client.state.room.revision
  )
    client.state = reply.snapshot;
  return client;
}
async function command(client, type, payload = {}, requireSuccess = true) {
  const reply = await emit(client.socket, "party:command", {
    code: client.code,
    type,
    commandId: randomUUID(),
    expectedRevision: client.state.room.revision,
    roundId: client.state.state.round?.id,
    ...payload,
  });
  if (requireSuccess) assert.ok(reply.ok, `${type}: ${reply.error}`);
  if (reply.ok && reply.snapshot.room.revision >= client.state.room.revision)
    client.state = reply.snapshot;
  return reply;
}
async function ready(clients) {
  const replies = await Promise.all(
    clients.map((c) => command(c, "READY", { ready: true })),
  );
  assert.ok(replies.every((r) => r.ok));
  await waitUntil(() =>
    clients.every((c) =>
      clients.every((p) => c.state.state.ready.includes(p.user.id)),
    ),
  );
}
async function configure(host, gameType) {
  await command(host, "CONFIG", {
    gameType,
    totalRounds: 3,
    category: "warmup",
  });
}
async function start(host, type) {
  await configure(host, type);
  await command(host, "START");
  await waitUntil(() => Date.now() >= host.state.state.round.startsAt + 30);
}
async function results(clients) {
  await waitUntil(
    () => clients.every((c) => c.state.state.phase === "RESULTS"),
    35000,
  );
  const id = clients[0].state.state.round.id;
  assert.ok(clients.every((c) => c.state.state.round.id === id));
}
async function reset(host) {
  await command(host, "END");
  await command(host, "RESET");
}

try {
  const count = production ? 3 : 10;
  const users = await Promise.all(
    Array.from({ length: count + 1 }, (_, i) => guest(i)),
  );
  const created = await request("/api/rooms", users[0], {
    gameType: "MIXED",
    maxPlayers: 10,
  });
  const code = created.room.code;
  createdRooms.push({ code, host: users[0] });
  const clients = await Promise.all(
    users.slice(0, count).map((u) => connect(u, code)),
  );
  const host = clients[0];
  await waitUntil(() => clients.every((c) => c.state.members.length === count));
  if (!production) {
    await assert.rejects(
      () => request(`/api/rooms/${code}/join`, users[count], {}),
      /เต็ม/,
    );
    const stranger = io(base, {
      auth: { token: users[count].token },
      transports: ["websocket"],
      forceNew: true,
    });
    sockets.push(stranger);
    await new Promise((r) => stranger.once("connect", r));
    const reply = await emit(stranger, "party:command", {
      code,
      type: "END",
      commandId: randomUUID(),
      expectedRevision: host.state.room.revision,
    });
    assert.equal(reply.ok, false);
    report.push("10-player admission and cross-room command rejection");
  }
  await ready(clients);
  await start(host, "MINORITY_VOTE");
  await command(clients[1], "VOTE", { choice: "A" });
  assert.equal(clients[2].state.state.round.actions, undefined);
  assert.equal(clients[2].state.state.round.myAction, null);
  await Promise.all(
    clients
      .filter((_, i) => i !== 1)
      .map((c, i) => command(c, "VOTE", { choice: i % 2 ? "A" : "B" })),
  );
  await results(clients);
  assert.equal(host.state.state.history.length, 1);
  const scores = JSON.stringify(host.state.state.scores);
  const repeated = await command(host, "VOTE", { choice: "B" }, false);
  assert.equal(repeated.ok, false);
  assert.equal(JSON.stringify(host.state.state.scores), scores);
  const oldRound = host.state.state.round.id;
  host.socket.disconnect();
  host.socket.connect();
  await new Promise((r) => host.socket.once("connect", r));
  const resumed = await emit(host.socket, "party:sync", code);
  assert.ok(resumed.ok);
  host.state = resumed.snapshot;
  assert.equal(host.state.state.round.id, oldRound);
  assert.equal(JSON.stringify(host.state.state.scores), scores);
  report.push(
    `${count}-client vote, hidden choices, duplicate scoring rejection, reconnect snapshot`,
  );

  await reset(host);
  await ready(clients);
  await start(host, "HORSE_RACE");
  await Promise.all(
    clients.map((c, i) => command(c, "CHOOSE", { choice: (i % 8) + 1 })),
  );
  // A command acknowledgement to another player can arrive before its broadcast
  // reaches the host. Wait for the host's actual snapshot before closing input.
  await waitUntil(() => host.state.state.round.submitted === count);
  assert.equal(host.state.state.round.gurus.length, 3);
  assert.equal(host.state.state.round.picks.length, count);
  await command(host, "CLOSE_INPUT");
  const raceId = host.state.state.round.id;
  const racing = await emit(clients[1].socket, "party:sync", code);
  assert.equal(racing.snapshot.state.phase, "RACING");
  assert.equal(racing.snapshot.state.round.id, raceId);
  assert.ok(racing.snapshot.state.round.frames.length);
  await results(clients);
  assert.ok(
    host.state.state.round.result.players.every(
      (p) => p.hasPenalty === p.rank > 3 && p.penalties === (p.rank > 3 ? 1 : 0),
    ),
  );
  assert.ok(
    host.state.state.round.result.players.every(
      (p) => p.points >= 1 && p.points <= 8,
    ),
  );
  report.push(
    `${count}-client race, persisted animation timeline and rankings`,
  );

  await reset(host);
  await ready(clients);
  await configure(host, "FORBIDDEN_WORD");
  await command(host, "FORBIDDEN_SETTINGS", { wordCount: 2 });
  await command(host, "START");
  await waitUntil(() =>
    clients.every((c) => c.state.state.phase === "FORBIDDEN"),
  );
  for (const c of clients) {
    assert.equal(c.state.state.round.assignments[c.user.id].words, undefined);
    assert.ok(
      c.state.state.forbiddenConfig.categories.every(
        (cat) => cat.words === undefined,
      ),
    );
    assert.equal(c.state.state.round.recent, undefined);
  }
  await waitUntil(
    () =>
      Date.now() >
      host.state.state.round.assignments[host.user.id].activeAt + 50,
  );
  const target = clients[1],
    other = clients[2];
  const assignment = host.state.state.round.assignments[target.user.id];
  const captured = {
    targetId: target.user.id,
    generation: assignment.generation,
    wordId: assignment.words[0].id,
  };
  const catches = await Promise.all([
    command(host, "FORBIDDEN_KILL", captured, false),
    command(other, "FORBIDDEN_KILL", captured, false),
  ]);
  assert.equal(catches.filter((r) => r.ok).length, 1);
  await waitUntil(
    () => target.state.state.round.assignments[target.user.id].status === "HIT",
  );
  assert.equal(target.state.state.round.stats[target.user.id].hits, 1);
  await command(target, "FORBIDDEN_RESET", {
    generation: assignment.generation,
  });
  const resetGeneration =
    target.state.state.round.assignments[target.user.id].generation;
  await waitUntil(
    () =>
      host.state.state.round.assignments[target.user.id].generation ===
      resetGeneration,
  );
  const event = host.state.state.round.events.find((e) => e.type === "KILL");
  await command(host, "FORBIDDEN_VOID", { eventId: event.id });
  assert.equal(
    host.state.state.round.assignments[target.user.id].generation,
    resetGeneration,
  );
  assert.equal(host.state.state.round.stats[target.user.id].hits, 0);
  await command(host, "FORBIDDEN_ADD_CATEGORY", {
    name: "QA Custom",
    lines: "คำลองหนึ่ง | คำลองรวม\nคำลองสอง\nคำลองสาม",
  });
  assert.equal(host.state.state.forbiddenConfig.categories.at(-1).wordCount, 3);
  const rotation = host.state.state.round.assignments[host.user.id];
  host.socket.disconnect();
  host.socket.connect();
  await new Promise((r) => host.socket.once("connect", r));
  const recovery = await emit(host.socket, "party:sync", code);
  assert.equal(
    recovery.snapshot.state.round.assignments[host.user.id].generation,
    rotation.generation,
  );
  if (recovery.snapshot.room.revision >= host.state.room.revision)
    host.state = recovery.snapshot;
  await command(host, "PAUSE");
  await command(host, "RESUME");
  if (process.argv.includes("--rotation")) {
    const before = host.state.state.round.assignments[host.user.id];
    assert.equal(before.rotateAt - before.assignedAt >= 180000, true);
    await waitUntil(
      () =>
        host.state.state.round.assignments[host.user.id].generation !==
        before.generation,
      before.rotateAt - Date.now() + 15000,
    );
    assert.ok(
      host.state.state.round.assignments[host.user.id].activeAt >=
        before.rotateAt + 5000,
    );
    report.push(
      "real 180-second rotation persisted and broadcast after reconnect/pause",
    );
  }
  await command(host, "END");
  assert.equal(host.state.state.phase, "FINISHED");
  assert.equal(
    host.state.state.round.result.players.find(
      (p) => p.userId === target.user.id,
    ).hits,
    0,
  );
  report.push(
    `${count}-client forbidden words, private projection, concurrent Kill, reset, void, custom bank, reconnect and pause`,
  );

  await reset(host);
  await ready(clients);
  await start(host, "PANIC_JUMP");
  const jumpRound = host.state.state.round.id;
  const timingRound = structuredClone(host.state.state.round);
  assert.equal(timingRound.jumpFlow, 3);
  assert.ok(timingRound.targetNumber >= 2 && timingRound.targetNumber <= 5);
  assert.ok(timingRound.penaltyCount >= 1 && timingRound.penaltyCount <= Math.floor(count / 2));
  await Promise.all(clients.map((c) => command(c, "JUMP")));
  await waitUntil(() => clients.every((c) => c.state.state.round.opened?.length === count), 3000);
  assert.equal(host.state.state.phase, 'INPUT');
  assert.equal(host.state.state.round.result, undefined);
  assert.ok(host.state.state.round.revealAt > host.state.state.round.deadlineAt);
  assert.equal(host.state.state.round.targetAt, timingRound.targetAt);
  assert.equal(host.state.state.round.deadlineAt, timingRound.deadlineAt);
  assert.equal(host.state.state.round.actions, undefined);
  for (const c of clients) {
    assert.equal(c.state.state.round.myAction.pressedAt, undefined);
    assert.equal(c.state.state.round.myAction.order, undefined);
    assert.ok(c.state.state.round.opened.every(p => !('errorMs' in p) && !('rank' in p)));
  }
  await results(clients);
  assert.equal(
    new Set(host.state.state.round.result.players.map((p) => p.userId)).size,
    count,
  );
  assert.ok(
    host.state.state.round.result.players.every(
      (p) => host.state.state.scores[p.userId].PANIC_JUMP === p.points,
    ),
  );
  const nextReplies = await Promise.all(
    Array.from({ length: production ? 2 : 8 }, () =>
      command(host, "NEXT", { roundId: jumpRound }, false),
    ),
  );
  // Everyone must ready again; even a burst of NEXT must not advance the round.
  assert.ok(nextReplies.every((r) => !r.ok));
  assert.equal(host.state.state.round.id, jumpRound);
  report.push(
    `${count}-client timing jumps, fixed random target/deadline, private timing, score/result consistency and NEXT burst`,
  );
  if (!production) {
    await ready(clients);
    await command(host, "NEXT");
    const nextId = host.state.state.round.id;
    assert.notEqual(nextId, jumpRound);
    const stale = await command(
      clients[1],
      "JUMP",
      { roundId: jumpRound },
      false,
    );
    assert.equal(stale.ok, false);
    await command(host, "SKIP");
    const sum = JSON.stringify(host.state.state.scores);
    await sleep(9000);
    assert.equal(JSON.stringify(host.state.state.scores), sum);
    report.push("old-round rejection and cancelled timer cannot score later");
    const oldHost = host.user.id;
    host.socket.disconnect();
    await waitUntil(() => clients[1].state.room.hostId !== oldHost, 7000);
    assert.ok(
      clients.slice(1).some((c) => c.user.id === clients[1].state.room.hostId),
    );
    report.push("automatic host handoff after disconnect grace");
  }
  const pairRoom = await request("/api/rooms", users[count], {
    gameType: "MINORITY_VOTE",
    maxPlayers: 2,
  });
  createdRooms.push({ code: pairRoom.room.code, host: users[count] });
  const pair = await Promise.all(
    [users[count], users[1]].map((u) => connect(u, pairRoom.room.code)),
  );
  await ready(pair);
  await start(pair[0], "MINORITY_VOTE");
  assert.equal(pair[0].state.state.round.mode, "MATCH");
  await Promise.all(pair.map((c) => command(c, "VOTE", { choice: "B" })));
  await results(pair);
  assert.ok(pair[0].state.state.round.result.players.every((p) => p.safe));
  report.push("two-player Mind Match, no registration and same-choice result");
  mkdirSync(".tools", { recursive: true });
  writeFileSync(
    production ? ".tools/production-smoke.json" : ".tools/local-smoke.json",
    JSON.stringify(
      { date: new Date().toISOString(), base, checks: report },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: report }, null, 2));
} finally {
  // Only these QA clients leave; game summaries remain under normal retention.
  for (const socket of sockets) {
    if (socket.connected && socket.qaCode)
      await emit(socket, "party:leave", socket.qaCode).catch(() => {});
    socket.disconnect();
  }
}
