export const PARACHUTE = { inputMs: 12000, minimumFlightMs: 4500, landingMs: 3000 };
export function prepareParachute(round) {
  round.jumpFlow = 2;
  round.flightWindowMs = PARACHUTE.inputMs;
  round.landingAt = round.deadlineAt;
  round.revealAt = round.landingAt + PARACHUTE.landingMs;
}
export function closeParachute(round, now) {
  round.deadlineAt = now;
  round.landingAt = Math.max(now, round.startsAt + PARACHUTE.minimumFlightMs);
  round.revealAt = round.landingAt + PARACHUTE.landingMs;
}
export function inputWakeAt(round) {
  return round?.gameType === 'PANIC_JUMP' && round.jumpFlow === 2 ? round.revealAt : round?.deadlineAt;
}
export function projectParachute(round) {
  const approximate = (at) => round.startsAt + Math.max(0, Math.floor((at - round.startsAt) / 100) * 100);
  round.opened = round.participantIds.filter((id) => round.actions[id]).map((userId) => ({ userId, openedAt: approximate(round.actions[userId].at) }));
  if (round.myAction) round.myAction = { openedAt: approximate(round.myAction.at) };
  delete round.actions;
}
