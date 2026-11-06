const clamp = (n) => Math.max(0, Math.min(1, n));
export function parachuteView(round, now) {
  const landingAt = round.landingAt ?? round.deadlineAt;
  const revealAt = round.revealAt ?? round.deadlineAt;
  const phase = round.result ? 'RESULTS' : now < round.startsAt ? 'PREPARING' : now >= revealAt ? 'WAITING_RESULT'
    : now >= landingAt ? 'LANDING' : now >= round.deadlineAt ? 'WATCHING' : 'FALLING';
  const duration = round.flightWindowMs || Math.max(1, round.jumpFlow === 2 ? 12000 : round.deadlineAt - round.startsAt);
  const opened = new Map((round.opened || []).map((p) => [p.userId, p.openedAt]));
  if (round.result) {
    opened.clear();
    for (const p of round.result.players || []) if (!p.missed && (p.order || p.rank)) opened.set(p.userId, round.startsAt);
  }
  const ids = round.participantIds || [];
  const landing = phase === 'RESULTS' ? 1 : clamp((now - landingAt) / Math.max(1, revealAt - landingAt));
  const players = ids.map((id, index) => {
    const at = opened.get(id);
    const secondRow = ids.length > 6 && index % 2;
    const fall = (time) => {
      const elapsed = clamp((time - round.startsAt) / duration);
      const opening = at == null ? null : clamp((at - round.startsAt) / duration);
      return 20 + (opening == null ? elapsed ** 1.45 * 48 : opening ** 1.45 * 48 + Math.max(0, time - at) / duration * 10) + (secondRow ? 10 : 0);
    };
    const airborne = fall(Math.min(now, landingAt));
    const y = airborne + (82 - airborne) * (1 - (1 - landing) ** 2);
    const edge = ids.length > 6 ? 6 : 12;
    return { id, opened: opened.has(id), x: edge + index / Math.max(1, ids.length - 1) * (100 - 2 * edge), y: Math.max(16, Math.min(84, y)), landed: landing > .85 };
  });
  const clock = phase === 'PREPARING' ? round.startsAt : phase === 'WATCHING' ? landingAt : ['LANDING','WAITING_RESULT'].includes(phase) ? revealAt : round.deadlineAt;
  const countdown = Math.max(0, Math.min(round.countdownFrom || 7, (round.deadlineAt - now) / 1000));
  const targetDelta = now - (round.targetAt || 0);
  return { phase, players, openedCount: opened.size, seconds: Math.max(0, Math.ceil((clock - now) / 1000)), progress: clamp((now - round.startsAt) / duration), landing,
    countdown, targetPulse: round.jumpFlow === 3 && phase === 'FALLING' && targetDelta >= 0 && targetDelta < 200,
    ringScale: 1 + Math.max(-.35, Math.min(.65, -targetDelta / 1600)) };
}

export function timingLabel(player) {
  if (player.missed) return 'ไม่ได้กางร่ม';
  const delta = player.signedErrorMs || 0;
  return delta === 0 ? 'ตรงเป้าพอดี' : `${delta < 0 ? 'เร็ว' : 'ช้า'} ${(Math.abs(delta) / 1000).toFixed(2)} วิ`;
}
