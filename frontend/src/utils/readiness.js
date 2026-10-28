export function readiness({ state, members, hostId, userId }) {
  const seats = members.map((member) => ({
    ...member,
    status: !member.online
      ? "offline"
      : state.sittingOut.includes(member.id)
        ? "resting"
        : state.ready.includes(member.id) || member.id === hostId
          ? "ready"
          : "waiting",
  }));
  const playing = seats.filter(
    (p) => p.status === "ready" || p.status === "waiting",
  );
  const waiting = seats.filter((p) => p.status === "waiting");
  const ready = seats.filter((p) => p.status === "ready");
  const minimum = 2;
  const missing = Math.max(0, minimum - playing.length);
  const me = seats.find((p) => p.id === userId);
  const finished =
    state.phase === "RESULTS" && state.roundNumber >= state.config.totalRounds;
  const host = seats.find((p) => p.id === hostId);
  let message;
  if (finished) message = "ครบทุกตาแล้ว เจ้าของวงเปิดสรุปวงนี้ได้เลย";
  else if (missing)
    message = `ชวนเพื่อนเข้ามาหรือกลับมาเล่นอีก ${missing} คน · เกมนี้ใช้ขั้นต่ำ ${minimum} คน`;
  else if (waiting.length)
    message = `รอ ${waiting.map((p) => p.username).join(", ")} กดพร้อม หรือเลือกพักตานี้`;
  else
    message = `พร้อมครบ ${ready.length} คน · ${host?.username || "เจ้าวง"} กดเริ่มได้เลย`;
  return {
    seats,
    playing,
    waiting,
    ready,
    minimum,
    missing,
    me,
    host,
    finished,
    message,
    canStart: finished || (!missing && !waiting.length),
  };
}

export const readinessLabels = {
  ready: "พร้อมแล้ว",
  waiting: "ยังไม่พร้อม",
  resting: "พักตานี้",
  offline: "หลุด · รอกลับมา",
};

export function playerStatus(member, state, hostId) {
  if (!member.online) return "หลุด · รอกลับมา";
  if (state.phase === "FORBIDDEN") {
    const a = state.round.assignments[member.id];
    return !a
      ? "รอรับคำเข้าวง"
      : a.resting
        ? "พักชั่วคราว"
        : a.status === "HIT"
          ? "โดนแล้ว · รอคำใหม่"
          : a.status === "WAITING_WORDS"
            ? "รอเพิ่มคำ"
            : "ถือคำอยู่ · กำลังเล่น";
  }
  if (["INPUT", "RACING", "FORBIDDEN"].includes(state.phase))
    return state.round.participantIds.includes(member.id)
      ? "กำลังเล่นรอบนี้"
      : "ดูรอบนี้ · เล่นตาถัดไป";
  if (state.phase === "PAUSED") return "วงพักอยู่";
  if (state.phase === "FINISHED") return "จบวงแล้ว";
  if (state.sittingOut.includes(member.id)) return "พักตานี้";
  return member.id === hostId || state.ready.includes(member.id)
    ? "พร้อมแล้ว"
    : "ยังไม่พร้อม";
}
