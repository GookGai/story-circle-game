import { randomInt } from 'node:crypto';

export const PARACHUTE = { inputMs: 12000, minimumFlightMs: 4500, landingMs: 3000 };
export const TIMING_JUMP = { countdownFrom: 7, tieMs: 100, clickGraceMs: 350 };
export function prepareTimingParachute(round, integer = randomInt) {
  round.jumpFlow = 3;
  round.countdownFrom = TIMING_JUMP.countdownFrom;
  round.targetNumber = integer(2, 6);
  round.penaltyCount = integer(1, Math.floor(round.participantIds.length / 2) + 1);
  round.tieMs = TIMING_JUMP.tieMs;
  round.targetAt = round.startsAt + (round.countdownFrom - round.targetNumber) * 1000;
  round.flightWindowMs = round.countdownFrom * 1000;
  round.deadlineAt = round.startsAt + round.flightWindowMs;
  round.landingAt = round.deadlineAt;
  round.revealAt = round.landingAt + PARACHUTE.landingMs;
}
// Measure finger contact on the displayed shared clock, allowing only a bounded
// transit delay. Never trust a client-supplied rank, error, or arbitrary old time.
export function timingClickAt(pressedAt, receivedAt, startsAt) {
  return Number.isFinite(pressedAt) && pressedAt >= startsAt && pressedAt <= receivedAt
    && receivedAt - pressedAt <= TIMING_JUMP.clickGraceMs ? pressedAt : receivedAt;
}
export function timingParachuteResult(round) {
  const rows = round.participantIds.map((userId) => {
    const action = round.actions[userId];
    const signedErrorMs = action ? (action.pressedAt ?? action.at) - round.targetAt : null;
    return { userId, missed: !action, signedErrorMs,
      errorMs: action ? Math.abs(signedErrorMs) : null,
      bucket: action ? Math.round(Math.abs(signedErrorMs) / TIMING_JUMP.tieMs) : Infinity };
  });
  const missing = rows.filter((p) => p.missed);
  const worst = rows.filter((p) => !p.missed).sort((a,b) => b.bucket-a.bucket);
  const places = Math.max(0, round.penaltyCount - missing.length);
  const cutoff = worst[places - 1]?.bucket;
  const tiedAcrossCut = cutoff != null && worst[places]?.bucket === cutoff;
  const best = worst.at(-1)?.bucket;
  const players = rows.map(({bucket, ...p}) => {
    const tieSaved = !!tiedAcrossCut && bucket === cutoff;
    const hasPenalty = p.missed || (cutoff != null && (bucket > cutoff || (bucket === cutoff && !tiedAcrossCut)));
    const rank = p.missed ? null : 1 + rows.filter((other) => other.bucket < bucket).length;
    return { ...p, rank, tieSaved, safe: !hasPenalty, hasPenalty, penalties: hasPenalty ? 1 : 0,
      points: hasPenalty ? 0 : bucket === best ? 2 : 1,
      reason: p.missed ? 'ไม่ได้กางร่ม · รับบทลงโทษ' : tieSaved ? 'จังหวะเสมอตรงเส้นตัด · รอดทั้งคู่' : hasPenalty ? 'ห่างจากเป้ามากที่สุด · รับบทลงโทษ' : bucket === best ? 'แม่นที่สุดในวง · +2 ดาว' : 'กางใกล้เป้า · รอด' };
  }).sort((a,b) => (a.errorMs ?? Infinity) - (b.errorMs ?? Infinity));
  return { title: 'ลงจอดแล้ว! ใครจับจังหวะแม่นที่สุด?',
    description: `เป้าเลข ${round.targetNumber} · ห่างสุด ${round.penaltyCount} คนรับบทลงโทษ · เสมอตรงเส้นตัดรอด · ไม่กดถือว่าพลาด`,
    players, penaltyIds: players.filter((p)=>p.hasPenalty).map((p)=>p.userId),
    safeIds: players.filter((p)=>p.safe).map((p)=>p.userId) };
}
export function prepareParachute(round) {
  round.jumpFlow = 2;
  round.flightWindowMs = PARACHUTE.inputMs;
  round.landingAt = round.deadlineAt;
  round.revealAt = round.landingAt + PARACHUTE.landingMs;
}
export function closeParachute(round, now) {
  if (round.jumpFlow === 3) return; // Keep the target and countdown fixed even if everyone taps early.
  round.deadlineAt = now;
  round.landingAt = Math.max(now, round.startsAt + PARACHUTE.minimumFlightMs);
  round.revealAt = round.landingAt + PARACHUTE.landingMs;
}
export function inputWakeAt(round) {
  return round?.gameType === 'PANIC_JUMP' && round.jumpFlow >= 2 ? round.revealAt : round?.deadlineAt;
}
export function projectParachute(round) {
  const resolution = round.jumpFlow === 3 ? 500 : 100;
  const approximate = (at) => round.startsAt + Math.max(0, Math.floor((at - round.startsAt) / resolution) * resolution);
  round.opened = round.participantIds.filter((id) => round.actions[id]).map((userId) => ({ userId, openedAt: approximate(round.actions[userId].at) }));
  if (round.myAction) round.myAction = { openedAt: approximate(round.myAction.at) };
  delete round.actions;
}
