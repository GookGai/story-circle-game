import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePenaltyState } from '../src/party/penalties.js';
import { initialState, projectState, applyCommand, finish } from '../src/party/engine.js';
import { defaultForbiddenConfig, ensureForbiddenConfig } from '../src/party/forbiddenWords.js';

function legacyState() {
  return {
    ...initialState(), phase: 'RESULTS',
    scores: { p1: { HORSE_RACE: 4, wins: 0, played: 1, drinks: 2 } },
    round: { gameType: 'HORSE_RACE', actions: {}, horses: [], rankings: [], gurus: [], result: {
      description: 'อันดับ 4–8 ดื่ม 1 ครั้ง', drinkerIds: ['p1'],
      players: [{ userId: 'p1', mustDrink: true, drinks: 1, reason: 'อันดับ 5 · ต้องดื่ม 1 ครั้ง' }],
    } },
    history: [{ players: [{ userId: 'p1', mustDrink: true, drinks: 1 }] }],
  };
}

test('persisted results upgrade once without altering points or doubling counters', () => {
  const state = legacyState();
  normalizePenaltyState(state);
  assert.deepEqual(state.scores.p1, { HORSE_RACE: 4, wins: 0, played: 1, penalties: 2 });
  assert.deepEqual(state.round.result.penaltyIds, ['p1']);
  assert.equal(state.round.result.players[0].reason, 'อันดับ 5 · รับบทลงโทษ');
  assert.equal(state.history[0].players[0].hasPenalty, true);
  const saved = structuredClone(state);
  normalizePenaltyState(state);
  finish(state, 12345);
  assert.deepEqual(state, saved);
  assert.ok(!/drinks|mustDrink|drinkerIds|ดื่ม/.test(JSON.stringify(state)));
});

test('projection and commands upgrade old sessions while preserving the input state', () => {
  const state = legacyState();
  const before = structuredClone(state);
  const view = projectState(state, 'p1');
  assert.equal(view.scores.p1.penalties, 2);
  assert.deepEqual(state, before);
  const result = applyCommand(state, { type: 'READY', commandId: 'upgrade' }, {
    userId: 'p1', hostId: 'p1', now: 100, revision: 0,
    members: [{ id: 'p1', username: 'friend', online: true }],
  });
  assert.equal(result.state.scores.p1.penalties, 2);
  assert.deepEqual(state, before);
});

test('old rooms refresh built-in decks while keeping custom words and active assignments', () => {
  const config = defaultForbiddenConfig();
  delete config.builtinDeckVersion;
  config.categories.find((c) => c.id === 'table').words[0].text = 'ชนแก้ว';
  const custom = { id: 'custom-1', name: 'our words', custom: true, words: [{ text: 'เมา' }] };
  config.categories.push(custom);
  const assignments = { p1: { words: [{ text: 'คำเดิม' }], rotateAt: 180000 } };
  const state = { forbiddenConfig: config, round: { assignments } };
  ensureForbiddenConfig(state);
  assert.equal(config.categories.find((c) => c.id === 'table').words[0].text, 'ตบมือ');
  assert.deepEqual(config.categories.at(-1), custom);
  assert.equal(state.round.assignments, assignments);
  const once = structuredClone(config);
  ensureForbiddenConfig(state);
  assert.deepEqual(config, once);
});
