import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api } from "../utils/api";
import { AVATARS, getAvatarEmoji } from "../utils/avatars";
import Icon from "../components/PartyIcon";
import { isNativeApp } from "../utils/platform";
import { ANDROID_RELEASE } from "../utils/androidRelease";
import { fetchAndroidRelease } from "../utils/appUpdate.mjs";
import WebAppInstall from "../components/WebAppInstall";

const games = [
  {
    icon: "vote",
    n: "01",
    title: "เลือกข้าง แล้วมาเถียงกัน",
    name: "โหวตข้างน้อย",
    copy: "คำถามกวน ๆ ที่ทำให้รู้จักเพื่อนอีกมุม · 2 คนเล่นใจตรงกัน",
    tag: "2–10 คน",
    color: "sage",
  },
  {
    icon: "horse",
    n: "02",
    title: "ตัวโปรดใคร จะเข้าเส้นชัย",
    name: "แข่งม้า",
    copy: "เลือกม้า เชียร์ให้สุด แล้วลุ้นให้ติดท็อป 3 ไปพร้อมกัน",
    tag: "2–10 คน",
    color: "peach",
  },
  {
    icon: "jump",
    n: "03",
    title: "ใจเย็นได้ แต่อย่าช้าไป",
    name: "ร่มชูชีพวัดใจ",
    copy: "ตกพร้อมกัน ดูเพื่อนกางร่ม แล้วแย่งที่รอดใน 12 วินาที",
    tag: "3–10 คน",
    color: "lavender",
  },
  {
    icon: "secret",
    n: "04",
    title: "ใครเผลอพูด คนนั้นโดน",
    name: "คำต้องห้ามประจำตัว",
    copy: "เห็นคำเพื่อน ซ่อนคำตัวเอง · Custom หมวด จับแล้วรับคำใหม่เล่นต่อ",
    tag: "2–10 คน",
    color: "sage",
  },
];

export default function PartyHome() {
  const [androidRelease, setAndroidRelease] = useState(ANDROID_RELEASE);
  useEffect(() => {
    if (isNativeApp) return;
    let disposed = false;
    fetchAndroidRelease().then((release) => { if (release && !disposed) setAndroidRelease(release); }).catch(() => {});
    return () => { disposed = true; };
  }, []);
  const { code: inviteCode } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, joinAsGuest, logout } = useAuth();
  const [mode, setMode] = useState(
    inviteCode
      ? "join"
      : new URLSearchParams(location.search).has("create")
        ? "create"
        : null,
  );
  const [code, setCode] = useState(inviteCode?.toUpperCase() || "");
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState("cat");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [rooms, setRooms] = useState([]);
  const dialog = useRef(null);

  useEffect(() => {
    if (!user) {
      setRooms([]);
      return;
    }
    api
      .get("/api/rooms/my/rooms")
      .then((data) =>
        setRooms(data.rooms.filter((r) => r.status !== "FINISHED").sort((a, b) => Number(b.code === localStorage.getItem('party-last-room')) - Number(a.code === localStorage.getItem('party-last-room'))).slice(0, 3)),
      )
      .catch(() => {});
  }, [user]);
  useEffect(() => {
    if (!mode) return;
    const previous = document.activeElement;
    dialog.current?.querySelector("input,button")?.focus();
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) {
        setMode(null);
        if (inviteCode) navigate("/", { replace: true });
      }
      if (event.key !== "Tab") return;
      const elements = [
        ...dialog.current.querySelectorAll(
          "button:not(:disabled),input,a[href]",
        ),
      ];
      const first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [mode, busy, inviteCode, navigate]);
  useEffect(() => {
    if (mode !== "join" || code.length !== 6) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    api
      .get(`/api/rooms/${code}/preview`)
      .then((data) => {
        if (!cancelled) {
          setPreview(data);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPreview(null);
          setError(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code, mode]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "join") {
        const room = await api.get(`/api/rooms/${code}/preview`);
        if (!user && room.status === "FINISHED")
          throw new Error("วงนี้จบแล้ว ให้เพื่อนเปิดวงใหม่ก่อน");
        if (!user && room.count >= room.maxPlayers)
          throw new Error("วงนี้เต็มแล้ว ให้เพื่อนเพิ่มที่ว่างก่อน");
      }
      if (!user) await joinAsGuest(nickname.trim(), avatar);
      if (mode === "create") {
        const data = await api.post("/api/rooms", {
          gameType: "MIXED",
          maxPlayers: 10,
          settings: { totalRounds: 6 },
        });
        navigate(`/room/${data.room.code}`);
      } else {
        await api.post(`/api/rooms/${code}/join`, {});
        navigate(`/room/${code}`, { replace: true });
      }
    } catch (err) {
      setError(err.message || "เข้าวงไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }
  function open(next) {
    setMode(next);
    setError("");
  }
  function close() {
    setMode(null);
    if (inviteCode) navigate("/", { replace: true });
  }

  return (
    <div className="party-home">
      <header className="home-nav">
        <Link to="/" className="wordmark" aria-label="Story Circle หน้าแรก">
          <span className="brand-symbol">
            <Icon name="dice" size={22} />
          </span>{" "}
          story circle.
        </Link>
        <div className="nav-actions">
          {user?.isAdmin && <Link className="text-button" to="/admin">Dashboard</Link>}
          {user ? (
            <button
              className="text-button account-action"
              onClick={() => {
                logout();
                setRooms([]);
              }}
            >
              <span className="account-name">สวัสดี, {user.username.replace(/#\d+$/, "")}</span>{" "}
              <span className="dim">· ออก</span>
            </button>
          ) : (
            <Link className="text-button" to="/login">
              มีบัญชีแล้ว <Icon name="arrow" size={16} />
            </Link>
          )}
        </div>
      </header>

      <main>
        <section className="night-hero">
          <div className="hero-photograph" aria-hidden="true" />
          <div className="hero-shade" />
          <div className="hero-content">
            <span className="eyebrow hero-enter">
              <span className="live-dot" /> GOOD FRIENDS. GREAT GAMES.
            </span>
            <h1 className="hero-enter">
              รวมเพื่อน
              <br />
              แล้ว<span className="hand-underline">เปิดวง.</span>
            </h1>
            <p className="hero-copy hero-enter">
              เกมสนุก ๆ สำหรับวงเพื่อนของคุณ
              <br />
              คนละมือถือ เล่นและหัวเราะไปด้วยกัน
            </p>
            <div className="hero-actions hero-enter">
              {isNativeApp && rooms[0] && <Link className="p-button primary app-return" to={`/room/${rooms[0].code}`}>เล่นวงเดิมต่อ · {rooms[0].code} <Icon name="arrow" size={20} /></Link>}
              <button
                className={`p-button ${isNativeApp && rooms[0] ? 'translucent' : 'primary'}`}
                onClick={() => open("create")}
                disabled={authLoading}
              >
                สร้างวงใหม่ <Icon name="arrow" size={20} />
              </button>
              <button
                className="p-button translucent"
                onClick={() => open("join")}
              >
                มีรหัสเข้าวงแล้ว
              </button>
            </div>
            <div className="hero-facts hero-enter">
              <span>
                <Icon name="users" size={17} /> เพื่อน 2–10 คน
              </span>
              <i />
              <span>ไม่ต้องสมัคร</span>
              <i />
              <span>เปิดบนมือถือได้เลย</span>
            </div>
          </div>
          <div className="hero-stamp" aria-hidden="true">
            <Icon name="spark" size={26} />
            <span>
              PLAY TOGETHER
              <br />
              LAUGH TOGETHER
            </span>
          </div>
          <a className="hero-scroll" href={isNativeApp ? "#games" : "#install-app"}>
            {isNativeApp ? "มีอะไรให้เล่นบ้าง" : "ติดตั้งเว็บแอป"} <span>↓</span>
          </a>
          <span className="hero-caption">
            YOUR FRIENDS. YOUR CIRCLE.
          </span>
        </section>

        {!isNativeApp && <WebAppInstall androidRelease={androidRelease} />}

        {rooms.length > 0 && (
          <section className="return-rooms">
            <span className="eyebrow">วงที่คุณเปิดไว้</span>
            <div>
              {rooms.map((room) => (
                <Link key={room.id} to={`/room/${room.code}`}>
                  กลับเข้าวง <b>{room.code}</b>
                  <Icon name="arrow" size={18} />
                </Link>
              ))}
            </div>
          </section>
        )}

        <section id="games" className="games-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">A LITTLE GAME. A LOT OF LAUGHS.</span>
              <h2>
                คนครบแล้ว
                <br />
                <span className="dim">ความสนุกก็เริ่มได้</span>
              </h2>
            </div>
            <p>
              สี่เกม หลายจังหวะ
              <br />
              สแกน เลือก เล่น แล้วเงยหน้ามาแซวกัน
            </p>
          </div>
          <div className="game-editorial-list">
            {games.map((game) => (
              <article key={game.n} className={`game-editorial ${game.color}`}>
                <div className="game-editorial-art">
                  <span className="game-number">{game.n}</span>
                  <Icon name={game.icon} size={100} />
                  <span className="game-art-label">{game.name}</span>
                </div>
                <div className="game-editorial-copy">
                  <span className="game-tag">{game.tag}</span>
                  <h3>{game.title}</h3>
                  <p>{game.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="how-section">
          <span className="eyebrow">จาก “เล่นอะไรดี” ถึง “เอาอีกตา”</span>
          <div className="how-steps">
            {[
              ["01", "ตั้งชื่อ เปิดวง", "ไม่ต้องจำรหัสผ่าน"],
              ["02", "ส่ง QR ให้เพื่อน", "คนละมือถือ โต๊ะเดียวกัน"],
              ["03", "เลือกเกม แล้วลุย", "จะเล่นจริงจังหรือขำ ๆ ก็ได้"],
            ].map(([n, title, copy]) => (
              <div key={n}>
                <span>{n}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="final-invite">
          <Icon name="spark" size={42} />
          <h2>
            เพื่อนพร้อม
            <br />
            วงก็พร้อม.
          </h2>
          <button className="p-button primary" onClick={() => open("create")}>
            เปิดวงเล่นกับเพื่อน <Icon name="arrow" size={20} />
          </button>
          <p>เลือกพัก ข้าม หรือเล่นต่อได้ตามจังหวะของวง</p>
        </section>
      </main>
      <footer className="home-footer">
        <span className="wordmark">story circle.</span>
        <span>เล่นให้สนุก ในแบบที่ทุกคนสบายใจ</span>
        <span>MADE FOR YOUR CIRCLE · 2026</span>
      </footer>

      {mode && (
        <div
          className="party-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget && !busy) close();
          }}
        >
          <section
            className="party-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="entry-title"
            ref={dialog}
          >
            <button
              className="icon-button modal-close"
              aria-label="ปิด"
              onClick={close}
              disabled={busy}
            >
              <Icon name="close" />
            </button>
            <span className="eyebrow">YOUR CIRCLE STARTS HERE</span>
            <h2 id="entry-title">
              {mode === "create" ? "เริ่มวงของคุณ" : "เพื่อนรออยู่แล้ว"}
            </h2>
            <p className="dim">
              {mode === "create"
                ? "ตั้งชื่อเล่น แล้วส่ง QR ให้เพื่อนเข้ามา"
                : "ใส่รหัส 6 ตัว แล้วเข้าวงได้เลย"}
            </p>
            <form onSubmit={submit} className="entry-form">
              {mode === "join" && (
                <label>
                  รหัสวง
                  <input
                    className="p-input code-input"
                    value={code}
                    onChange={(event) =>
                      setCode(
                        event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, "")
                          .slice(0, 6),
                      )
                    }
                    placeholder="ABC123"
                    maxLength={6}
                    required
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck="false"
                    aria-describedby="room-preview"
                  />
                  <span id="room-preview" className="field-note">
                    {preview
                      ? `${preview.count}/${preview.maxPlayers} คนในวง${preview.status === "PLAYING" ? " · เข้ารอบถัดไปได้" : preview.status === "FINISHED" ? " · วงจบแล้ว" : " · กำลังรวมตัว"}`
                      : "ขอรหัสจากเพื่อน หรือสแกน QR ของวง"}
                  </span>
                </label>
              )}
              {user ? (
                <div className="existing-identity">
                  <span className="avatar-bubble">
                    {getAvatarEmoji(user.avatar)}
                  </span>
                  <div>
                    <span className="dim">เข้าวงในชื่อ</span>
                    <strong>{user.username.replace(/#\d+$/, "")}</strong>
                  </div>
                  <Icon name="check" size={20} />
                </div>
              ) : (
                <>
                  <label>
                    ให้เพื่อนเรียกคุณว่าอะไร
                    <input
                      className="p-input"
                      value={nickname}
                      onChange={(event) => setNickname(event.target.value)}
                      maxLength={15}
                      required
                      placeholder="ชื่อเล่นของคุณ"
                      autoComplete="nickname"
                    />
                  </label>
                  <fieldset className="avatar-field">
                    <legend>เลือกตัวแทนคุณ</legend>
                    <div>
                      {AVATARS.slice(0, 8).map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          aria-label={item.name}
                          aria-pressed={avatar === item.id}
                          className={`avatar-pick ${avatar === item.id ? "selected" : ""}`}
                          onClick={() => setAvatar(item.id)}
                        >
                          {item.emoji}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </>
              )}
              {error && (
                <p className="p-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="p-button primary full"
                disabled={
                  busy || authLoading || (mode === "join" && code.length !== 6)
                }
              >
                {busy
                  ? "กำลังเข้าวง…"
                  : mode === "create"
                    ? "เปิดวงเลย"
                    : "เข้าวงเลย"}
                <Icon name="arrow" size={20} />
              </button>
              <span className="entry-footnote">
                ใช้ชื่อเล่นได้เลย ไม่ต้องสมัครสมาชิก
              </span>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
