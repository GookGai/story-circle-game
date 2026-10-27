import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import Icon from '../components/PartyIcon';
import '../admin.css';

const games = {
  MIXED: ['เล่นผสม', 'spark'], MINORITY_VOTE: ['โหวตข้างน้อย', 'vote'],
  HORSE_RACE: ['แข่งม้า', 'horse'], PANIC_JUMP: ['ร่มชูชีพวัดใจ', 'jump'],
  FORBIDDEN_WORD: ['คำต้องห้าม', 'secret'],
};
const labels = {
  ACCOUNT_CREATED: 'เริ่มใช้บัญชี', LOGIN: 'เข้าสู่ระบบ', CONNECTED: 'เชื่อมต่อเกม',
  DISCONNECTED: 'ตัดการเชื่อมต่อ', ROOM_CREATED: 'สร้างวง', ROOM_JOINED: 'เข้าวง',
  ROOM_LEFT: 'ออกจากวง', GAME_STARTED: 'เริ่มรอบ', GAME_ENDED: 'จบเกม',
  GAME_PAUSED: 'พักเกม', GAME_RESUMED: 'เล่นต่อ', ERROR: 'รายการไม่สำเร็จ',
};
const number = value => new Intl.NumberFormat('th-TH').format(value);
const time = value => new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(value));

function Dashboard() {
  const { user } = useAuth();
  const [days, setDays] = useState(7);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [onlyErrors, setOnlyErrors] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setData(null);
    api.get(`/api/admin/dashboard?days=${days}`).then(value => { if (active) setData(value); })
      .catch(err => { if (active) setError(err.status === 403 ? 'บัญชีนี้ไม่มีสิทธิ์ดู dashboard' : err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [days, reload]);
  const rows = useMemo(() => (data?.events || []).filter(event => {
    const text = [event.username, event.roomCode, labels[event.type], games[event.gameType]?.[0], event.source, event.errorCode].join(' ').toLowerCase();
    return (!onlyErrors || event.type === 'ERROR') && text.includes(search.trim().toLowerCase());
  }), [data, search, onlyErrors]);
  const totals = data?.totals;
  return <div className="admin-app">
    <aside className="admin-nav">
      <Link className="admin-brand" to="/"><span><Icon name="dice" size={22} /></span>story circle.</Link>
      <span className="admin-nav-label">หลังบ้าน</span>
      <a className="admin-nav-current" href="#overview"><Icon name="spark" size={18} />ภาพรวมการใช้งาน</a>
      <a href="#activity"><Icon name="users" size={18} />กิจกรรมล่าสุด</a>
      <div className="admin-nav-foot"><small>ผู้ดูแล</small><strong>{user.username}</strong><Link to="/">← กลับไปหน้าเกม</Link></div>
    </aside>
    <main className="admin-main" id="overview" aria-busy={loading}>
      <header className="admin-heading"><div><span className="admin-kicker">STORY CIRCLE / ADMIN</span><h1>การใช้งาน</h1><p>{data ? `อัปเดต ${time(data.generatedAt)} · เวลาไทย` : 'ภาพรวมเกมและกิจกรรมล่าสุด'}</p></div>
        <div className="admin-controls"><div className="admin-range" aria-label="ช่วงข้อมูล">{[[1, '24 ชั่วโมง'], [7, '7 วัน'], [30, '30 วัน']].map(([value, label]) => <button key={value} aria-pressed={days === value} onClick={() => setDays(value)}>{label}</button>)}</div><button className="admin-refresh" disabled={loading} onClick={() => setReload(value => value + 1)}>{loading ? 'กำลังโหลด…' : 'โหลดใหม่ ↻'}</button></div>
      </header>
      {error && <div className="admin-error" role="alert">{error} <button onClick={() => setReload(value => value + 1)}>ลองใหม่</button></div>}
      <section className="admin-totals" aria-label="สถิติภาพรวม">{[
        ['ผู้เล่นที่ใช้งาน', totals?.users, 'นับตามบัญชี'], ['เชื่อมต่ออยู่', totals?.online, 'ขณะโหลดข้อมูล'],
        ['วงที่สร้าง', totals?.rooms, 'ในช่วงที่เลือก'], ['รอบที่เริ่ม', totals?.rounds, 'ทุกเกมรวมกัน'],
        ['รายการไม่สำเร็จ', totals?.errors, 'คำสั่ง / ระบบ'],
      ].map(([label, value, note]) => <div key={label}><span>{label}</span><strong>{value === undefined ? '—' : number(value)}</strong><small>{note}</small></div>)}</section>
      <section className="admin-games"><div><span className="admin-kicker">GAME ACTIVITY</span><h2>เกมที่เล่น</h2><p>จำนวนรอบที่เริ่มในช่วงนี้</p></div><div className="admin-game-bars">{data?.games.length ? data.games.map(game => <div className="admin-game-row" key={game.gameType}><Icon name={games[game.gameType]?.[1] || 'spark'} size={20} /><span>{games[game.gameType]?.[0] || game.gameType}</span><div className="admin-bar"><i style={{ width: `${game.count / data.games[0].count * 100}%` }} /></div><b>{number(game.count)}</b></div>) : <p className="admin-empty-small">{loading ? 'กำลังโหลด…' : 'ยังไม่มีการเริ่มเกมในช่วงนี้'}</p>}</div></section>
      <section className="admin-activity" id="activity"><div className="admin-table-heading"><div><h2>กิจกรรมล่าสุด</h2><p>100 รายการล่าสุด · บันทึกอาจช้าประมาณ 5 วินาที</p></div><div className="admin-table-tools"><input aria-label="ค้นหาในรายการล่าสุด" placeholder="ค้นหาชื่อ รหัสวง หรือกิจกรรม" value={search} onChange={event => setSearch(event.target.value)} /><label><input type="checkbox" checked={onlyErrors} onChange={event => setOnlyErrors(event.target.checked)} />ไม่สำเร็จเท่านั้น</label></div></div>
        <div className="admin-table-scroll"><table><thead><tr><th>เวลา</th><th>ผู้เล่น</th><th>กิจกรรม</th><th>วง / เกม</th><th>ช่องทาง</th></tr></thead><tbody>{rows.map(event => <tr key={event.id}><td className="admin-time">{time(event.createdAt)}</td><td><strong>{event.username || 'ไม่ระบุ'}</strong>{event.isGuest && <small>Guest</small>}</td><td><span className={event.type === 'ERROR' ? 'admin-failed' : ''}>{labels[event.type] || event.type}</span>{event.errorCode && <small>{event.errorCode}</small>}</td><td>{event.roomCode ? <code>{event.roomCode}</code> : '—'}{event.gameType && <small>{games[event.gameType]?.[0] || event.gameType}</small>}</td><td><span className={`admin-source ${event.source === 'ANDROID' ? 'android' : ''}`}>{event.source === 'ANDROID' ? 'Android' : 'เว็บ'}</span></td></tr>)}</tbody></table>{!rows.length && <div className="admin-empty">{loading ? 'กำลังโหลดกิจกรรม…' : search || onlyErrors ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีกิจกรรมในช่วงนี้'}</div>}</div>
      </section>
      <footer className="admin-note">เก็บย้อนหลัง 30 วัน เริ่มบันทึกหลังติดตั้ง dashboard · Guest คนละเครื่องนับเป็นคนละบัญชี{data?.logging?.dropped > 0 && <strong> · มี log ตกหล่น {number(data.logging.dropped)} รายการ</strong>}{data?.logging?.queued > 0 && <span> · รอบันทึก {number(data.logging.queued)} รายการ</span>}</footer>
    </main>
  </div>;
}

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  if (loading) return <div className="party-loading"><span className="spinner" role="status" aria-label="กำลังตรวจสิทธิ์" /></div>;
  if (!user?.isAdmin) return <div className="admin-access"><span className="admin-kicker">STORY CIRCLE / ADMIN</span><h1>สำหรับผู้ดูแล</h1><p>เข้าสู่ระบบด้วยบัญชีผู้ดูแลเพื่อดูการใช้งาน</p><Link className="p-button primary" to="/login?next=admin">เข้าสู่ระบบผู้ดูแล</Link><Link to="/">กลับไปหน้าเกม</Link></div>;
  return <Dashboard />;
}
