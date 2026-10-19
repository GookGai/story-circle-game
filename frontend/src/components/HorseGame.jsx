import { getAvatarEmoji } from "../utils/avatars";

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
                  {g.hit ? "ลูกศิษย์รอด" : "ลูกศิษย์ต้องดื่ม"}
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
          โพยชวนคุยจากฟอร์มและดวงของรอบนี้ · กูรูไม่รู้ผลล่วงหน้า
          เปลี่ยนใจได้ก่อนแข่ง
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
        <span>อันดับ 4–8 ดื่ม 1 ครั้ง · ไม่ได้เลือกไม่คิดผล</span>
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
                <strong className="horse-ability">{horse.ability}</strong>
                <span className="horse-ability-description">
                  {horse.abilityDescription}
                </span>
                <span className="horse-form">
                  {[
                    ["speed", "เร็ว"],
                    ["stamina", "อึด"],
                    ["luck", "ดวง"],
                  ].map(([key, label]) => (
                    <span key={key}>
                      {label}
                      <b aria-label={`${horse.form?.[key] || 1} จาก 5`}>
                        {"▰".repeat(horse.form?.[key] || 1)}
                        <i>{"▰".repeat(5 - (horse.form?.[key] || 1))}</i>
                      </b>
                    </span>
                  ))}
                </span>
                <span className="horse-select-label">
                  {selected ? "✓ คุณเลือกตัวนี้" : "เลือกตัวนี้ →"}
                </span>
              </button>
              <div className="horse-guru-votes">
                {(round.gurus || [])
                  .filter((g) => g.pickId === horse.id)
                  .map((g) => (
                    <span key={g.id}>
                      {g.avatar} {g.name} ให้ 5 ★
                    </span>
                  ))}
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

export function Race({ round, now, profiles, userId }) {
  const progress = Math.max(
    0,
    Math.min(
      1,
      (now - round.raceStartedAt) / (round.raceEndsAt - round.raceStartedAt),
    ),
  );
  const frame =
    round.frames?.[
      Math.min(
        round.frames.length - 1,
        Math.floor(progress * round.frames.length),
      )
    ] || [];
  const leaders = [...frame].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const chosen = round.horses.find((h) => h.id === round.myAction?.choice);
  return (
    <div className="horse-game horse-live">
      <div className="horse-rules">
        <strong>เชียร์ให้ติดท็อป 3!</strong>
        <span>
          {chosen
            ? `คุณเชียร์ #${chosen.id} ${chosen.name}`
            : "รอบนี้คุณเป็นกองเชียร์"}
        </span>
      </div>
      <div className="race-leaders">
        <span>กำลังนำ</span>
        {leaders.map(([id], i) => (
          <strong key={id}>
            {i + 1}. #{id} {round.horses.find((h) => h.id === id)?.name}
          </strong>
        ))}
      </div>
      {round.horses.map((horse) => {
        const row = frame.find((r) => r[0] === horse.id);
        const position = Math.min(100, ((row?.[1] || 0) / 2500) * 100);
        const mine = chosen?.id === horse.id;
        return (
          <div
            className={`horse-lane ${mine ? "my-horse-lane" : ""}`}
            key={horse.id}
            style={{ "--horse-color": horse.color }}
          >
            <div className="horse-lane-heading">
              <b>#{horse.id}</b>
              <strong>{horse.name}</strong>
              {mine && <em>คุณเชียร์</em>}
              <span className="horse-event">
                {row?.[2] === "burst"
                  ? "พุ่ง! 🚀"
                  : row?.[2] === "stumble"
                    ? "สะดุด!"
                    : horse.symbol}
              </span>
            </div>
            <div className="horse-runway">
              <div
                className="horse-runner"
                style={{ left: `calc(${position}% - ${position * 0.64}px)` }}
              >
                <HorsePortrait horse={horse} />
              </div>
              <span className="horse-finish-line" />
            </div>
            <Supporters
              round={round}
              horseId={horse.id}
              profiles={profiles}
              userId={userId}
            />
          </div>
        );
      })}
    </div>
  );
}

export function HorseResults({ state, userId }) {
  const { round, profiles } = state;
  const result = round.result;
  const me = result.players.find((p) => p.userId === userId);
  const groups = [
    {
      key: "drink",
      title: "ต้องดื่ม 1 ครั้ง",
      people: result.players.filter((p) => !p.missed && !p.safe),
      empty: "รอบนี้ไม่มีใครต้องดื่ม",
    },
    {
      key: "safe",
      title: "รอด ไม่ต้องดื่ม",
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
      <p className="horse-footnote">ท็อป 3 รอด · อันดับ 4–8 ดื่ม 1 ครั้ง</p>
      {me && (
        <div
          className={`horse-personal-result ${me.missed ? "missed" : me.safe ? "safe" : "drink"}`}
          role="status"
        >
          <span>{me.missed ? "—" : me.safe ? "✦" : "ชนแก้ว!"}</span>
          <div>
            <small>ผลของคุณ</small>
            <strong>
              {me.missed
                ? "ไม่ได้เลือก ไม่คิดผล"
                : me.safe
                  ? "คุณรอด ไม่ต้องดื่ม"
                  : "คุณต้องดื่ม 1 ครั้ง"}
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
                    {p.rank && <b>{p.safe ? "รอด" : "ดื่ม 1 ครั้ง"}</b>}
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
          <span>1–3 รอด / 4–8 ดื่ม</span>
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
                {r.rank <= 3 ? "รอด" : "ดื่ม 1 ครั้ง"}
              </span>
            </div>
          );
        })}
      </section>
      <Gurus round={round} reveal />
    </div>
  );
}
