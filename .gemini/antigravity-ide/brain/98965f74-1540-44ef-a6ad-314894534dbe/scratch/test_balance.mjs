// Simulating highly balanced parameters to hit 11-13% for all horses
const HORSE_TEMPLATES = [
  { id: "1", name: "พญาลม", color: "#ff2d78" },
  { id: "2", name: "เจ้าฟ้า", color: "#00d4ff" },
  { id: "3", name: "หมูตัน", color: "#7cff2d" },
  { id: "4", name: "จอมซิ่ง", color: "#ff6b35" },
  { id: "5", name: "มังกรดำ", color: "#b44dff" },
  { id: "6", name: "สิงห์สนามซ้อม", color: "#00ff99" },
  { id: "7", name: "เต่าบินเกียร์ห้า", color: "#ffea00" },
  { id: "8", name: "สายฟ้าหน้ามึน", color: "#ff3333" },
];

function randomStat() {
  return Math.floor(Math.random() * 21) + 70; // 70 to 90
}

const TRACK_DISTANCE = 2500;
const BURST_MULTIPLIER = 1.5;
const STUMBLE_MULTIPLIER = 0.3;
const BURST_DURATION = 3; // ticks
const STUMBLE_DURATION = 2; // ticks
const EVENT_CHANCE = 0.04;

function testSimulateRace(horses) {
  const state = horses.map((horse) => ({
    id: horse.id,
    name: horse.name,
    speed: horse.speed,
    stamina: horse.stamina,
    luck: horse.luck,
    distance: 0,
    activeEffect: null,
  }));

  let tick = 0;
  let winner = null;

  while (state.some((h) => h.distance < TRACK_DISTANCE)) {
    tick++;

    for (const horse of state) {
      // 5. "มังกรดำ": fine-tune event chance from 0.06 to 0.055 to reduce volatility slightly
      const eventChance = horse.name === "มังกรดำ" ? 0.055 : EVENT_CHANCE;

      if (!horse.activeEffect && Math.random() < eventChance) {
        const isBurst = Math.random() * 100 < horse.luck;
        const type = isBurst ? "burst" : "stumble";
        
        if (type === "stumble" && horse.name === "เจ้าฟ้า") {
          // Immune
        } else {
          const duration = (type === "stumble" && horse.name === "หมูตัน") ? 1 : (isBurst ? BURST_DURATION : STUMBLE_DURATION);
          horse.activeEffect = { type, ticksRemaining: duration };
        }
      }

      let effectMultiplier = 1;
      if (horse.activeEffect) {
        // 1. "พญาลม": reduce burst multiplier from 1.65 to 1.60
        const burstMult = horse.name === "พญาลม" ? 1.60 : BURST_MULTIPLIER;
        effectMultiplier = horse.activeEffect.type === "burst" ? burstMult : STUMBLE_MULTIPLIER;
        horse.activeEffect.ticksRemaining--;
        if (horse.activeEffect.ticksRemaining <= 0) {
          horse.activeEffect = null;
        }
      }

      const baseSpeed = horse.speed / 100;
      const staminaFactor = (horse.stamina / 100) * 0.5 + 0.5;
      
      let luckFactor;
      if (horse.name === "สายฟ้าหน้ามึน") {
        // 8. "สายฟ้าหน้ามึน": slightly tighten variance to 1.1x while keeping perfect average (0.7)
        luckFactor = (0.7 - 0.275 * (horse.luck / 100)) + Math.random() * 1.1 * (horse.luck / 100);
      } else {
        luckFactor = 0.7 + Math.random() * 0.6 * (horse.luck / 100);
      }
      
      let movement = baseSpeed * staminaFactor * luckFactor * effectMultiplier;

      // Adjustments for perfect 11-13% balance:
      // 4. "จอมซิ่ง": reduce nitro boost from +10% to +8% in final stretch (>1800m)
      if (horse.name === "จอมซิ่ง" && horse.distance > 1800) {
        movement *= 1.08;
      }
      
      // 6. "สิงห์สนามซ้อม": reduce early boost from +12% to +10%
      if (horse.name === "สิงห์สนามซ้อม" && tick <= 30) {
        movement *= 1.10;
      }

      // 7. "เต่าบินเกียร์ห้า": increase comeback boost from +12% to +15% when in last place
      if (horse.name === "เต่าบินเกียร์ห้า") {
        const minDistance = Math.min(...state.map((h) => h.distance));
        if (horse.distance <= minDistance) {
          movement *= 1.15;
        }
      }

      if (horse.distance < TRACK_DISTANCE) {
        horse.distance += movement * 18;
      }

      if (horse.distance >= TRACK_DISTANCE) {
        horse.distance = TRACK_DISTANCE;
        if (!horse.finishTick) {
          horse.finishTick = tick;
        }
      }
    }

    if (!winner) {
      const finishers = state.filter((h) => h.distance >= TRACK_DISTANCE);
      if (finishers.length > 0) {
        winner = finishers.reduce((best, h) =>
          h.speed + h.luck > best.speed + best.luck ? h : best
        );
      }
    }

    if (tick >= 450) {
      if (!winner) {
        winner = state.reduce((best, h) => h.distance > best.distance ? h : best);
      }
      break;
    }
  }

  return { winner };
}

const winCounts = {};
for (const t of HORSE_TEMPLATES) {
  winCounts[t.name] = 0;
}

const SIMULATIONS = 20000; // Increased to 20,000 simulations for extreme accuracy!
console.log(`Running ${SIMULATIONS} simulated races with micro-adjusted parameters to hit 11-13% target...`);

for (let i = 0; i < SIMULATIONS; i++) {
  const horses = HORSE_TEMPLATES.map(t => ({
    id: t.id,
    name: t.name,
    color: t.color,
    speed: randomStat(),
    stamina: randomStat(),
    luck: randomStat()
  }));

  const result = testSimulateRace(horses);
  const winnerName = result.winner.name;
  winCounts[winnerName] = (winCounts[winnerName] || 0) + 1;
}

console.log("\nMicro-Balanced Simulation Results (Win Rates):");
console.log("-------------------------------------");
for (const name in winCounts) {
  const wins = winCounts[name];
  const rate = ((wins / SIMULATIONS) * 100).toFixed(2);
  console.log(`${name.padEnd(15)} : ${wins.toString().padStart(5)} wins (${rate}%)`);
}
console.log("-------------------------------------");
