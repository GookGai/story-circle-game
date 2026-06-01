/**
 * Game Registry — extensible registry for all game types
 * New games can be added by calling registerGame() with a config object
 */

const gameRegistry = new Map();

/**
 * Register a new game type
 * @param {string} type - Unique game type identifier (e.g., 'HORSE_RACE')
 * @param {object} config - Game configuration
 */
export function registerGame(type, config) {
  gameRegistry.set(type, config);
}

/**
 * Get a game config by type
 * @param {string} type - Game type identifier
 * @returns {object|undefined} Game configuration
 */
export function getGame(type) {
  return gameRegistry.get(type);
}

/**
 * Get all registered games as a list (safe for API responses)
 * @returns {Array} List of game configs with type included
 */
export function getAllGames() {
  return Array.from(gameRegistry.entries()).map(([type, config]) => ({
    type,
    name: config.name,
    description: config.description,
    icon: config.icon,
    minPlayers: config.minPlayers,
    maxPlayers: config.maxPlayers,
  }));
}

// ─── Register default games ─────────────────────────────────────────────────

registerGame("HORSE_RACE", {
  name: "แทงม้า",
  description: "เลือกม้าที่คิดว่าจะชนะ ใครแทงผิดดื่ม!",
  icon: "🐎",
  minPlayers: 2,
  maxPlayers: 15,
});

registerGame("MINORITY_VOTE", {
  name: "เสียงส่วนน้อย",
  description: "โหวตเลือก 2 ช้อยส์ ฝ่ายน้อยดื่ม!",
  icon: "🗳️",
  minPlayers: 3,
  maxPlayers: 15,
});
