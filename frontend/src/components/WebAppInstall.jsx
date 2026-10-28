import { useState, useSyncExternalStore } from 'react';
import { pwaStore } from '../utils/pwaStore';
import { installGuide } from '../utils/pwaInstall.mjs';
import Icon from './PartyIcon';

export default function WebAppInstall({ androidRelease }) {
  const { installed, busy } = useSyncExternalStore(pwaStore.subscribe, pwaStore.getSnapshot);
  const [showGuide, setShowGuide] = useState(false);
  const [feedback, setFeedback] = useState('');
  const guide = installGuide(navigator);
  async function install() {
    const result = await pwaStore.install();
    if (result === 'instructions') setShowGuide(true);
    setFeedback(result === 'dismissed' ? 'ไว้ติดตั้งภายหลังได้ เล่นผ่านเว็บต่อได้เลย' : result === 'accepted' ? 'เบราว์เซอร์กำลังติดตั้ง Story Circle' : '');
  }
  return <section className="web-app-install" id="install-app" aria-labelledby="install-title">
    <div className="web-app-install-main">
      <div><h2 id="install-title">เปิดวงจากไอคอนบนเครื่อง</h2><p>ติดตั้งครั้งเดียว เปิดแยกเหมือนแอป เล่นออนไลน์กับเพื่อนได้เลย</p><small>อัปเดตตามเว็บเมื่อเปิดหน้าใหม่หรือรีเฟรช ไม่ต้องโหลด APK</small></div>
      {installed ? <span className="web-app-installed" role="status"><Icon name="check" size={20} /> ติดตั้งเว็บแอปแล้ว</span> : <button className="p-button primary" onClick={install} disabled={busy}><Icon name="install" size={21} />{busy ? 'กำลังเปิดหน้าติดตั้ง…' : 'ติดตั้งเว็บแอป'}</button>}
    </div>
    {!installed && <>
      <p className="web-app-install-feedback" role="status">{feedback}</p>
      <details className="web-app-guide" open={showGuide} onToggle={(event) => setShowGuide(event.currentTarget.open)}>
        <summary>วิธีติดตั้งบนเครื่องนี้</summary>
        <div><h3>{guide.title}</h3><ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol><p>เบราว์เซอร์จะให้คุณยืนยันก่อนเพิ่มไอคอนบนเครื่อง</p></div>
      </details>
    </>}
    <details className="legacy-apk" id="android-app">
      <summary>ใช้ APK Android แบบเดิม</summary>
      <p>สำหรับคนที่ต้องการไฟล์ติดตั้งเดิม · ติดตั้งทับแอปเดิมได้</p>
      <a className="text-button" href={androidRelease.url}><Icon name="download" size={17} />ดาวน์โหลด APK {androidRelease.version} · {androidRelease.size}</a>
    </details>
  </section>;
}
