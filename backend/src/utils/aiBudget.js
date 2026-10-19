// Process-local budget: deploy one replica. Restarts reset the counters;
// configure an OpenRouter key credit limit for a durable monetary ceiling.
export function createAIBudget({ dailyLimit = 100, cooldownMs = 15000, concurrency = 2, now = Date.now } = {}) {
  let day = '';
  let used = 0;
  let active = 0;
  const users = new Map();
  return {
    acquire(userId) {
      const time = now();
      const today = new Date(time).toISOString().slice(0, 10);
      if (today !== day) { day = today; used = 0; users.clear(); }
      for (const [id, expiry] of users) if (expiry <= time) users.delete(id);
      if (used >= dailyLimit || active >= concurrency || users.has(userId)) return null;
      used++;
      active++;
      users.set(userId, time + cooldownMs);
      let released = false;
      return () => { if (!released) { active--; released = true; } };
    },
  };
}
