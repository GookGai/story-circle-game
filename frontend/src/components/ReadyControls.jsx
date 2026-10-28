import { useLayoutEffect, useRef } from "react";
import Icon from "./PartyIcon";
import { getAvatarEmoji } from "../utils/avatars";
import { readinessLabels } from "../utils/readiness";

export function ReadyRollCall({ model, nextLabel, hostId, userId }) {
  return (
    <section
      id="circle-ready"
      className="ready-roll-call"
      aria-label="ความพร้อมของวง"
    >
      <div className="roll-call-heading">
        <div>
          <span className="eyebrow">
            {model.finished ? "จบวงนี้ด้วยกัน" : nextLabel}
          </span>
          <h2>{model.finished ? "ครบวงแล้ว!" : "เช็กความพร้อม"}</h2>
        </div>
        {!model.finished && (
          <strong>
            {model.ready.length}
            <small> / {model.playing.length} พร้อม</small>
          </strong>
        )}
      </div>
      <p className="roll-call-message" role="status">
        {model.message}
      </p>
      {!model.finished && (
        <div className="readiness-people">
          {model.seats.map((p) => (
            <div className={`readiness-person ${p.status}`} key={p.id}>
              <span className="readiness-avatar">
                {getAvatarEmoji(p.avatar)}
              </span>
              <div>
                <strong>
                  {p.username}
                  {p.id === userId ? " (คุณ)" : ""}
                  {p.id === hostId && <Icon name="crown" size={13} />}
                </strong>
                <small>{readinessLabels[p.status]}</small>
              </div>
              <Icon
                name={
                  p.status === "ready"
                    ? "check"
                    : p.status === "resting"
                      ? "pause"
                      : p.status === "offline"
                        ? "wifi"
                        : "users"
                }
                size={16}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ReadyDock({
  model,
  host,
  phase,
  disabled,
  connected,
  pendingCommand,
  command,
  nextLabel,
}) {
  const dock = useRef(null);
  useLayoutEffect(() => {
    const measure = () =>
      document.documentElement.style.setProperty(
        "--party-action-height",
        `${dock.current?.getBoundingClientRect().height || 0}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(dock.current);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--party-action-height");
    };
  }, []);
  const mineReady = model.me?.status === "ready";
  const resting = model.me?.status === "resting";
  const sendingReady = pendingCommand === "READY";
  const starting = ["START", "NEXT"].includes(pendingCommand);
  const startLabel = model.finished
    ? "ดูสรุปวงนี้"
    : starting
      ? "กำลังเริ่ม…"
      : model.missing
        ? `รอผู้เล่นอีก ${model.missing} คน`
        : model.waiting.length
          ? `รอเพื่อนพร้อม (${model.ready.length}/${model.playing.length})`
          : phase === "LOBBY"
            ? `เริ่มเกม · ${model.ready.length} คน`
            : `เริ่มตาถัดไป · ${model.ready.length} คน`;
  const personalLabel = sendingReady
    ? "กำลังยืนยัน…"
    : mineReady
      ? "คุณพร้อมแล้ว ✓"
      : resting
        ? "กลับมาเล่นตานี้"
        : phase === "LOBBY"
          ? "พร้อมเล่น"
          : "พร้อมเล่นตาถัดไป";
  return (
    <section
      ref={dock}
      className="party-action-dock"
      aria-label="ปุ่มพร้อมและเริ่มเกม"
    >
      <div className="action-dock-inner">
        <div className="action-dock-context">
          <strong>
            {!connected
              ? "กำลังเชื่อมต่อกลับ…"
              : model.finished
                ? "เล่นครบแล้ว เก็บเรื่องวงนี้กัน"
                : host
                  ? resting
                    ? "คุณพักตานี้ · ยังเริ่มให้เพื่อนได้"
                    : "คุณเป็นเจ้าวง · พร้อมอัตโนมัติ"
                  : mineReady
                    ? `รับความพร้อมแล้ว · รอ ${model.host?.username || "เจ้าวง"} เริ่ม`
                    : resting
                      ? "คุณพักตานี้ · รอบนี้ไม่นับคุณ"
                      : "ถึงตาคุณกดพร้อมแล้ว"}
          </strong>
          <span>
            {!connected
              ? "รอบและคะแนนยังอยู่ รอเชื่อมต่อก่อนกด"
              : model.finished
                ? "คะแนนและโมเมนต์ของทุกคนอยู่ในสรุป"
                : nextLabel}
            {connected && !model.finished && (
              <>
                {" "}
                ·{" "}
                <a href="#circle-ready" className="readiness-link">
                  ดูว่าใครพร้อม
                </a>
              </>
            )}
          </span>
        </div>
        <div className={`action-dock-buttons ${host ? "is-host" : ""}`}>
          {!model.finished && (
            <>
              {(!host || resting) && (
                <button
                  className={`ready-action ${mineReady ? "confirmed" : "needs-ready"}`}
                  aria-pressed={mineReady}
                  disabled={disabled || mineReady}
                  onClick={() => command("READY", { ready: true })}
                >
                  <Icon name={sendingReady ? "wifi" : "check"} size={22} />
                  {personalLabel}
                </button>
              )}
              <button
                className={`rest-action ${resting ? "is-resting" : ""}`}
                aria-pressed={resting}
                disabled={disabled || resting}
                onClick={() => command("READY", { ready: false })}
              >
                <Icon name="pause" size={17} />
                {resting ? "พักตานี้อยู่" : "พักตานี้"}
              </button>
            </>
          )}
          {host && (
            <button
              className="start-action"
              disabled={disabled || !model.canStart}
              onClick={() => command(phase === "LOBBY" ? "START" : "NEXT")}
            >
              <span>{startLabel}</span>
              <Icon name="arrow" size={22} />
            </button>
          )}
          {!host && model.finished && (
            <span className="finish-waiting">
              รอ {model.host?.username || "เจ้าวง"} เปิดสรุป
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
