// Retry only a start intent rejected for stale revision, never across a new
// round, changed game settings, or host transfer. The same command ID is reused.
export function canRetryStart(type, before, after) {
  if (!before || !after) return false;
  return (
    ["START", "NEXT", "CLOSE_INPUT"].includes(type) &&
    before.room.code === after.room.code &&
    before.room.hostId === after.room.hostId &&
    before.state.phase === after.state.phase &&
    before.state.round?.id === after.state.round?.id &&
    before.state.roundNumber === after.state.roundNumber &&
    JSON.stringify(before.state.config) === JSON.stringify(after.state.config)
  );
}
