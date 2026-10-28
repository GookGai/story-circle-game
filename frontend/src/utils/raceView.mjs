export const RACE_VIEWPORT_QUERY = '(max-width: 720px), (max-width: 1024px) and (max-height: 600px)';

export function raceView(round, now) {
  const progress = Math.max(0, Math.min(1, (now - round.raceStartedAt) / Math.max(1, round.raceEndsAt - round.raceStartedAt)));
  const frames = round.frames || [];
  const frame = frames[Math.min(frames.length - 1, Math.floor(progress * frames.length))] || [];
  const finalRanks = new Map((round.rankings || []).map((r) => [r.id, r.rank]));
  const order = [...frame].sort((a, b) => {
    const aDone = a[1] >= 2500, bDone = b[1] >= 2500;
    if (aDone && bDone && finalRanks.has(a[0]) && finalRanks.has(b[0])) return finalRanks.get(a[0]) - finalRanks.get(b[0]);
    if (aDone !== bDone) return aDone ? -1 : 1;
    return b[1] - a[1];
  });
  return {
    frame, leaders: order.slice(0, 3),
    ranks: new Map(order.map(([id], i) => [id, i + 1])),
    seconds: Math.max(0, Math.ceil((round.raceEndsAt - now) / 1000)),
  };
}
