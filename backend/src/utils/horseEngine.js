/**
 * Horse Race Simulation Engine
 *
 * Simulates a horse race with physics-based movement, random events,
 * and generates frame-by-frame animation data for the frontend.
 *
 * Track distance: 1000 units
 * Target duration: ~50-80 ticks (5-8 seconds at 100ms per tick)
 */

const TRACK_DISTANCE = 1000;
const BURST_MULTIPLIER = 1.5;
const STUMBLE_MULTIPLIER = 0.3;
const BURST_DURATION = 3; // ticks
const STUMBLE_DURATION = 2; // ticks
const EVENT_CHANCE = 0.04; // 4% chance per tick per horse

/**
 * Run a full horse race simulation
 * @param {Array} horses - Array of horse objects with { id, speed, stamina, luck }
 * @returns {{ frames: Array, winner: object, totalTicks: number }}
 */
export function simulateRace(horses) {
  // Initialize race state for each horse
  const state = horses.map((horse) => ({
    id: horse.id,
    name: horse.name,
    color: horse.color,
    speed: horse.speed,
    stamina: horse.stamina,
    luck: horse.luck,
    distance: 0,
    activeEffect: null, // { type: 'burst'|'stumble', ticksRemaining: number }
  }));

  const frames = [];
  let tick = 0;
  let winner = null;

  while (!winner) {
    tick++;
    const frameData = [];

    for (const horse of state) {
      // Check for random events
      if (!horse.activeEffect && Math.random() < EVENT_CHANCE) {
        // Luck affects which event you get — higher luck = more bursts
        const isBurst = Math.random() * 100 < horse.luck;
        horse.activeEffect = {
          type: isBurst ? "burst" : "stumble",
          ticksRemaining: isBurst ? BURST_DURATION : STUMBLE_DURATION,
        };
      }

      // Calculate speed multiplier from active effects
      let effectMultiplier = 1;
      let eventType = null;

      if (horse.activeEffect) {
        eventType = horse.activeEffect.type;
        effectMultiplier =
          horse.activeEffect.type === "burst"
            ? BURST_MULTIPLIER
            : STUMBLE_MULTIPLIER;

        horse.activeEffect.ticksRemaining--;
        if (horse.activeEffect.ticksRemaining <= 0) {
          horse.activeEffect = null;
        }
      }

      // Core movement formula:
      // distance += (speed/100) * (stamina/100 * 0.5 + 0.5) * (0.7 + random * 0.6 * luck/100)
      const baseSpeed = horse.speed / 100;
      const staminaFactor = (horse.stamina / 100) * 0.5 + 0.5;
      const luckFactor = 0.7 + Math.random() * 0.6 * (horse.luck / 100);
      const movement = baseSpeed * staminaFactor * luckFactor * effectMultiplier;

      // Scale movement to hit target tick range (multiply by ~18 to get 50-80 ticks)
      horse.distance += movement * 18;

      // Clamp to track distance
      if (horse.distance >= TRACK_DISTANCE) {
        horse.distance = TRACK_DISTANCE;
        if (!horse.finishTick) {
          horse.finishTick = tick;
        }
      }

      frameData.push({
        horseId: horse.id,
        distance: Math.round(horse.distance * 100) / 100,
        event: eventType,
      });
    }

    frames.push({
      tick,
      horses: frameData,
    });

    // Check for winner(s) — first horse to reach TRACK_DISTANCE
    const finishers = state.filter((h) => h.distance >= TRACK_DISTANCE);
    if (finishers.length > 0) {
      // If multiple finish on same tick, the one with highest distance wins
      // (though they're all at 1000, pick the first one processed — or use original stats as tiebreaker)
      winner = finishers.reduce((best, h) =>
        h.speed + h.luck > best.speed + best.luck ? h : best
      );
    }

    // Safety valve: prevent infinite loops (max 150 ticks)
    if (tick >= 150) {
      // Pick the horse that's furthest ahead
      winner = state.reduce((best, h) =>
        h.distance > best.distance ? h : best
      );
      break;
    }
  }

  // Sort horses to get rankings (1st, 2nd, 3rd, 4th, 5th place)
  const rankings = [...state].sort((a, b) => {
    // 1. Both finished: sort by finishTick (smaller is faster)
    if (a.finishTick && b.finishTick) {
      if (a.finishTick !== b.finishTick) {
        return a.finishTick - b.finishTick;
      }
      return (b.speed + b.luck) - (a.speed + a.luck);
    }
    // 2. Only A finished: A comes first
    if (a.finishTick) return -1;
    if (b.finishTick) return 1;
    // 3. Neither finished: sort by distance (larger is closer to finish)
    return b.distance - a.distance;
  });

  return {
    frames,
    winner: { id: winner.id, name: winner.name, color: winner.color },
    rankings: rankings.map((r, index) => ({
      rank: index + 1,
      id: r.id,
      name: r.name,
      color: r.color,
      speed: r.speed,
      stamina: r.stamina,
      luck: r.luck,
      distance: r.distance,
      finishTick: r.finishTick,
    })),
    totalTicks: tick,
  };
}
