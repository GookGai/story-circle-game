import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import QRCode from "qrcode";
import { useAuth } from "../hooks/useAuth";
import { useParty } from "../hooks/useParty";
import { api } from "../utils/api";
import { getAvatarEmoji } from "../utils/avatars";
import Icon from "../components/PartyIcon";
import { HorseInput, Race, HorseResults } from "../components/HorseGame";
import ParachuteGame, { ParachuteResults } from '../components/ParachuteGame';

import { ReadyDock, ReadyRollCall } from "../components/ReadyControls";
import RoomConfirmation from "../components/RoomConfirmation";
import { publicOrigin, isNativeApp } from "../utils/platform";
import { roomInviteUrl } from "../utils/appLinks.mjs";
import { Share } from "@capacitor/share";
import { Clipboard } from "@capacitor/clipboard";
import { readiness, playerStatus } from "../utils/readiness";
import {
  ForbiddenGame,
  ForbiddenSettings,
  ForbiddenSummary,
} from "../components/ForbiddenGame";

const gameLabels = {
  FORBIDDEN_WORD: ["คำต้องห้ามประจำตัว", "secret"],
  HORSE_RACE: ["แข่งม้า", "horse"],
  MINORITY_VOTE: ["โหวตข้างน้อย", "vote"],
  PANIC_JUMP: ["ร่มชูชีพวัดใจ", "jump"],
  MIXED: ["เล่นผสม", "spark"],
};

function Avatar({ member, small = false }) {
  return (
    <span className={`avatar-bubble ${small ? "small" : ""}`}>
      {getAvatarEmoji(member?.avatar)}
    </span>
  );
}

function Invite({ code }) {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const url = roomInviteUrl(code, publicOrigin);
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, {
      width: 360,
      margin: 2,
      color: { dark: "#20211d", light: "#faf6ed" },
    })
      .then((value) => {
        if (active) setQr(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [url]);
  async function copy() {
    try {
      if (isNativeApp) await Clipboard.write({ string: url, label: 'ลิงก์เข้าวง Story Circle' });
      else await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("คัดลอกไม่ได้ ให้เพื่อนกรอกรหัสวงด้านบน");
    }
  }
  return (
    <section className="invite-panel">
      <div className="eyebrow">THE MORE, THE MERRIER</div>
      <h3>ชวนเพื่อนเข้าวง</h3>
      <div className="qr-paper">
        {qr ? (
          <img src={qr} alt={`QR เข้าวง ${code}`} width="180" height="180" />
        ) : (
          <span>ใช้รหัสวงด้านล่างได้เลย</span>
        )}
        <strong>{code}</strong>
      </div>
      <p>
        สแกนด้วยกล้องมือถือ
        <br />
        หรือกรอกรหัสบนหน้าแรก
      </p>
      <button className="p-button outline full" onClick={copy}>
        <Icon name={copied ? "check" : "link"} size={18} />
        {copied ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์ชวนเพื่อน"}
      </button>
      {error && <p role="status">{error}</p>}
      {isNativeApp && <button className="p-button outline full" onClick={async () => {
        try { await Share.share({ title: 'เข้าวง Story Circle', text: `มาเล่นด้วยกัน · รหัส ${code}`, url }); }
        catch { /* Dismissing the share sheet leaves the invitation visible. */ }
      }}>แชร์ลิงก์ชวนเพื่อน</button>}
    </section>
  );
}

function Settings({ config, games, command, disabled, forbiddenConfig }) {
  const [custom, setCustom] = useState({
    question: "",
    optionA: "",
    optionB: "",
  });
  const [saved, setSaved] = useState(false);
  const update = (patch) => command("CONFIG", { ...config, ...patch });
  return (
    <section className="room-settings">
      <div className="eyebrow">เลือกจังหวะของวง</div>
      <div className="game-picker">
        {games.map((game) => (
          <button
            key={game.type}
            className={`game-pick ${config.gameType === game.type ? "selected" : ""}`}
            aria-pressed={config.gameType === game.type}
            disabled={disabled}
            onClick={() => update({ gameType: game.type })}
          >
            <Icon name={game.icon} size={25} />
            <strong>{game.name}</strong>
            <span>{game.type === "PANIC_JUMP" ? "3–10 คน" : "2–10 คน"}</span>
            {config.gameType === game.type && <Icon name="check" size={17} />}
          </button>
        ))}
      </div>
      {config.gameType === "FORBIDDEN_WORD" ? (
        <ForbiddenSettings
          settings={forbiddenConfig}
          command={command}
          disabled={disabled}
        />
      ) : (
        <>
          <div className="settings-row">
            <label>
              จำนวนรอบ
              <select
                value={config.totalRounds}
                disabled={disabled}
                onChange={(e) =>
                  update({ totalRounds: Number(e.target.value) })
                }
              >
                <option value="3">3 รอบ · ลองก่อน</option>
                <option value="6">6 รอบ · กำลังดี</option>
                <option value="9">9 รอบ · เล่นยาว</option>
              </select>
            </label>
            <label>
              ชุดคำถาม
              <select
                value={config.category}
                disabled={disabled}
                onChange={(e) => update({ category: e.target.value })}
              >
                <option value="all">รวมทุกอารมณ์</option>
                <option value="warmup">เริ่มวงสบาย ๆ</option>
                <option value="friends">เรื่องของเพื่อน</option>
                <option value="chaos">สมมติกวน ๆ</option>
              </select>
            </label>
          </div>
          <p className="field-note">
            วง 2 คนจะเล่นโหมดใจตรงกันแทนโหวตข้างน้อย · ร่มชูชีพเริ่มที่ 3 คน
          </p>
          <details className="custom-question">
            <summary>อยากถามเรื่องในวง? เขียนคำถามเอง</summary>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const ok = await command("CUSTOM_QUESTION", custom);
                if (ok) setSaved(true);
              }}
            >
              <label>
                คำถาม
                <input
                  className="p-input"
                  required
                  maxLength={140}
                  value={custom.question}
                  onChange={(e) => {
                    setSaved(false);
                    setCustom({ ...custom, question: e.target.value });
                  }}
                  placeholder="เลือกอะไรดีระหว่าง…"
                />
              </label>
              <div className="settings-row">
                {["A", "B"].map((choice) => (
                  <label key={choice}>
                    ตัวเลือก {choice}
                    <input
                      className="p-input"
                      required
                      maxLength={70}
                      value={custom[`option${choice}`]}
                      onChange={(e) => {
                        setSaved(false);
                        setCustom({
                          ...custom,
                          [`option${choice}`]: e.target.value,
                        });
                      }}
                    />
                  </label>
                ))}
              </div>
              <button className="p-button outline full" disabled={disabled}>
                {saved
                  ? "เตรียมคำถามนี้ไว้ตาถัดไปแล้ว"
                  : "ใช้คำถามนี้ในตาถัดไป"}
              </button>
            </form>
          </details>
        </>
      )}
    </section>
  );
}

function Players({ members, hostId, state, userId }) {
  return (
    <section className="people-panel">
      <div className="panel-label">
        <h3>คนในวง</h3>
        <span>{members.length}/10</span>
      </div>
      <div className="people-list">
        {members.map((member) => (
          <div key={member.id} className="person-row">
            <div className="person-avatar">
              <Avatar member={member} />
              <span
                className={`presence-dot ${member.online ? "online" : ""}`}
              />
            </div>
            <div className="person-identity">
              <strong>
                {member.username} {member.id === userId && <small>(คุณ)</small>}
              </strong>
              <span>
                {member.id === hostId ? "เจ้าวง · " : ""}
                {playerStatus(member, state, hostId)}
              </span>
            </div>
            {member.id === hostId ? (
              <Icon name="crown" size={18} />
            ) : playerStatus(member, state, hostId) === "พร้อมแล้ว" ? (
              <Icon name="check" size={18} />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function RoundTimer({ now, round, phase }) {
  const preparing = now < round.startsAt;
  const end =
    phase === "RACING"
      ? round.raceEndsAt
      : preparing
        ? round.startsAt
        : round.deadlineAt;
  const seconds = Math.max(0, Math.ceil((end - now) / 1000));
  return (
    <div
      className={`round-timer ${seconds <= 5 && !preparing ? "urgent" : ""}`}
      aria-label={`${preparing ? "เริ่มใน" : "เหลือ"} ${seconds} วินาที`}
    >
      <span>
        {preparing ? "เริ่มใน" : phase === "RACING" ? "ลุ้นอีก" : "เหลือ"}
      </span>
      <strong>{String(seconds).padStart(2, "0")}</strong>
      <span>วินาที</span>
    </div>
  );
}

function VoteInput({ round, disabled, command }) {
  const q = round.question;
  return (
    <div className="vote-stage">
      <div className="question-category">
        {round.mode === "MATCH"
          ? "คิดให้ตรงกัน โดยไม่บอกกันก่อน"
          : "เลือกข้างที่คิดว่าเพื่อนส่วนใหญ่จะเลือก"}
      </div>
      <h2>{q.question}</h2>
      <div className="vote-choices">
        {["A", "B"].map((choice, index) => (
          <button
            key={choice}
            className={`party-vote-option option-${choice.toLowerCase()} ${round.myAction?.choice === choice ? "selected" : ""}`}
            aria-pressed={round.myAction?.choice === choice}
            disabled={disabled}
            onClick={() => command("VOTE", { choice })}
          >
            <span className="option-letter">{choice}</span>
            <strong>{index === 0 ? q.optionA : q.optionB}</strong>
            <span className="vote-selection">
              {round.myAction?.choice === choice ? (
                <>
                  <Icon name="check" size={18} /> ส่งแล้ว
                </>
              ) : (
                "เลือกข้างนี้"
              )}
              <Icon name="arrow" size={20} />
            </span>
          </button>
        ))}
      </div>
      <p className="round-hint">
        {round.myAction
          ? "ส่งแล้ว เปลี่ยนใจได้ก่อนครบทุกคนหรือหมดเวลา"
          : "กดเลือกได้เลย · เฉลยเมื่อทุกคนส่งหรือหมดเวลา"}
      </p>
    </div>
  );
}

function Results({ state, userId }) {
  const round = state.round,
    result = round.result;
  if (round.gameType === "HORSE_RACE" && !result.skipped)
    return <HorseResults state={state} userId={userId} />;
  if (round.gameType === 'PANIC_JUMP' && round.jumpFlow === 2 && !result.skipped)
    return <ParachuteResults state={state} userId={userId} />;
  const me = result.players.find((p) => p.userId === userId);
  return (
    <div className="results-stage">
      <div className={`result-seal ${me?.safe ? "safe" : ""}`}>
        <Icon
          name={result.skipped ? "pause" : me?.safe ? "trophy" : "spark"}
          size={40}
        />
      </div>
      <span className="eyebrow">
        ROUND {String(state.roundNumber).padStart(2, "0")} · RESULTS
      </span>
      <h2>{result.title}</h2>
      <p className="result-description">{result.description}</p>
      {round.gameType === "MINORITY_VOTE" && !result.skipped && (
        <div className="vote-result-split">
          {["A", "B"].map((choice) => (
            <div key={choice}>
              <span>{choice}</span>
              <strong>
                {round.question[choice === "A" ? "optionA" : "optionB"]}
              </strong>
              <b>{choice === "A" ? result.a : result.b} คน</b>
              <div className="voter-avatars">
                {result.players
                  .filter((p) => p.choice === choice)
                  .map((p) => (
                    <span
                      key={p.userId}
                      title={state.profiles[p.userId]?.username}
                    >
                      {getAvatarEmoji(state.profiles[p.userId]?.avatar)}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {me && (
        <div className={`my-result ${me.safe ? "safe" : ""}`}>
          <div>
            <span>รอบนี้ของคุณ</span>
            <strong>{me.reason}</strong>
          </div>
          <b>
            +{me.points}
            <small>{round.gameType === "PANIC_JUMP" ? "ดาว" : "แต้ม"}</small>
          </b>
        </div>
      )}
      <div className="result-people">
        {result.players.map((player) => (
          <div key={player.userId}>
            <Avatar member={state.profiles[player.userId]} small />
            <span>
              {state.profiles[player.userId]?.username || "เพื่อนในวง"}
            </span>
            <small>
              {player.order ? `#${player.order} · ` : ""}
              {player.reason}
            </small>
            <b>+{player.points}</b>
          </div>
        ))}
      </div>
      {!result.skipped && (
        <p className="result-conversation">
          {round.gameType === "MINORITY_VOTE"
            ? "คุยกันก่อนก็ได้ รอบต่อไปไม่หนีไปไหน"
            : "ลุ้นด้วยกันแล้ว แซวกันได้เลย"}
        </p>
      )}
    </div>
  );
}

function Summary({ state, host, command, disabled, code }) {
  const [tab, setTab] = useState("HORSE_RACE");
  const [shared, setShared] = useState("");
  const playedGames = Object.keys(gameLabels).filter(
    (type) =>
      type !== "MIXED" && state.history.some((r) => r.gameType === type),
  );
  const selected = playedGames.includes(tab) ? tab : playedGames[0];
  const rows = Object.entries(state.scores).sort(
    (a, b) => (b[1][selected] || 0) - (a[1][selected] || 0),
  );
  async function share() {
    const text = `วงนี้ที่ Story Circle · เล่นด้วยกัน ${state.history.filter((r) => !r.skipped).length} รอบ\n${state.history
      .filter((r) => !r.skipped)
      .slice(-3)
      .map((r) => `• ${r.title}`)
      .join("\n")}\nมาเปิดวงกันที่ ${publicOrigin}`;
    try {
      if (isNativeApp) await Share.share({ title: "Story Circle · โมเมนต์ของวง", text });
      else if (navigator.share)
        await navigator.share({
          title: "Story Circle · โมเมนต์ของวง",
          text,
        });
      else {
        await navigator.clipboard.writeText(text);
        setShared("คัดลอกสรุปแล้ว");
      }
    } catch (error) {
      if (error.name !== "AbortError") setShared("แชร์ไม่ได้ในเบราว์เซอร์นี้");
    }
  }
  return (
    <section className="summary-stage">
      <div className="summary-orbit">
        <Icon name="trophy" size={55} />
      </div>
      <span className="eyebrow">THAT WAS A GOOD GAME.</span>
      <h1>
        โมเมนต์ของวง
        <br />
        <span className="accent">เก็บไว้เล่าต่อ.</span>
      </h1>
      <p>
        {Object.keys(state.profiles).length} เพื่อน ·{" "}
        {state.history.filter((r) => !r.skipped).length} รอบที่เล่นด้วยกัน · วง{" "}
        {code}
      </p>
      {playedGames.length > 0 && (
        <>
          <div className="score-tabs" role="tablist" aria-label="คะแนนรายเกม">
            {playedGames.map((type) => (
              <button
                key={type}
                role="tab"
                aria-selected={selected === type}
                onClick={() => setTab(type)}
              >
                {gameLabels[type][0]}
              </button>
            ))}
          </div>
          <div className="summary-scores">
            {rows.map(([id, score], index) => (
              <div key={id}>
                <span className="score-place">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Avatar member={state.profiles[id]} />
                <strong>{state.profiles[id]?.username}</strong>
                <b>
                  {score[selected] || 0}
                  <small>{selected === "PANIC_JUMP" ? "ดาว" : "แต้ม"}</small>
                </b>
              </div>
            ))}
          </div>
          <p className="field-note">
            แสดงคะแนนแยกแต่ละเกม เพราะใช้เกณฑ์ให้แต้มต่างกัน
          </p>
        </>
      )}
      <div className="night-moments">
        <h3>โมเมนต์ของวง</h3>
        {state.history
          .filter((r) => !r.skipped)
          .slice(-4)
          .map((r) => (
            <div key={r.id}>
              <span>ตาที่ {r.number}</span>
              <strong>{r.title}</strong>
            </div>
          ))}
      </div>
      <div className="summary-actions">
        <button className="p-button outline" onClick={share}>
          <Icon name="link" size={18} />
          {shared || "แชร์โมเมนต์ของวง"}
        </button>
        {host && (
          <button
            className="p-button primary"
            disabled={disabled}
            onClick={() => command("RESET")}
          >
            เปิดอีกวง <Icon name="arrow" size={18} />
          </button>
        )}
      </div>
      <p className="summary-signoff">
        ขอบคุณที่อยู่ในวงเดียวกัน · สรุปนี้เก็บไว้ 24 ชั่วโมงหลังจบวง
      </p>
    </section>
  );
}

export default function PartyRoom() {
  const { code: rawCode } = useParams();
  const code = rawCode.toUpperCase();
  const { user } = useAuth();
  const {
    snapshot,
    command,
    connected,
    pending,
    pendingCommand,
    error,
    setError,
    sync,
    leave,
    offset,
  } = useParty(code);
  const [games, setGames] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [roomAction, setRoomAction] = useState(null);
  const cancelRoomAction = useCallback(() => setRoomAction(null), []);
  const cancelLeave = useCallback(() => setConfirmLeave(false), []);
  useEffect(() => {
    api
      .get("/api/games")
      .then((data) => setGames(data.games))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offset), 100);
    return () => clearInterval(timer);
  }, [offset]);
  useEffect(() => {
    localStorage.setItem("party-last-room", code);
  }, [code]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [snapshot?.state.phase, snapshot?.state.round?.id]);
  if (!snapshot)
    return (
      <main className="party-loading">
        <Icon name="dice" size={44} />
        <h1>กำลังกลับเข้าวง…</h1>
        <p>{error || "รอเชื่อมต่อสักครู่ แล้วเรื่องสนุกจะเริ่มต่อ"}</p>
        <button className="p-button primary" onClick={sync}>
          เชื่อมต่ออีกครั้ง
        </button>
        <Link to="/">กลับหน้าแรก</Link>
      </main>
    );
  const { state, room, members } = snapshot;
  const host = room.hostId === user.id;
  const round = state.round;
  const phase = state.phase;
  const active = ["INPUT", "RACING", "FORBIDDEN"].includes(phase);
  const forbiddenSession = round?.gameType === "FORBIDDEN_WORD";
  const between = ["LOBBY", "RESULTS"].includes(phase);
  const disabled = pending || !connected;
  const observer = active && !round.participantIds.includes(user.id);
  const currentType =
    active || phase === "RESULTS" ? round.gameType : state.config.gameType;
  const title =
    round?.mode === "MATCH" && currentType === "MINORITY_VOTE"
      ? "ใจตรงกัน"
      : gameLabels[currentType]?.[0];
  const model = readiness({
    state,
    members,
    hostId: room.hostId,
    userId: user.id,
  });
  const lastRound = state.roundNumber >= state.config.totalRounds;
  const nextLabel =
    state.config.gameType === "FORBIDDEN_WORD"
      ? `คำต้องห้าม · ${state.forbiddenConfig?.durationMinutes ? `${state.forbiddenConfig.durationMinutes} นาที` : "เล่นจนเจ้าวงกดจบ"}`
      : phase === "LOBBY"
        ? `เริ่มด้วย: ${gameLabels[state.config.gameType]?.[0]} · ${state.config.totalRounds} ตา`
        : `ตาถัดไป ${state.roundNumber + 1}/${state.config.totalRounds} · ${gameLabels[state.config.gameType]?.[0]}`;
  const actionIsCurrent =
    roomAction &&
    roomAction.phase === phase &&
    roomAction.roundId === round?.id;

  return (
    <div
      className={`party-workspace ${between ? "has-action-dock" : phase === "FORBIDDEN" ? "has-forbidden-dock" : ""} ${phase === 'INPUT' && currentType === 'PANIC_JUMP' ? 'is-parachute-room' : ''}`}
    >
      <header className="room-nav">
        <Link to="/" className="wordmark">
          <span className="brand-symbol">
            <Icon name="dice" size={20} />
          </span>
          story circle.
        </Link>
        <div className="room-code-label">
          <span>วงของเรา</span>
          <strong>{room.code}</strong>
        </div>
        <button
          className="icon-button"
          aria-label="ออกจากวง"
          onClick={() => setConfirmLeave(true)}
        >
          <Icon name="exit" size={21} />
        </button>
      </header>
      {!connected && (
        <div className="connection-banner" role="status">
          <Icon name="wifi" size={18} />
          กำลังเชื่อมต่อกลับ… รอบและคะแนนยังอยู่
        </div>
      )}
      {error && (
        <div className="workspace-error" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="ปิดข้อความ">
            <Icon name="close" size={18} />
          </button>
        </div>
      )}
      {phase === "FINISHED" ? (
        forbiddenSession ? (
          <ForbiddenSummary
            state={state}
            command={command}
            disabled={disabled}
            host={host}
          />
        ) : (
          <Summary
            state={state}
            host={host}
            command={command}
            disabled={disabled}
            code={code}
          />
        )
      ) : (
        <>
          <div className="room-heading">
            <div>
              <span className="eyebrow">
                {phase === "LOBBY"
                  ? "GATHER YOUR PEOPLE."
                  : phase === "PAUSED"
                    ? "TAKE YOUR TIME."
                    : forbiddenSession
                      ? "WORD HUNT · เปลี่ยนคำทุก 180 วินาที"
                      : `ROUND ${String(state.roundNumber).padStart(2, "0")} / ${String(state.config.totalRounds).padStart(2, "0")}`}
              </span>
              <h1>
                {phase === "LOBBY"
                  ? "วงเพื่อน พร้อมเล่น."
                  : phase === "PAUSED"
                    ? "พักแป๊บ เดี๋ยวมา."
                    : title}
              </h1>
              <p>
                {phase === "LOBBY"
                  ? "ชวนเพื่อนเข้ามา แล้วกดพร้อมก่อนเริ่มเล่น"
                  : phase === "PAUSED"
                    ? "กินข้าว คุยกันก่อน กลับมาเมื่อพร้อม"
                    : phase === "FORBIDDEN"
                      ? "เห็นคำเพื่อน แต่ไม่เห็นคำตัวเอง · เปลี่ยนคำทุก 180 วินาที"
                      : observer
                        ? "คุณเข้ามาระหว่างรอบ · ดูเพื่อนเล่น แล้วเริ่มรอบหน้าได้เลย"
                        : phase === "INPUT"
                          ? round.mode === "MATCH"
                            ? "เลือกให้ตรงกัน โดยไม่บอกกันก่อน · ใจตรงกันรอดทั้งคู่"
                            : games.find((g) => g.type === currentType)?.rule
                          : phase === "RACING"
                            ? "เชียร์ตัวโปรดไปพร้อมกัน"
                            : "เฉลยแล้ว คุยกันก่อนเล่นต่อได้เลย"}
              </p>
            </div>
            {active && phase !== "FORBIDDEN" && (
              <RoundTimer now={now} round={round} phase={phase} />
            )}
          </div>
          <div className={`room-layout ${active ? "is-playing" : ""}`}>
            <main className="room-main">
              {phase === "LOBBY" && (
                <ReadyRollCall
                  model={model}
                  nextLabel={nextLabel}
                  hostId={room.hostId}
                  userId={user.id}
                />
              )}
              {phase === "LOBBY" && (
                <>
                  <details className="mobile-invite">
                    <summary>
                      เปิด QR ชวนเพื่อนเข้าวง <Icon name="link" size={17} />
                    </summary>
                    <Invite code={code} />
                  </details>
                  <div className="lobby-welcome">
                    <span className="circle-graphic">
                      <Icon name="users" size={52} />
                    </span>
                    <div>
                      <span className="eyebrow">A SEAT FOR EVERY FRIEND</span>
                      <h2>
                        {members.length < 2
                          ? "อีกคนเดียว ก็เริ่มสนุกได้"
                          : `${members.length} คนแล้ว พร้อมไปด้วยกันไหม?`}
                      </h2>
                      <p>
                        ไม่ต้องมีจอใหญ่ ไม่ต้องมีคนอธิบายยาว
                        <br />
                        ใช้มือถือคนละเครื่องก็เล่นได้เลย
                      </p>
                    </div>
                  </div>
                  {host ? (
                    <Settings
                      config={state.config}
                      forbiddenConfig={state.forbiddenConfig}
                      games={games}
                      command={command}
                      disabled={disabled}
                    />
                  ) : (
                    <div className="chosen-game">
                      <Icon
                        name={gameLabels[state.config.gameType]?.[1]}
                        size={32}
                      />
                      <div>
                        <span>รอบแรกเริ่มด้วย</span>
                        <h3>{gameLabels[state.config.gameType]?.[0]}</h3>
                        <p>
                          {state.config.gameType === "FORBIDDEN_WORD"
                            ? "เปลี่ยนคำทุก 180 วินาที · รับคำใหม่ได้เมื่อโดนจับ"
                            : `${state.config.totalRounds} รอบ · เจ้าวงเลือกให้แล้ว`}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
              {phase === "PAUSED" && (
                <div className="paused-stage">
                  <Icon name="pause" size={68} />
                  <h2>วงยังอยู่ตรงนี้</h2>
                  <p>ไม่มีนาฬิกาเร่ง ไม่ต้องรีบกลับมา</p>
                  {host ? (
                    <button
                      className="p-button primary"
                      onClick={() => command("RESUME")}
                      disabled={disabled}
                    >
                      ทุกคนกลับมาแล้ว เล่นต่อ <Icon name="arrow" size={20} />
                    </button>
                  ) : (
                    <p className="dim">รอเจ้าวงเปิดเล่นต่อ</p>
                  )}
                  {host && forbiddenSession && (
                    <button
                      className="text-button"
                      disabled={disabled}
                      onClick={() =>
                        setRoomAction({ type: "END", roundId: round.id, phase })
                      }
                    >
                      จบวงและดูสรุป
                    </button>
                  )}
                </div>
              )}
              {phase === "INPUT" && (
                <>
                  <div className="input-progress">
                    <span>
                      {observer
                        ? "ดูรอบนี้ไปก่อน"
                        : round.myAction
                          ? "รับคำตอบของคุณแล้ว"
                          : now < round.startsAt
                            ? "เตรียมพร้อม เริ่มพร้อมกัน"
                            : "ถึงตาคุณแล้ว"}
                    </span>
                    <b>
                      {round.submitted}/{round.participantIds.length} คนส่งแล้ว
                    </b>
                  </div>
                  {currentType === "HORSE_RACE" ? (
                    <HorseInput
                      profiles={state.profiles}
                      userId={user.id}
                      round={round}
                      disabled={
                        disabled ||
                        observer ||
                        now < round.startsAt ||
                        now >= round.deadlineAt
                      }
                      command={command}
                    />
                  ) : currentType === "MINORITY_VOTE" ? (
                    <VoteInput
                      round={round}
                      disabled={
                        disabled ||
                        observer ||
                        now < round.startsAt ||
                        now >= round.deadlineAt
                      }
                      command={command}
                    />
                  ) : (
                    <ParachuteGame
                      round={round}
                      error={error}
                      profiles={state.profiles}
                      userId={user.id}
                      observer={observer}
                      connected={connected}
                      pending={pending}
                      code={code}
                      onLeave={() => setConfirmLeave(true)}
                      onSkip={host ? () => setRoomAction({ type: 'SKIP', roundId: round.id, phase }) : undefined}
                      disabled={
                        disabled ||
                        observer ||
                        now < round.startsAt ||
                        now >= round.deadlineAt
                      }
                      command={command}
                      now={now}
                    />
                  )}
                  {host &&
                    currentType === "HORSE_RACE" &&
                    round.submitted === round.participantIds.length && (
                      <button
                        className="p-button primary full"
                        disabled={disabled}
                        onClick={() => command("CLOSE_INPUT")}
                      >
                        ทุกคนเลือกแล้ว เริ่มแข่งเลย{" "}
                        <Icon name="arrow" size={19} />
                      </button>
                    )}
                </>
              )}
              {phase === "FORBIDDEN" && (
                <ForbiddenGame
                  state={state}
                  members={members}
                  userId={user.id}
                  host={host}
                  now={now}
                  disabled={disabled}
                  connected={connected}
                  command={command}
                />
              )}
              {phase === "RACING" && (
                <Race
                  round={round}
                  now={now}
                  profiles={state.profiles}
                  userId={user.id}
                  code={code}
                  onLeave={() => setConfirmLeave(true)}
                  onSkip={host ? () => setRoomAction({ type: 'SKIP', roundId: round.id, phase }) : undefined}
                  disabled={disabled}
                />
              )}
              {phase === "RESULTS" && (
                <>
                  <Results state={state} userId={user.id} />
                  <ReadyRollCall
                    model={model}
                    nextLabel={nextLabel}
                    hostId={room.hostId}
                    userId={user.id}
                  />
                  {host && !lastRound && (
                    <details className="next-game-settings">
                      <summary>เปลี่ยนเกมหรือคำถามตาถัดไป</summary>
                      <Settings
                        config={state.config}
                        forbiddenConfig={state.forbiddenConfig}
                        games={games}
                        command={command}
                        disabled={disabled}
                      />
                    </details>
                  )}
                </>
              )}
              {host && phase !== "PAUSED" && (
                <div className="host-controls">
                  {(between || phase === "FORBIDDEN") && (
                    <button
                      className="text-button"
                      disabled={disabled}
                      onClick={() => command("PAUSE")}
                    >
                      <Icon name="pause" size={16} />
                      พักวง
                    </button>
                  )}
                  {active && phase !== "FORBIDDEN" && (
                    <button
                      className="text-button"
                      disabled={disabled}
                      onClick={() =>
                        setRoomAction({
                          type: "SKIP",
                          roundId: round.id,
                          phase,
                        })
                      }
                    >
                      ข้ามรอบนี้ · ไม่คิดคะแนน
                    </button>
                  )}
                  <button
                    className="text-button"
                    disabled={disabled}
                    onClick={() =>
                      setRoomAction({ type: "END", roundId: round?.id, phase })
                    }
                  >
                    จบวงและดูสรุป
                  </button>
                </div>
              )}
            </main>
            <aside className="room-sidebar">
              <Players
                members={members}
                hostId={room.hostId}
                state={state}
                userId={user.id}
              />
              {!active && phase !== "PAUSED" && <Invite code={code} />}
              {active && (
                <div className="quiet-note">
                  <Icon name="spark" size={24} />
                  <p>
                    ไม่ต้องเปิดเสียง
                    <br />
                    ก็สนุกพร้อมกันได้
                  </p>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
      <footer className="room-footer">
        <span className={connected ? "connection-ok" : ""}>
          <span className="presence-dot online" />
          {connected ? "เชื่อมต่อแล้ว" : "กำลังเชื่อมต่อ"}
        </span>
        <span>เล่นในแบบที่ทุกคนสบายใจ · ข้ามได้เสมอ</span>
      </footer>
      {between && (
        <ReadyDock
          model={model}
          host={host}
          phase={phase}
          disabled={disabled}
          connected={connected}
          pendingCommand={pendingCommand}
          command={command}
          nextLabel={nextLabel}
        />
      )}
      {actionIsCurrent && (
        <RoomConfirmation
          title={roomAction.type === "SKIP" ? "ข้ามรอบนี้?" : "จบวงตอนนี้?"}
          description={
            roomAction.type === "SKIP"
              ? "รอบนี้จะไม่คิดคะแนน ทุกคนจะไปหน้าผลและเตรียมตาถัดไปได้"
              : forbiddenSession
                ? "เก็บคะแนนนักล่าและจำนวนโดนจับ แล้วพาทุกคนไปหน้าสรุป ไม่คิดโทษเพิ่ม"
                : active
                  ? "รอบที่กำลังเล่นจะไม่คิดคะแนน และทุกคนจะไปหน้าสรุปวงนี้"
                  : "ทุกคนจะไปหน้าสรุปคะแนนและโมเมนต์ของวงนี้"
          }
          actionLabel={
            roomAction.type === "SKIP" ? "ยืนยันข้ามรอบ" : "ยืนยันจบวง"
          }
          disabled={disabled}
          busy={pendingCommand === roomAction.type}
          onCancel={cancelRoomAction}
          onConfirm={async () => {
            const ok = await command(roomAction.type, {
              roundId: roomAction.roundId,
            });
            if (ok) setRoomAction(null);
          }}
        />
      )}
      {confirmLeave && (
        <RoomConfirmation
          title="ออกจากวงนี้?"
          description={
            host
              ? "เพื่อนที่อยู่ในวงจะเป็นเจ้าวงต่อ คุณกลับมาเข้ารหัสเดิมได้"
              : "เพื่อนจะเล่นต่อได้ คุณกลับมาเข้ารหัสเดิมได้"
          }
          actionLabel="ออกจากวง"
          disabled={false}
          onCancel={cancelLeave}
          onConfirm={leave}
        />
      )}
    </div>
  );
}
