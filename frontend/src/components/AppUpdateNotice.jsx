import Icon from './PartyIcon';

export default function AppUpdateNotice({ release, onLater, onUpdate }) {
  if (!release) return null;
  return <aside className="app-update-notice" role="status" aria-live="polite">
    <div>
      <strong>มีอัปเดตใหม่ · {release.version}</strong>
      {release.notes && <p>{release.notes}</p>}
      <small>ดาวน์โหลด APK แล้วติดตั้งทับตัวเดิม ข้อมูลเดิมยังอยู่</small>
    </div>
    <div className="app-update-actions">
      <button className="p-button outline" onClick={onLater}>ไว้ทีหลัง</button>
      <button className="p-button primary" onClick={onUpdate}><Icon name="download" size={18} /> อัปเดตเลย</button>
    </div>
  </aside>;
}
