import { useLayoutEffect, useRef, useState, useCallback } from "react";
import Icon from "./PartyIcon";
import RoomConfirmation from "./RoomConfirmation";
import { getAvatarEmoji } from "../utils/avatars";

export function ForbiddenSettings({
  settings,
  command,
  disabled,
  live = false,
}) {
  const [name, setName] = useState(""),
    [lines, setLines] = useState(""),
    [saved, setSaved] = useState(false);
  if (!settings) return null;
  const change = (patch) => command("FORBIDDEN_SETTINGS", patch);
  const count = settings.categories
    .filter((c) => settings.enabledCategories.includes(c.id))
    .reduce((sum, c) => sum + (c.words?.length || c.wordCount || 0), 0);
  return (
    <section className="forbidden-settings" aria-label="ตั้งค่าคำต้องห้าม">
      {!live && (
        <>
          <div className="settings-row">
            <label>
              เวลาเล่น
              <select
                disabled={disabled}
                value={settings.durationMinutes}
                onChange={(e) =>
                  change({ durationMinutes: Number(e.target.value) })
                }
              >
                <option value={10}>10 นาที</option>
                <option value={15}>15 นาที</option>
                <option value={0}>เล่นจนเจ้าวงกดจบ</option>
              </select>
            </label>
            <label>
              จำนวนคำต่อคน
              <select
                disabled={disabled}
                value={settings.wordCount}
                onChange={(e) => change({ wordCount: Number(e.target.value) })}
              >
                <option value={1}>1 คำ · เล่นสบาย ๆ</option>
                <option value={2}>2 คำ · โหมดปั่น</option>
              </select>
            </label>
          </div>
          <label className="forbidden-checkbox">
            <input
              type="checkbox"
              checked={settings.autoRotate}
              disabled={disabled}
              onChange={(e) => change({ autoRotate: e.target.checked })}
            />{" "}
            เปลี่ยนคำอัตโนมัติทุก 180 วินาที
          </label>
          <label className="forbidden-checkbox">
            <input
              type="checkbox"
              checked={settings.prompts}
              disabled={disabled}
              onChange={(e) => change({ prompts: e.target.checked })}
            />{" "}
            แสดงโจทย์ชวนคุยทุก 45 วินาที
          </label>
        </>
      )}
      <div className="forbidden-section-title">
        <h3>หมวดคำที่ใช้เล่น</h3>
        <span>{count} คำพร้อมสุ่ม</span>
      </div>
      <div className="forbidden-category-grid">
        {settings.categories.map((cat) => (
          <label
            className={`forbidden-category ${settings.enabledCategories.includes(cat.id) ? "enabled" : ""}`}
            key={cat.id}
          >
            <input
              type="checkbox"
              checked={settings.enabledCategories.includes(cat.id)}
              disabled={disabled}
              onChange={(e) =>
                change({
                  enabledCategories: e.target.checked
                    ? [...settings.enabledCategories, cat.id]
                    : settings.enabledCategories.filter((id) => id !== cat.id),
                })
              }
            />
            <span>
              <strong>{cat.name}</strong>
              <small>
                {cat.words?.length || cat.wordCount || 0} คำ
                {cat.custom ? " · Custom" : ""}
              </small>
            </span>
          </label>
        ))}
      </div>
      <p className="forbidden-note">
        {live
          ? "เปลี่ยนหมวดแล้วมีผลกับการรับคำครั้งถัดไป · ระหว่างเล่นซ่อนคลังคำเพื่อไม่เผยคำของคุณ"
          : "เลือกหลายหมวดผสมกันได้ · ควรมีคำอย่างน้อย 3 เท่าของจำนวนคน"}
      </p>
      <details className="forbidden-add-category">
        <summary>＋ สร้างหมวด Custom ของวง</summary>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await command("FORBIDDEN_ADD_CATEGORY", { name, lines });
            if (ok) {
              setName("");
              setLines("");
              setSaved(true);
            }
          }}
        >
          <label>
            ชื่อหมวด
            <input
              className="p-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              required
              maxLength={35}
              placeholder="เช่น เรื่องในแก๊ง"
              disabled={disabled}
            />
          </label>
          <label>
            คำต้องห้าม · หนึ่งคำต่อบรรทัด
            <textarea
              className="p-input"
              value={lines}
              onChange={(e) => {
                setLines(e.target.value);
                setSaved(false);
              }}
              required
              maxLength={12000}
              rows={5}
              placeholder={"ประชุม | ประชุมงาน | ประชุมทีม\nเดดไลน์\nวันหยุด"}
              disabled={disabled}
            />
          </label>
          <p className="forbidden-note">
            ใส่ | เพื่อเพิ่มคำที่ให้นับรวม · คำละไม่เกิน 40 ตัวอักษร · สูงสุด
            120 คำต่อหมวด
          </p>
          <button className="p-button primary" disabled={disabled}>
            เพิ่มหมวดและเปิดใช้
          </button>
          {saved && <p role="status">เพิ่มหมวดแล้ว พร้อมใช้สุ่มคำใหม่</p>}
        </form>
      </details>
    </section>
  );
}

const clock = (ms) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
export function ForbiddenGame({
  state,
  members,
  userId,
  host,
  now,
  disabled,
  connected,
  command,
}) {
  const r = state.round,
    me = r.assignments[userId],
    dock = useRef(null);
  const [confirmation, setConfirmation] = useState(null);
  const cancelConfirmation = useCallback(() => setConfirmation(null), []);
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
  const resting = me?.resting,
    hit = me?.status === "HIT",
    waiting = me?.status === "WAITING_WORDS";
  const ready =
    !!me && me.status === "ACTIVE" && !resting && now >= me.activeAt;
  const member = (id) => members.find((m) => m.id === id) || state.profiles[id];
  const name = (id) => member(id)?.username || "เพื่อนที่ออกจากวง";
  const payload = (targetId) => ({
    targetId,
    generation: r.assignments[targetId]?.generation,
  });
  const confirm = async () => {
    const c = confirmation;
    const ok = await command(c.type, c.payload);
    if (ok) setConfirmation(null);
  };
  const action = () =>
    !me
      ? command("FORBIDDEN_JOIN")
      : resting
        ? command("FORBIDDEN_REST", { resting: false })
        : command("FORBIDDEN_RESET", payload(userId));
  const needsAction = !me || resting || hit || waiting;
  const myCapture = r.events.find(
    (e) =>
      e.type === "KILL" &&
      e.targetId === userId &&
      e.generation === me?.generation &&
      !e.voided,
  );
  return (
    <div className="forbidden-stage">
      <div className="forbidden-session-strip">
        <span>
          <Icon name="secret" size={20} /> {r.wordCount} คำต่อคน
        </span>
        <span>
          {r.endsAt ? `เหลือ ${clock(r.endsAt - now)}` : "เล่นจนเจ้าวงกดจบ"}
        </span>
      </div>
      <section
        className={`forbidden-own ${hit ? "caught" : ""}`}
        aria-label="สถานะคำของคุณ"
      >
        <div className="forbidden-own-symbol">
          <Icon name={hit ? "spark" : "secret"} size={38} />
        </div>
        <div>
          <span className="eyebrow">
            {hit ? "CAUGHT IN THE ACT" : "KEEP YOUR WORD SECRET"}
          </span>
          <h2>
            {!me
              ? "พร้อมแล้ว รับคำเข้าวงเลย"
              : resting
                ? "คุณกำลังพัก"
                : hit
                  ? "รับบทลงโทษ"
                  : waiting
                    ? "รอเจ้าวงเพิ่มหรือเปิดหมวดคำ"
                    : now < me.activeAt
                      ? `เตรียมคำใหม่ · อีก ${Math.ceil((me.activeAt - now) / 1000)} วินาที`
                      : "คำของคุณเป็นความลับ"}
          </h2>
          <p>
            {hit
              ? `${name(me.lastHit.actorId)} จับคุณพูด “${me.lastHit.word}” · คำของคุณคือ ${me.lastHit.words.join(" / ")}`
              : !me
                ? "รับคำแล้วเห็นคำเพื่อนได้ทันที"
                : waiting
                  ? "คำที่แจกไม่ซ้ำหมดแล้ว คนอื่นยังเล่นต่อได้"
                  : resting
                    ? "ช่วงพักจับคุณไม่ได้ กลับมาแล้วมีเวลาเตรียม 5 วินาที"
                    : "เห็นคำของเพื่อนทุกคน แต่ไม่เห็นของตัวเอง อย่าเผลออ่านตาม!"}
          </p>
          {me?.status === "ACTIVE" && !resting && me.rotateAt && (
            <small>
              {now - me.assignedAt < 10000 ? "ได้รับคำชุดใหม่แล้ว · " : ""}
              เปลี่ยนคำอีก {clock(me.rotateAt - now)} · ทุก 180 วินาที
            </small>
          )}
        </div>
      </section>
      {r.prompt && (
        <section className="forbidden-prompt" aria-label="โจทย์ชวนคุย">
          <span>เปิดวงคุย</span>
          <strong>{r.prompt}</strong>
          <small>ไม่ต้องพิมพ์คำตอบ เงยหน้าคุยกันได้เลย</small>
        </section>
      )}
      <div className="forbidden-section-title">
        <h3>คำของเพื่อน · หลอกให้หลุด</h3>
        <span>{r.participantIds.length} คนในเกม</span>
      </div>
      <div className="forbidden-friends">
        {Object.entries(r.assignments)
          .filter(([id]) => id !== userId && member(id))
          .map(([id, a]) => {
            const person = member(id),
              online = members.some((m) => m.id === id && m.online),
              grace = now < a.activeAt;
            const catchable =
              ready &&
              online &&
              !a.resting &&
              a.status === "ACTIVE" &&
              !grace &&
              !disabled;
            return (
              <article
                key={id}
                className={`forbidden-friend ${a.status === "HIT" ? "caught" : ""}`}
              >
                <header>
                  <span className="forbidden-friend-avatar">
                    {getAvatarEmoji(person.avatar)}
                  </span>
                  <div>
                    <h4>{person.username}</h4>
                    <span>
                      {!online
                        ? "หลุด · รอกลับมา"
                        : a.resting
                          ? "พักอยู่ · จับไม่ได้"
                          : a.status === "HIT"
                            ? "โดนแล้ว · รอรับคำใหม่"
                            : a.status === "WAITING_WORDS"
                              ? "รอคำเพิ่ม"
                              : grace
                                ? `เริ่มจับได้อีก ${Math.ceil((a.activeAt - now) / 1000)} วิ`
                                : "กำลังเล่น"}
                    </span>
                  </div>
                </header>
                <div className="forbidden-word-list">
                  {a.words?.map((w) => (
                    <div key={w.id}>
                      <small>{w.category}</small>
                      <strong>{w.text}</strong>
                      {w.aliases.length > 0 && (
                        <span>นับรวม: {w.aliases.join(" / ")}</span>
                      )}
                      <button
                        disabled={!catchable}
                        className="forbidden-kill"
                        onClick={() =>
                          setConfirmation({
                            type: "FORBIDDEN_KILL",
                            title: `Kill ${person.username}?`,
                            description: `จับได้ว่าพูด “${w.text}” คนนี้จะโดน 1 ครั้ง และคุณได้นักล่า +1`,
                            label: "ยืนยัน Kill",
                            payload: { ...payload(id), wordId: w.id },
                          })
                        }
                      >
                        Kill · จับได้!
                      </button>
                    </div>
                  )) || <p>รับคำเข้าวงก่อน เพื่อดูคำเพื่อน</p>}
                </div>
                {host && (
                  <button
                    className="forbidden-admin-reset"
                    disabled={disabled}
                    onClick={() =>
                      setConfirmation({
                        type: "FORBIDDEN_RESET",
                        title: `เปลี่ยนคำให้ ${person.username}?`,
                        description:
                          "ใช้เมื่อคำหลุดหรือแจกคำใหม่ ไม่เพิ่มจำนวนโดนจับ",
                        label: "เปลี่ยนคำ ไม่เพิ่มโทษ",
                        payload: payload(id),
                      })
                    }
                  >
                    คำหลุด / รับคำใหม่ให้เพื่อน
                  </button>
                )}
              </article>
            );
          })}
      </div>
      <details className="forbidden-rules">
        <summary>กติกา · พูดแบบไหนนับ?</summary>
        <p>
          พูดคำเต็มในประโยค อ่านตาม หรือร้องเพลงก็นับ · คำใกล้เคียงไม่นับ
          ยกเว้นคำที่ระบุให้นับรวม · พิมพ์หรือทำท่าทางไม่นับ · ช่วงเตรียม 5
          วินาที พัก หรือโดนแล้ว จับไม่ได้
        </p>
        <p>
          คนจับยืนยันแล้วมีผลทันที หากเห็นต่างกดขอทบทวนให้เจ้าวงยกเลิกผลได้
          เกมนี้ให้วงตัดสินจากที่ได้ยิน ไม่ได้เปิดไมค์ฟัง
        </p>
      </details>
      <section className="forbidden-scoreboard">
        <div className="forbidden-section-title">
          <h3>นักล่าประจำวง</h3>
          <span>จับได้ / โดนจับ</span>
        </div>
        {Object.entries(r.stats)
          .sort((a, b) => b[1].kills - a[1].kills)
          .map(([id, s]) => (
            <div key={id}>
              <span>
                {getAvatarEmoji(member(id)?.avatar)} {name(id)}
                {id === userId ? " (คุณ)" : ""}
              </span>
              <strong>
                {s.kills}
                <small> / {s.hits}</small>
              </strong>
            </div>
          ))}
      </section>
      <section className="forbidden-history">
        <div className="forbidden-section-title">
          <h3>ประวัติจับได้</h3>
          <span>ผลล่าสุด · ไม่คิดโทษซ้ำ</span>
        </div>
        {r.events.filter((e) => e.type === "KILL").length === 0 ? (
          <p className="forbidden-note">ยังไม่มีใครหลุดคำ ชวนเพื่อนคุยได้เลย</p>
        ) : (
          r.events
            .filter((e) => e.type === "KILL")
            .slice(-20)
            .reverse()
            .map((e) => (
              <article key={e.id} className={e.voided ? "voided" : ""}>
                <strong>
                  {name(e.actorId)} → {name(e.targetId)}
                </strong>
                <p>
                  “{e.word}” ·{" "}
                  {e.voided
                    ? "ยกเลิกผลแล้ว"
                    : `${name(e.targetId)} รับบทลงโทษ`}
                </p>
                <small>
                  {e.disputed && !e.voided
                    ? "ขอทบทวน · รอเจ้าวงตัดสิน"
                    : new Date(e.at).toLocaleTimeString("th-TH", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                </small>
                {!e.voided && (
                  <div>
                    {e.targetId === userId && !e.disputed && (
                      <button
                        disabled={disabled}
                        onClick={() =>
                          command("FORBIDDEN_REVIEW", { eventId: e.id })
                        }
                      >
                        ขอทบทวน
                      </button>
                    )}
                    {host && (
                      <button
                        disabled={disabled}
                        onClick={() =>
                          setConfirmation({
                            type: "FORBIDDEN_VOID",
                            title: "ยกเลิก Kill นี้?",
                            description:
                              "คืนคะแนนนักล่าและยกเลิกโทษครั้งนี้ หากยังถือคำเดิมจะได้รับคำใหม่ เพราะคำเดิมถูกเปิดแล้ว",
                            label: "ยกเลิกผลครั้งนี้",
                            payload: { eventId: e.id },
                          })
                        }
                      >
                        ยกเลิกผล
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))
        )}
      </section>
      {host && (
        <details className="forbidden-live-settings">
          <summary>จัดการหมวด / เพิ่มคำระหว่างเล่น</summary>
          <ForbiddenSettings
            settings={state.forbiddenConfig}
            command={command}
            disabled={disabled}
            live
          />
        </details>
      )}
      <section
        className="party-action-dock"
        ref={dock}
        aria-label="รับคำและพักคำต้องห้าม"
      >
        <div className="action-dock-inner">
          <div className="action-dock-context">
            <strong>
              {!connected
                ? "กำลังเชื่อมต่อกลับ…"
                : hit
                  ? "โดนจับแล้ว รับคำใหม่เพื่อเล่นต่อ"
                  : waiting
                    ? "คำไม่พอ ให้เจ้าวงเพิ่มหมวดแล้วลองรับใหม่"
                    : resting
                      ? "คุณพักอยู่ กลับมาเล่นได้เมื่อพร้อม"
                      : !me
                        ? "เข้าวงระหว่างเกมได้เลย"
                        : ready
                          ? "คุยให้เนียน แล้วจับเพื่อนให้ทัน"
                          : "ช่วงเตรียมคำใหม่ · ยังจับไม่ได้"}
            </strong>
            <span>
              จับได้ {r.stats[userId]?.kills || 0} · โดนจับ{" "}
              {r.stats[userId]?.hits || 0} ครั้ง
            </span>
          </div>
          <div className="action-dock-buttons">
            {hit && myCapture && !myCapture.disputed && (
              <button
                className="rest-action"
                disabled={disabled}
                onClick={() =>
                  command("FORBIDDEN_REVIEW", { eventId: myCapture.id })
                }
              >
                ขอทบทวน
              </button>
            )}
            {needsAction && (
              <button
                className="ready-action needs-ready"
                disabled={disabled}
                onClick={action}
              >
                {!me
                  ? "รับคำเข้าวง"
                  : resting
                    ? "กลับมาเล่น"
                    : waiting
                      ? "ลองรับคำใหม่"
                      : "รับคำใหม่ เล่นต่อ"}
              </button>
            )}
            {me && !resting && (
              <button
                className="rest-action"
                disabled={disabled}
                onClick={() => command("FORBIDDEN_REST", { resting: true })}
              >
                พักชั่วคราว
              </button>
            )}
            {host && ready && (
              <button
                className="rest-action"
                disabled={disabled}
                onClick={() =>
                  setConfirmation({
                    type: "FORBIDDEN_RESET",
                    title: "คำตัวเองหลุดแล้ว?",
                    description:
                      "รับคำใหม่แทนคำที่รู้แล้ว โดยไม่เพิ่มจำนวนโดนจับ",
                    label: "เปลี่ยนคำตัวเอง",
                    payload: payload(userId),
                  })
                }
              >
                คำตัวเองหลุด
              </button>
            )}
          </div>
        </div>
      </section>
      {confirmation && (
        <RoomConfirmation
          title={confirmation.title}
          description={confirmation.description}
          actionLabel={confirmation.label}
          onCancel={cancelConfirmation}
          disabled={disabled}
          busy={disabled}
          onConfirm={confirm}
        />
      )}
    </div>
  );
}

export function ForbiddenSummary({ state, command, disabled, host }) {
  const rows = state.round.result?.players || [];
  return (
    <section className="forbidden-end">
      <span className="eyebrow">THAT WAS A CLOSE CALL.</span>
      <h1>ใครเนียน ใครหลุด?</h1>
      <p>จบเกมคำต้องห้าม · โทษทั้งหมดคิดระหว่างเล่นแล้ว ไม่คิดซ้ำตอนจบ</p>
      <div className="forbidden-scoreboard">
        <div className="forbidden-section-title">
          <h3>นักล่าประจำวง</h3>
          <span>จับได้ / โดนจับ</span>
        </div>
        {[...rows]
          .sort((a, b) => b.kills - a.kills || a.hits - b.hits)
          .map((p) => (
            <div key={p.userId}>
              <span>
                {getAvatarEmoji(state.profiles[p.userId]?.avatar)}{" "}
                {state.profiles[p.userId]?.username}
              </span>
              <strong>
                {p.kills}
                <small> / {p.hits}</small>
              </strong>
            </div>
          ))}
      </div>
      {host && (
        <button
          className="p-button primary"
          disabled={disabled}
          onClick={() => command("RESET")}
        >
          เริ่มวงใหม่ · เก็บหมวดเดิมไว้
        </button>
      )}
    </section>
  );
}
