import { getAvatarEmoji } from "../utils/avatars";
import { useEffect, useRef, useState } from "react";
import Icon from "./PartyIcon";
import { raceView, RACE_VIEWPORT_QUERY } from "../utils/raceView.mjs";

export function HorsePortrait({ horse }) {
  const dark = ["dragon", "lightning"].includes(horse.style);
  return (
    <svg
      className={`horse-portrait horse-${horse.style}`}
      viewBox="0 0 100 84"
      aria-hidden="true"
    >
      <circle cx="48" cy="43" r="37" fill={horse.color} opacity=".17" />
      <path
        d="M22 72Q17 44 37 31L34 10 48 22 57 8 62 28Q83 33 87 50L75 61 58 54 55 76Z"
        fill={dark ? "#38313e" : horse.color}
        stroke="#272923"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M36 30Q19 39 22 65L34 51 32 69 42 55 40 75"
        fill={dark ? horse.color : "#34352e"}
      />
      <path
        d="M49 32L63 50 79 54M58 45L56 72"
        fill="none"
        stroke={horse.style === "royal" ? "#f5dc83" : "#f8f2df"}
        strokeWidth="5"
      />
      <circle cx="65" cy="36" r="3" fill={dark ? "#faf6ed" : "#272923"} />
      <circle cx="80" cy="48" r="2" fill="#272923" />
      {horse.style === "racer" && (
        <path d="M43 25L68 28 70 35 48 33Z" fill="#242820" />
      )}
      {horse.style === "royal" && (
        <path
          d="M40 19L38 8 48 14 53 3 58 14 66 9 62 23Z"
          fill="#ead36f"
          stroke="#272923"
          strokeWidth="2"
        />
      )}
      {horse.style === "dragon" && (
        <path
          d="M34 31L23 27 28 40 18 44 26 54"
          fill={horse.color}
          stroke="#272923"
          strokeWidth="2"
        />
      )}
      {horse.style === "turtle" && (
        <ellipse
          cx="35"
          cy="66"
          rx="17"
          ry="13"
          fill="#65834c"
          stroke="#272923"
          strokeWidth="2"
        />
      )}
      {horse.style === "lion" && (
        <path
          d="M37 25L26 19 29 34 19 35 27 45 20 53 34 58 44 45Z"
          fill="#bd884a"
        />
      )}
      {horse.style === "lightning" && (
        <path d="M46 27L57 26 51 36 60 35 46 51 50 39 43 40Z" fill="#ead36f" />
      )}
      {horse.style === "wind" && (
        <path
          d="M8 31H26M4 42H20M8 54H19"
          stroke={horse.color}
          strokeWidth="4"
          strokeLinecap="round"
        />
      )}
      {horse.style === "stout" && (
        <path
          d="M44 57L55 59 53 70 46 74 40 66Z"
          fill="#faf6ed"
          stroke="#272923"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}

function Supporters({ round, horseId, profiles, userId }) {
  const picks = (round.picks || []).filter((p) => p.horseId === horseId);
  return (
    <div className="horse-supporters" aria-label="คนที่เลือกม้าตัวนี้">
      {picks.length ? (
        picks.map((p) => (
          <span key={p.userId} className={p.userId === userId ? "is-me" : ""}>
            {getAvatarEmoji(profiles[p.userId]?.avatar)}{" "}
            {profiles[p.userId]?.username || "เพื่อนในวง"}
            {p.userId === userId ? " (คุณ)" : ""}
          </span>
        ))
      ) : (
        <span className="no-supporters">ยังไม่มีคนเลือก</span>
      )}
    </div>
  );
}

function Gurus({ round, command, disabled, reveal = false }) {
  const gurus = reveal
    ? round.result.gurus || round.gurus || []
    : round.gurus || [];
  return (
    <section className="guru-section" aria-label="โพยกูรู">
      <div className="horse-section-heading">
        <h3>
          {reveal ? "กูรูว่าไง… หลังเห็นเส้นชัย" : "ฟังกูรู แล้วเชื่อใครดี?"}
        </h3>
        <span>3 คน 3 สไตล์</span>
      </div>
      <div className="guru-grid">
        {gurus.map((g) => {
          const horse = round.horses.find((h) => h.id === g.pickId);
          const avoid = round.horses.find((h) => h.id === g.avoidId);
          return (
            <article className="guru-tip" key={g.id}>
              <div className="guru-person">
                <span>{g.avatar}</span>
                <div>
                  <h4>{g.name}</h4>
                  <small>{g.subtitle}</small>
                </div>
                {reveal && (
                  <b className={g.hit ? "guru-hit" : "guru-miss"}>
                    {g.hit ? "แม่น!" : "หน้าแตก"}
                  </b>
                )}
              </div>
              <p className="guru-quote">
                “{reveal && !g.hit ? g.missQuote : g.quote}”
              </p>
              <strong className="guru-pick">
                เชียร์ #{g.pickId} {horse?.name}
              </strong>
              {reveal ? (
                <p>
                  เข้าอันดับ {g.rank} ·{" "}
                  {g.hit ? "ลูกศิษย์รอด" : "ลูกศิษย์รับบทลงโทษ"}
                </p>
              ) : (
                <>
                  <small>
                    ขอเลี่ยง #{g.avoidId} {avoid?.name}
                  </small>
                  <button
                    disabled={disabled}
                    className="guru-follow"
                    onClick={() => command("CHOOSE", { choice: g.pickId })}
                  >
                    เชื่อตาม{g.name} →
                  </button>
                </>
              )}
            </article>
          );
        })}
      </div>
      {!reveal && (
        <p className="horse-footnote">
          ดาวยิ่งมาก กูรูยิ่งเชียร์ · เลือกเองหรือเชื่อตามกูรูได้
          เปลี่ยนใจได้ก่อนแข่ง กูรูไม่รู้ผลล่วงหน้า
        </p>
      )}
    </section>
  );
}

export function HorseInput({ round, disabled, command, profiles, userId }) {
  const chosen = round.horses.find((h) => h.id === round.myAction?.choice);
  return (
    <div className="horse-game">
      <div className="horse-rules">
        <strong>ท็อป 3 รอด</strong>
        <span>อันดับ 4–8 รับบทลงโทษ · ไม่ได้เลือกไม่คิดผล</span>
      </div>
      <Gurus round={round} command={command} disabled={disabled} />
      <div className="horse-section-heading">
        <h3>8 ตัว 8 คาแรกเตอร์</h3>
        <span>เลือกม้าได้ 1 ตัว</span>
      </div>
      <div className="horse-field">
        {round.horses.map((horse) => {
          const selected = chosen?.id === horse.id;
          return (
            <article
              className={`horse-profile ${selected ? "chosen" : ""}`}
              key={horse.id}
              style={{ "--horse-color": horse.color }}
            >
              <button
                className="horse-pick-button"
                disabled={disabled}
                aria-pressed={selected}
                aria-label={`เลือกม้าหมายเลข ${horse.id} ${horse.name}`}
                onClick={() => command("CHOOSE", { choice: horse.id })}
              >
                <span className="horse-number">
                  {String(horse.id).padStart(2, "0")}
                </span>
                <span className="horse-symbol">{horse.symbol}</span>
                <HorsePortrait horse={horse} />
                <h4>{horse.name}</h4>
                <span className="horse-tagline">{horse.personality}</span>
                <span className="horse-select-label">
                  {selected ? "✓ คุณเลือกตัวนี้" : "เลือกตัวนี้ →"}
                </span>
              </button>
              <div className="horse-guru-ratings" aria-label="ระดับคำแนะนำจากกูรู">
                {(round.gurus || []).map((g) => {
                  const level = g.ratings?.[horse.id] || (g.pickId === horse.id ? 5 : g.avoidId === horse.id ? 1 : 3);
                  return <div key={g.id}>
                    <span>{g.avatar} {g.name}</span>
                    <b aria-label={`${g.name} แนะนำ ${level} จาก 5`}>{'★'.repeat(level)}<i>{'☆'.repeat(5 - level)}</i></b>
                  </div>;
                })}
              </div>
              <Supporters
                round={round}
                horseId={horse.id}
                profiles={profiles}
                userId={userId}
              />
            </article>
          );
        })}
      </div>
      <div className="horse-selection-summary" role="status">
        {chosen ? (
          <>
            <span>{chosen.symbol}</span>
            <div>
              <small>โพยของคุณ ส่งแล้ว</small>
              <strong>
                #{chosen.id} {chosen.name}
              </strong>
              <span>เปลี่ยนตัวได้จนปิดรับ</span>
            </div>
          </>
        ) : (
          <strong>ยังไม่ได้เลือก · แตะม้าที่ชอบหรือเชื่อตามกูรู</strong>
        )}
      </div>
    </div>
  );
}

function RacePicks({ round, profiles, userId, onClose }) {
  const close = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    close.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="race-picks-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="race-picks-sheet" role="dialog" aria-modal="true" aria-label="โพยเพื่อนในสนาม" onKeyDown={(e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab') { e.preventDefault(); close.current?.focus(); }
    }}>
      <header><div><h3>ใครเชียร์ตัวไหน</h3><p>สนามยังแข่งอยู่ ปิดโพยเพื่อกลับไปลุ้น</p></div><button ref={close} className="icon-button" onClick={onClose} aria-label="ปิดโพยเพื่อน"><Icon name="close" /></button></header>
      <div className="race-picks-list">{round.horses.map((horse) => <article key={horse.id}>
        <div><HorsePortrait horse={horse} /><strong>#{horse.id} {horse.name}</strong></div>
        <Supporters round={round} horseId={horse.id} profiles={profiles} userId={userId} />
      </article>)}</div>
    </section>
  </div>;
}

export function Race({ round, now, profiles, userId, code, onLeave, onSkip, disabled }) {
  const { frame, leaders, ranks, seconds, moment } = raceView(round, now);
  const [picksOpen, setPicksOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(RACE_VIEWPORT_QUERY);
    const original = document.body.style.overflow;
    const resize = () => { document.body.style.overflow = media.matches ? 'hidden' : original; };
    resize();
    media.addEventListener('change', resize);
    return () => { media.removeEventListener('change', resize); document.body.style.overflow = original; };
  }, []);
  const chosen = round.horses.find((h) => h.id === round.myAction?.choice);
  return (
    <section className="horse-game horse-live race-screen" aria-label="สนามแข่งม้าสด">
      <div className="race-canvas" inert={picksOpen ? true : undefined}>
      <header className="race-topbar">
        <div><small>สนามสด{code ? ` · ${code}` : ''}</small><strong>{moment}</strong></div>
        <span className="race-clock" aria-label={`เหลือ ${seconds} วินาที`}>{seconds}<small>วิ</small></span>
        {onSkip && <button className="race-skip" disabled={disabled} onClick={onSkip}>ข้าม</button>}
        {onLeave && <button className="icon-button" onClick={onLeave} aria-label="ออกจากวง"><Icon name="exit" size={20} /></button>}
      </header>
      <div className="race-leaders" aria-label="สามอันดับขณะนี้">
        <span>กำลังนำ</span>
        {leaders.map(([id], i) => (
          <strong key={id} style={{ '--horse-color': round.horses.find((h) => h.id === id)?.color }}>
            {i + 1}. #{id} {round.horses.find((h) => h.id === id)?.name}
          </strong>
        ))}
      </div>
      <div className="race-board" aria-label="ม้าทั้ง 8 ลู่">
      {round.horses.map((horse) => {
        const row = frame.find((r) => r[0] === horse.id);
        const position = Math.max(0, Math.min(100, ((row?.[1] || 0) / 2500) * 100));
        const mine = chosen?.id === horse.id;
        const picks = (round.picks || []).filter((p) => p.horseId === horse.id);
        return (
          <div
            className={`horse-lane ${mine ? "my-horse-lane" : ""} ${ranks.get(horse.id) === 1 ? 'is-leading' : ''}`}
            key={horse.id}
            style={{ "--horse-color": horse.color }}
            aria-label={`ม้า ${horse.id} ${horse.name}${mine ? ' คุณเชียร์' : ''} อันดับ ${ranks.get(horse.id) || 'รอเริ่ม'}`}
          >
            <div className="horse-lane-heading">
              <strong><b>#{horse.id}</b> {horse.name}</strong>
              <span className="race-cheerers" aria-label={`${picks.length} คนเชียร์${mine ? ' รวมคุณ' : ''}`}>
                {mine && <em>คุณ</em>}
                {picks.slice(0, 3).map((p) => <span key={p.userId} title={profiles[p.userId]?.username}>{getAvatarEmoji(profiles[p.userId]?.avatar)}</span>)}
                {picks.length > 3 && <small>+{picks.length - 3}</small>}
                {!picks.length && <small>กองเชียร์ —</small>}
              </span>
            </div>
            <div className="horse-runway">
              <span className="race-distance-bar" style={{ width: `${position}%` }} aria-hidden="true" />
              <div
                className="horse-runner"
                style={{ left: `calc(${position}% - var(--race-runner-width) * ${position / 100})` }}
              >
                <HorsePortrait horse={horse} />
                <b className="race-saddle-number">{horse.id}</b>
                {row?.[2] && <span className={`race-event ${row[2]}`} aria-label={row[2] === 'burst' ? 'พุ่ง' : 'สะดุด'}>{row[2] === 'burst' ? '↗' : '!'}</span>}
              </div>
              <span className="horse-finish-line" />
            </div>
            <span className={`race-rank ${ranks.get(horse.id) <= 3 ? 'top-three' : ''}`} aria-label={`อันดับ ${ranks.get(horse.id) || 'รอเริ่ม'}`}>{ranks.get(horse.id) || '—'}</span>
          </div>
        );
      })}
      </div>
      <footer className="race-watch-footer">
        <div>{chosen ? <><small>ม้าของคุณ</small><strong>#{chosen.id} {chosen.name} <span>· อันดับ {ranks.get(chosen.id) || '—'}/8</span></strong></> : <strong>กองเชียร์ · ลุ้นท็อป 3 ไปด้วยกัน</strong>}</div>
        <button className="race-picks-toggle" onClick={() => setPicksOpen(true)}><Icon name="users" size={17} /> ดูโพยเพื่อน</button>
      </footer>
      </div>
      {picksOpen && <RacePicks round={round} profiles={profiles} userId={userId} onClose={() => setPicksOpen(false)} />}
    </section>
  );
}

export function HorseResults({ state, userId }) {
  const { round, profiles } = state;
  const result = round.result;
  const me = result.players.find((p) => p.userId === userId);
  const groups = [
    {
      key: "penalty",
      title: "รับบทลงโทษ",
      people: result.players.filter((p) => !p.missed && !p.safe),
      empty: "รอบนี้ไม่มีใครรับบทลงโทษ",
    },
    {
      key: "safe",
      title: "รอดรอบนี้",
      people: result.players.filter((p) => p.safe),
      empty: "ยังไม่มีคนรอดในรอบนี้",
    },
    {
      key: "missed",
      title: "ไม่ได้เลือก · ไม่คิดผล",
      people: result.players.filter((p) => p.missed),
    },
  ];
  return (
    <div className="horse-game horse-results">
      <span className="eyebrow">PHOTO FINISH · ROUND {state.roundNumber}</span>
      <h2>{result.title}</h2>
      <p className="horse-footnote">ท็อป 3 รอด · อันดับ 4–8 รับบทลงโทษ</p>
      {me && (
        <div
          className={`horse-personal-result ${me.missed ? "missed" : me.safe ? "safe" : "penalty"}`}
          role="status"
        >
          <span aria-hidden="true">{me.missed ? "—" : me.safe ? "✦" : "!"}</span>
          <div>
            <small>ผลของคุณ</small>
            <strong>
              {me.missed
                ? "ไม่ได้เลือก ไม่คิดผล"
                : me.safe
                  ? "คุณรอดรอบนี้"
                  : "รับบทลงโทษ"}
            </strong>
            <p>
              {me.rank
                ? `#${me.choice} ${round.horses.find((h) => h.id === me.choice)?.name} · อันดับ ${me.rank} · +${me.points} แต้ม`
                : "เลือกม้ารอบถัดไปได้เลย"}
            </p>
          </div>
        </div>
      )}
      <div className="horse-outcome-groups">
        {groups
          .filter((g) => g.people.length || g.empty)
          .map((g) => (
            <section className={`horse-outcome ${g.key}`} key={g.key}>
              <h3>
                {g.title} <span>{g.people.length} คน</span>
              </h3>
              {g.people.length ? (
                g.people.map((p) => (
                  <div className="horse-result-person" key={p.userId}>
                    <span>{getAvatarEmoji(profiles[p.userId]?.avatar)}</span>
                    <div>
                      <strong>
                        {profiles[p.userId]?.username}
                        {p.userId === userId ? " (คุณ)" : ""}
                      </strong>
                      <small>
                        {p.rank
                          ? `เลือก #${p.choice} ${round.horses.find((h) => h.id === p.choice)?.name} · เข้าอันดับ ${p.rank}`
                          : "ไม่ได้ส่งตัวเลือกในเวลา"}
                      </small>
                    </div>
                    {p.rank && <b>{p.safe ? "รอด" : "รับบทลงโทษ"}</b>}
                  </div>
                ))
              ) : (
                <p>{g.empty}</p>
              )}
            </section>
          ))}
      </div>
      <section className="horse-final-board">
        <div className="horse-section-heading">
          <h3>อันดับเข้าเส้นชัย</h3>
          <span>1–3 รอด / 4–8 รับบทลงโทษ</span>
        </div>
        {round.rankings.map((r) => {
          const horse = round.horses.find((h) => h.id === r.id);
          return (
            <div
              className={`horse-standing ${r.rank <= 3 ? "top-three" : ""}`}
              key={r.id}
              style={{ "--horse-color": horse.color }}
            >
              <b className="horse-place">{r.rank}</b>
              <HorsePortrait horse={horse} />
              <div className="horse-standing-detail">
                <strong>
                  #{horse.id} {horse.name}
                </strong>
                <Supporters
                  round={round}
                  horseId={horse.id}
                  profiles={profiles}
                  userId={userId}
                />
              </div>
              <span className="horse-rank-outcome">
                {r.rank <= 3 ? "รอด" : "รับบทลงโทษ"}
              </span>
            </div>
          );
        })}
      </section>
      <Gurus round={round} reveal />
    </div>
  );
}
