import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateRace } from '../src/utils/horseEngine.js';

test('race simulations finish within the safety limit and rank every horse once', () => {
  const horses = Array.from({ length: 8 }, (_, id) => ({
    id, name: `Horse ${id}`, color: '#fff', speed: 70 + id,
    stamina: 90 - id, luck: 80,
  }));
  for (let run = 0; run < 50; run++) {
    const result = simulateRace(horses);
    assert.ok(result.totalTicks > 0 && result.totalTicks <= 450);
    assert.equal(new Set(result.rankings.map(horse => horse.id)).size, 8);
    assert.equal(result.winner.id, result.rankings[0].id);
    assert.equal(result.frames.length, result.totalTicks);
    assert.ok(result.frames.every(frame => frame.horses.every(horse => Number.isFinite(horse.distance))));
  }
});
