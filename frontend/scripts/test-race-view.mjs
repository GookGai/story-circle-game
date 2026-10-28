import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raceView } from '../src/utils/raceView.mjs';

test('race replay selects the same bounded server frame after reconnect and clamps the clock', () => {
  const round = { raceStartedAt: 1000, raceEndsAt: 5000, frames: [[[1, 10]], [[1, 100]], [[1, 1000]], [[1, 2500]]] };
  assert.deepEqual(raceView(round, 0).frame, round.frames[0]);
  assert.deepEqual(raceView(round, 3000).frame, round.frames[2]);
  assert.deepEqual(raceView(JSON.parse(JSON.stringify(round)), 3000).frame, round.frames[2]);
  assert.deepEqual(raceView(round, 6000).frame, round.frames[3]);
  assert.equal(raceView(round, 6000).seconds, 0);
});
test('finish order outranks distance overshoot; current leaders agree with official arrivals', () => {
  const round = { raceStartedAt: 0, raceEndsAt: 1000, frames: [[[1, 2600], [2, 2900], [3, 2450], [4, 2400]]], rankings: [{ id: 1, rank: 1 }, { id: 2, rank: 2 }] };
  const view = raceView(round, 500);
  assert.deepEqual(view.leaders.map(([id]) => id), [1, 2, 3]);
  assert.equal(view.ranks.get(1), 1);
  assert.equal(view.ranks.get(4), 4);
  assert.deepEqual(round.frames[0].map(([id]) => id), [1, 2, 3, 4]);
});
test('before a snapshot has frames all eight lanes can render without invented leaders', () => {
  const view = raceView({ raceStartedAt: 0, raceEndsAt: 1000 }, 100);
  assert.equal(view.ranks.size, 0);
  assert.deepEqual(view.leaders, []);
});
