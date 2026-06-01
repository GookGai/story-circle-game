/**
 * Horse Race Simulation Engine
 *
 * Simulates a horse race with physics-based movement, random events,
 * and generates frame-by-frame animation data for the frontend.
 *
 * Track distance: 1000 units
 * Target duration: ~50-80 ticks (5-8 seconds at 100ms per tick)
 */

const TRACK_DISTANCE = 2500;
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

  while (state.some((h) => h.distance < TRACK_DISTANCE)) {
    tick++;
    const frameData = [];

    for (const horse of state) {
      // Ability: "มังกรดำ" (Mystic Luck) - event check chance is increased slightly
      const eventChance = horse.name === "มังกรดำ" ? 0.05 : EVENT_CHANCE;

      // Check for random events
      if (!horse.activeEffect && Math.random() < eventChance) {
        // Luck affects which event you get — higher luck = more bursts
        const isBurst = Math.random() * 100 < horse.luck;
        const type = isBurst ? "burst" : "stumble";
        
        // Ability: "เจ้าฟ้า" (Pure Focus) - immune to stumbling
        if (type === "stumble" && horse.name === "เจ้าฟ้า") {
          // Ignore stumbling
        } else {
          // Ability: "หมูตัน" (Stout & Steady) - stumbling lasts only 1 tick instead of 2
          const duration = (type === "stumble" && horse.name === "หมูตัน") ? 1 : (isBurst ? BURST_DURATION : STUMBLE_DURATION);
          horse.activeEffect = {
            type,
            ticksRemaining: duration,
          };
        }
      }

      // Calculate speed multiplier from active effects
      let effectMultiplier = 1;
      let eventType = null;

      if (horse.activeEffect) {
        eventType = horse.activeEffect.type;
        // Ability: "พญาลม" (Wind Master) - stronger burst speed multiplier (1.56 instead of 1.5)
        const burstMult = horse.name === "พญาลม" ? 1.56 : BURST_MULTIPLIER;
        effectMultiplier =
          horse.activeEffect.type === "burst"
            ? burstMult
            : STUMBLE_MULTIPLIER;

        horse.activeEffect.ticksRemaining--;
        if (horse.activeEffect.ticksRemaining <= 0) {
          horse.activeEffect = null;
        }
      }

      // Core movement formula:
      const baseSpeed = horse.speed / 100;
      const staminaFactor = (horse.stamina / 100) * 0.5 + 0.5;
      
      // Ability: "สายฟ้าหน้ามึน" (Dazed Lightning) - wider luck variance
      let luckFactor;
      if (horse.name === "สายฟ้าหน้ามึน") {
        luckFactor = (0.7 - 0.20 * (horse.luck / 100)) + Math.random() * 1.0 * (horse.luck / 100);
      } else {
        luckFactor = 0.7 + Math.random() * 0.6 * (horse.luck / 100);
      }
      
      let movement = baseSpeed * staminaFactor * luckFactor * effectMultiplier;

      // Ability: "จอมซิ่ง" (Endgame Nitro) - +10% speed in final stretch (>2150m)
      if (horse.name === "จอมซิ่ง" && horse.distance > 2150) {
        movement *= 1.10;
      }
      
      // Ability: "สิงห์สนามซ้อม" (Early Booster) - +12% speed in first 15 ticks
      if (horse.name === "สิงห์สนามซ้อม" && tick <= 15) {
        movement *= 1.12;
      }

      // Ability: "เต่าบินเกียร์ห้า" (Comeback King) - +10% speed when in last place
      if (horse.name === "เต่าบินเกียร์ห้า") {
        const minDistance = Math.min(...state.map((h) => h.distance));
        if (horse.distance <= minDistance) {
          movement *= 1.10;
        }
      }

      // Scale movement to hit target tick range (multiply by ~18 to get 50-80 ticks)
      // Only move if not already finished
      if (horse.distance < TRACK_DISTANCE) {
        horse.distance += movement * 18;
      }

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

    // Check for winner (the first horse to cross TRACK_DISTANCE)
    if (!winner) {
      const finishers = state.filter((h) => h.distance >= TRACK_DISTANCE);
      if (finishers.length > 0) {
        winner = finishers.reduce((best, h) =>
          h.speed + h.luck > best.speed + best.luck ? h : best
        );
      }
    }

    // Safety valve: prevent infinite loops (max 450 ticks)
    if (tick >= 450) {
      if (!winner) {
        winner = state.reduce((best, h) =>
          h.distance > best.distance ? h : best
        );
      }
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
