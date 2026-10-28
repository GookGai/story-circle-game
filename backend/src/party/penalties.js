// Upgrade persisted sessions without changing choices, rankings, points or private words.
// The old counter represented one failed-round outcome, not a measured quantity.
function neutralText(text) {
  if (typeof text !== 'string') return text;
  return text.replaceAll('รอด ไม่ต้องดื่ม', 'รอดรอบนี้')
    .replaceAll('ต้องดื่ม 1 ครั้ง', 'รับบทลงโทษ')
    .replaceAll('ดื่ม 1 ครั้ง', 'รับบทลงโทษ');
}

function playerOutcome(player) {
  if ('mustDrink' in player) {
    player.hasPenalty ??= player.mustDrink;
    delete player.mustDrink;
  }
  if ('drinks' in player) {
    player.penalties ??= player.drinks;
    delete player.drinks;
  }
  if (player.reason) player.reason = neutralText(player.reason);
}

export function normalizePenaltyState(state) {
  for (const score of Object.values(state.scores || {})) {
    if ('drinks' in score) { score.penalties ??= score.drinks; delete score.drinks; }
  }
  if (state.round?.result) {
    const result = state.round.result;
    if ('drinkerIds' in result) { result.penaltyIds ??= result.drinkerIds; delete result.drinkerIds; }
    result.description = neutralText(result.description);
    for (const player of result.players || []) playerOutcome(player);
  }
  for (const round of state.history || []) for (const player of round.players || []) playerOutcome(player);
  return state;
}
