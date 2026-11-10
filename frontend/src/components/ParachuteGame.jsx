import { useEffect, useRef } from 'react';
import Icon from './PartyIcon';
import { getAvatarEmoji } from '../utils/avatars';
import { parachuteView, timingLabel } from '../utils/parachuteView.mjs';
import { RACE_VIEWPORT_QUERY } from '../utils/raceView.mjs';

const colors = ['#eea475','#80b6d5','#9cba8b','#b2a0d2','#d5b76d','#85bdb5','#d79aaa','#a7b7d3','#c3b282','#a4bd73'];
function Canopy() {
  return <svg className="jump-canopy" viewBox="0 0 52 44" aria-hidden="true"><path d="M3 20a23 18 0 0 1 46 0Z" fill="var(--jumper-color)" stroke="#26364a" strokeWidth="1.5"/><path d="M26 2c-8 4-10 10-10 18M26 2c8 4 10 10 10 18M4 20l22 21 22-21M16 20l10 21 10-21" fill="none" stroke="#26364a" strokeWidth="1.3"/></svg>;
}
function Sky({ round, profiles, userId, model }) {
  const compact = model.players.length > 6;
  const timing = round.jumpFlow === 3;
  return <div className={`jump-sky ${compact ? 'compact' : ''} ${timing ? 'timing-sky' : ''} phase-${model.phase.toLowerCase()} ${model.targetPulse ? 'target-pulse' : ''}`} aria-label="ท้องฟ้าและผู้เล่นทุกคน">
    <div className="jump-cloud cloud-one" aria-hidden="true"/><div className="jump-cloud cloud-two" aria-hidden="true"/><div className="jump-cloud cloud-three" aria-hidden="true"/>
    <svg className="jump-plane" viewBox="0 0 90 40" aria-hidden="true"><path d="M7 22h28L47 4h10l-7 18h25q13 0 13 5H50l-10 11H30l5-11H10L2 14h8Z" fill="#34445a"/><path d="M60 23h14" stroke="#f5f4ef" strokeWidth="3"/></svg>
    <div className="jump-sky-caption">
      {timing && ['PREPARING','FALLING'].includes(model.phase) ? <div className="jump-timing-cue">
        <span className="jump-cue-label">{model.phase === 'PREPARING' ? `จำเป้าเลข ${round.targetNumber} ไว้` : 'กางตอนวงแหวนตรงกัน'}</span>
        <div className={`jump-countdown ${model.phase === 'PREPARING' ? 'preparing' : ''}`} role="timer" aria-label={model.phase === 'PREPARING' ? `เริ่มใน ${model.seconds} วินาที` : `เลขนับถอยหลัง ${model.countdown.toFixed(1)} เป้า ${round.targetNumber}`}>
          <i className="jump-target-ring"/><i className="jump-moving-ring" style={{transform:`scale(${model.ringScale})`}}/>
          <b>{model.phase === 'PREPARING' ? model.seconds : model.countdown.toFixed(1)}</b>
        </div>
        <span className="jump-cue-note">{model.phase === 'PREPARING' ? 'กดให้ตรงเป้า · กดได้ครั้งเดียว' : 'เร็วไปหรือช้าไป ก็นับว่าห่างจากเป้า'}</span>
      </div> : model.phase === 'PREPARING' ? <><strong>เตรียมตกพร้อมกัน!</strong><span>คนแรกหลุด · มีที่รอด {round.quota} ที่</span></>
        : model.phase === 'LANDING' || model.phase === 'WATCHING' ? <><strong>ลุ้นลงจอดไปด้วยกัน</strong><span>อีกนิดเดียว จะเฉลยพร้อมกันทั้งวง</span></>
          : model.phase === 'RESULTS' ? <strong>ลงจอดแล้ว!</strong>
            : model.phase === 'WAITING_RESULT' ? <strong>กำลังรับผลจากวง…</strong>
              : <><strong>{model.openedCount ? 'มีคนกางแล้ว! จะตามหรือรอ?' : 'ใครจะกล้ากางก่อน?'}</strong><span>กางแล้ว {model.openedCount}/{model.players.length} คน</span></>}
    </div>
    <div className="jump-actors">{model.players.map((player, index) => {
      const me = player.id === userId;
      const person = profiles[player.id];
      const result = round.result?.players.find((p) => p.userId === player.id);
      return <div key={player.id} className={`jump-person ${player.opened ? 'opened' : 'freefall'} ${player.landed ? 'landed' : ''} ${me ? 'is-me' : ''} ${result?.safe ? 'is-safe' : ''}`} style={{left:`${player.x}%`,top:`${player.y}%`,'--jumper-color':colors[index % colors.length]}} aria-label={`${person?.username || 'เพื่อนในวง'}${me ? ' คุณ' : ''} ${player.opened ? 'กางร่มแล้ว' : 'ยังไม่กางร่ม'}`}>
        <Canopy/><span className="jump-person-avatar">{getAvatarEmoji(person?.avatar)}</span>
        <strong className="jump-person-name" title={person?.username}>{me ? 'คุณ' : person?.username || 'เพื่อน'}</strong>
        {result && <small>{result.safe ? 'รอด' : timing ? 'พลาด' : result.missed ? 'พักตานี้' : 'หลุด'}</small>}
      </div>;
    })}</div>
    <div className="jump-ground" aria-hidden="true"><span>จุดลงจอด</span><i/><i/><i/></div>
    <div className="jump-height-meter" aria-label={`เวลาเลือกจังหวะผ่านไป ${Math.round(model.progress * 100)} เปอร์เซ็นต์`}><span style={{height:`${(1-model.progress)*100}%`}}/></div>
  </div>;
}

export default function ParachuteGame({ round, now, serverOffset = 0, profiles, userId, connected, pending, disabled, observer, command, onLeave, onSkip, code, error }) {
  const model = parachuteView(round, now);
  const timing = round.jumpFlow === 3;
  const sending = useRef(false);
  const opened = !!round.myAction;
  const canOpen = model.phase === 'FALLING' && !opened && !disabled && !observer && connected;
  const open = async () => {
    if (!canOpen || sending.current) return;
    sending.current = true;
    try { await command('JUMP', timing ? { pressedAt: Date.now() + serverOffset } : {}); }
    finally { sending.current = false; }
  };
  useEffect(() => {
    const media = window.matchMedia(RACE_VIEWPORT_QUERY);
    const previous = document.body.style.overflow;
    const resize = () => { document.body.style.overflow = media.matches ? 'hidden' : previous; };
    resize();media.addEventListener('change',resize);
    return () => { media.removeEventListener('change',resize);document.body.style.overflow = previous; };
  },[]);
  const stageLabel = model.phase === 'PREPARING' ? 'เริ่มใน' : model.phase === 'WATCHING' ? 'ลงจอดใน' : ['LANDING','WAITING_RESULT'].includes(model.phase) ? 'ลงจอด' : 'เหลือ';
  return <section className="parachute-game" aria-label="ร่มชูชีพวัดใจสด">
    <div className="parachute-canvas">
      <header className="parachute-header"><div><small>ร่มชูชีพวัดใจ · {code}</small><strong>{timing ? <>กางที่เลข <em>{round.targetNumber}</em></> : round.quota === 1 ? 'คนที่ 2 รอด' : `รอดลำดับ 2–${round.quota+1}`}</strong>{timing && <span className="jump-penalty-rule">ห่างสุด <b>{round.penaltyCount} คน</b>รับบทลงโทษ</span>}</div>{(!timing || !['PREPARING','FALLING'].includes(model.phase)) && <span className="parachute-clock"><small>{stageLabel}</small><b>{model.seconds}</b></span>}{onSkip && <button className="race-skip" onClick={onSkip} disabled={disabled}>ข้าม</button>}<button className="icon-button" aria-label="ออกจากวง" onClick={onLeave}><Icon name="exit" size={20}/></button></header>
      <Sky round={round} profiles={profiles} userId={userId} model={model}/>
      <div className="jump-live-roster" tabIndex={0} aria-label="สถานะการกางร่มของเพื่อน เลื่อนเพื่อดูชื่อทั้งหมด">{model.players.map((p)=><span key={p.id} className={`${p.opened ? 'opened' : ''} ${p.id === userId ? 'is-me' : ''}`}>{getAvatarEmoji(profiles[p.id]?.avatar)} {p.id === userId ? 'คุณ' : profiles[p.id]?.username || 'เพื่อน'} {p.opened ? '✓' : '↓'}</span>)}</div>
      <footer className="parachute-controls">
        <p role="status">{error || (!connected ? 'กำลังเชื่อมต่อกลับ · รอการยืนยันจากวง' : observer ? 'คุณเป็นกองเชียร์รอบนี้ ดูเพื่อนลุ้นไปด้วยกัน' : opened ? 'กางร่มแล้ว! ลุ้นความแม่นพร้อมกันตอนลงจอด' : ['LANDING','WATCHING','WAITING_RESULT'].includes(model.phase) ? 'ปิดรับการกางร่มแล้ว ลุ้นลงจอดพร้อมกัน' : timing ? 'กดครั้งเดียว · ไม่กดรับบทลงโทษ · เสมอเส้นตัดรอด' : 'คนแรกหลุด · ที่รอดสุดท้ายได้ 2 ดาว · กดได้ครั้งเดียว')}</p>
        <button className={`parachute-open ${opened ? 'is-opened' : ''}`} onPointerDown={(e)=>{if(e.button===0){e.preventDefault();open();}}} onClick={(e)=>{if(e.detail===0)open();}} disabled={!canOpen}>
          <Icon name={opened ? 'check' : 'jump'} size={25}/>
          <strong>{!connected ? 'รอเชื่อมต่อ…' : pending ? 'กำลังยืนยัน…' : observer ? 'เชียร์เพื่อนอยู่' : model.phase === 'PREPARING' ? `เริ่มใน ${model.seconds}…` : opened ? 'กางร่มแล้ว · ลุ้นต่อ!' : model.phase === 'FALLING' ? 'กางร่ม!' : 'กำลังลงจอด…'}</strong>
        </button>
      </footer>
    </div>
  </section>;
}

export function ParachuteResults({ state, userId }) {
  const { round, profiles } = state;
  const me = round.result.players.find((p)=>p.userId===userId);
  const model = parachuteView(round, round.revealAt || round.finishedAt);
  const timing = round.jumpFlow === 3;
  const players = timing ? round.result.players : [...round.result.players].sort((a,b)=>(a.order || 99)-(b.order || 99));
  return <section className="parachute-results">
    <span className="eyebrow">ลงจอดครบแล้ว · ROUND {state.roundNumber}</span><h2>{timing ? 'ใครกางตรงเป้าที่สุด?' : 'ใครรอด ใครใจร้อนไป?'}</h2>
    <Sky round={round} profiles={profiles} userId={userId} model={model}/>
    {me && <div className={`jump-personal-outcome ${me.safe ? 'safe' : !timing && me.missed ? 'missed' : ''}`} role="status"><div><small>ผลของคุณ{timing ? ` · ${timingLabel(me)}` : ''}</small><strong>{me.safe ? 'ลงจอดปลอดภัย!' : timing || !me.missed ? 'รับบทลงโทษ' : 'ไม่ได้กางร่ม · ไม่คิดผล'}</strong><p>{me.reason}</p></div><b>+{me.points} ดาว</b></div>}
    <p className="jump-results-rule">{timing ? <>เป้าเลข {round.targetNumber} · สุ่มห่างสุด {round.penaltyCount} คน · รับบทลงโทษ {round.result.penaltyIds.length} คน<br/>เสมอในช่วง 0.1 วิที่เส้นตัดรอด · ไม่กดถือว่าพลาดเสมอ</> : <>{round.quota === 1 ? 'คนที่ 2 รอด' : `รอดลำดับ 2–${round.quota+1}`} · ที่รอดสุดท้ายได้ 2 ดาว</>}</p>
    <div className={`jump-result-list ${timing ? 'timing-results' : ''}`}>{players.map((p,index)=><div key={p.userId} className={p.safe ? 'safe' : ''} style={{'--reveal-delay':`${index*.14}s`}}><span>{getAvatarEmoji(profiles[p.userId]?.avatar)}</span><div><strong>{profiles[p.userId]?.username || 'เพื่อนในวง'} {p.userId===userId ? '(คุณ)' : ''}</strong><small>{timing ? <><b>{p.rank ? `#${p.rank} · ` : ''}{timingLabel(p)}</b><br/></> : p.order ? `กางร่มลำดับ ${p.order} · ` : ''}{p.reason}</small></div><b>+{p.points}★</b></div>)}</div>
  </section>;
}
