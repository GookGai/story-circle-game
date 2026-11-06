import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAIBudget } from '../src/utils/aiBudget.js';

test('bounds concurrent calls, user retries, and daily paid attempts', () => {
  let time = Date.UTC(2026, 9, 16);
  const budget = createAIBudget({ dailyLimit: 3, concurrency: 1, now: () => time });
  const release = budget.acquire('a');
  assert.equal(typeof release, 'function');
  assert.equal(budget.acquire('b'), null);
  release(); release();
  assert.equal(budget.acquire('a'), null);
  budget.acquire('b')();
  time += 16000;
  budget.acquire('a')();
  assert.equal(budget.acquire('c'), null);
  time += 86400000;
  assert.equal(typeof budget.acquire('c'), 'function');
});

test('zero budget disables paid calls', () => {
  assert.equal(createAIBudget({ dailyLimit: 0 }).acquire('a'), null);
});
