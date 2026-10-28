import { useEffect } from 'react';
import Icon from './PartyIcon';
import { getAvatarEmoji } from '../utils/avatars';
import { parachuteView } from '../utils/parachuteView.mjs';
import { RACE_VIEWPORT_QUERY } from '../utils/raceView.mjs';

const colors = ['#eea475','#80b6d5','#9cba8b','#b2a0d2','#d5b76d','#85bdb5','#d79aaa','#a7b7d3','#c3b282','#a4bd73'];
function Canopy() {
  return <svg className="jump-canopy" viewBox="0 0 52 44" aria-hidden="true"><path d="M3 20a23 18 0 0 1 46 0Z" fill="var(--jumper-color)" stroke="#26364a" strokeWidth="1.5"/><path d="M26 2c-8 4-10 10-10 18M26 2c8 4 10 10 10 18M4 20l22 21 22-21M16 20l10 21 10-21" fill="none" stroke="#26364a" strokeWidth="1.3"/></svg>;
}
function Sky({ round, profiles, userId, model }) {
  const compact = model.players.length > 6;
  return <div className={`jump-sky ${compact ? 'compact' : ''} phase-${model.phase.toLowerCase()}`} aria-label="ท้องฟ้าและผู้เล่นทุกคน">
    <div className="jump-cloud cloud-one" aria-hidden="true"/><div className="jump-cloud cloud-two" aria-hidden="true"/><div className="jump-cloud cloud-three" aria-hidden="true"/>
    <svg className="jump-plane" viewBox="0 0 90 40" aria-hidden="true"><path d="M7 22h28L47 4h10l-7 18h25q13 0 13 5H50l-10 11H30l5-11H10L2 14h8Z" fill="#34445a"/><path d="M60 23h14" stroke="#f5f4ef" strokeWidth="3"/></svg>
    <div className="jump-sky-caption">
      {model.phase === 'PREPARING' ? <><strong>เตรียมตกพร้อมกัน!</strong><span>คนแรกหลุด · มีที่รอด {round.quota} ที่</span></>
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
        {result && <small>{result.missed ? 'พักตานี้' : result.safe ? 'รอด' : 'หลุด'}</small>}
      </div>;
    })}</div>
    <div className="jump-ground" aria-hidden="true"><span>จุดลงจอด</span><i/><i/><i/></div>
    <div className="jump-height-meter" aria-label={`ระยะตก ${Math.round(model.progress * 100)} เปอร์เซ็นต์`}><span style={{height:`${(1-model.progress)*100}%`}}/></div>
  </div>;
}

export default function ParachuteGame({ round, now, profiles, userId, connected, pending, disabled, observer, command, onLeave, onSkip, code, error }) {
  const model = parachuteView(round, now);
  const opened = !!round.myAction;
  const canOpen = model.phase === 'FALLING' && !opened && !disabled && !observer && connected;
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
      <header className="parachute-header"><div><small>ร่มชูชีพวัดใจ · {code}</small><strong>รอดลำดับ 2–{round.quota+1}</strong></div><span className="parachute-clock"><small>{stageLabel}</small><b>{model.seconds}</b></span>{onSkip && <button className="race-skip" onClick={onSkip} disabled={disabled}>ข้าม</button>}<button className="icon-button" aria-label="ออกจากวง" onClick={onLeave}><Icon name="exit" size={20}/></button></header>
      <Sky round={round} profiles={profiles} userId={userId} model={model}/>
      <div className="jump-live-roster" tabIndex={0} aria-label="สถานะการกางร่มของเพื่อน เลื่อนเพื่อดูชื่อทั้งหมด">{model.players.map((p)=><span key={p.id} className={`${p.opened ? 'opened' : ''} ${p.id === userId ? 'is-me' : ''}`}>{getAvatarEmoji(profiles[p.id]?.avatar)} {p.id === userId ? 'คุณ' : profiles[p.id]?.username || 'เพื่อน'} {p.opened ? '✓' : '↓'}</span>)}</div>
      <footer className="parachute-controls">
        <p role="status">{error || (!connected ? 'กำลังเชื่อมต่อกลับ · รอการยืนยันจากวง' : observer ? 'คุณเป็นกองเชียร์รอบนี้ ดูเพื่อนลุ้นไปด้วยกัน' : opened ? 'กางร่มแล้ว! ดูเพื่อนต่อ แล้วลุ้นผลตอนลงจอด' : 'คนแรกหลุด · ที่รอดสุดท้ายได้ 2 ดาว · กดได้ครั้งเดียว')}</p>
        <button className={`parachute-open ${opened ? 'is-opened' : ''}`} onClick={()=>command('JUMP')} disabled={!canOpen}>
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
  return <section className="parachute-results">
    <span className="eyebrow">ลงจอดครบแล้ว · ROUND {state.roundNumber}</span><h2>ใครรอด ใครใจร้อนไป?</h2>
    <Sky round={round} profiles={profiles} userId={userId} model={model}/>
    {me && <div className={`jump-personal-outcome ${me.safe ? 'safe' : me.missed ? 'missed' : ''}`} role="status"><div><small>ผลของคุณ</small><strong>{me.missed ? 'ไม่ได้กางร่ม · ไม่คิดผล' : me.safe ? 'ลงจอดปลอดภัย!' : 'รับบทลงโทษ'}</strong><p>{me.reason}</p></div><b>+{me.points} ดาว</b></div>}
    <p className="jump-results-rule">รอดลำดับ 2–{round.quota+1} · ที่รอดสุดท้ายได้ 2 ดาว</p>
    <div className="jump-result-list">{[...round.result.players].sort((a,b)=>(a.order || 99)-(b.order || 99)).map((p)=><div key={p.userId} className={p.safe ? 'safe' : ''}><span>{getAvatarEmoji(profiles[p.userId]?.avatar)}</span><div><strong>{profiles[p.userId]?.username || 'เพื่อนในวง'} {p.userId===userId ? '(คุณ)' : ''}</strong><small>{p.order ? `กางร่มลำดับ ${p.order} · ` : ''}{p.reason}</small></div><b>+{p.points}★</b></div>)}</div>
  </section>;
}
