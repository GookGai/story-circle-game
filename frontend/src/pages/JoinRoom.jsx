import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AvatarPicker from '../components/AvatarPicker';

export default function JoinRoom() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { joinAsGuest } = useAuth();

  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('cat');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nickname.trim()) {
      setError('กรุณากรอกชื่อเล่นของคุณ');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await joinAsGuest(nickname.trim(), avatar);
      navigate(`/room/${code}`, { replace: true });
    } catch (err) {
      setError(err.message || 'ไม่สามารถเข้าร่วมห้องได้');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container flex items-center justify-center min-h-screen">
      <div
        className="glass-card no-hover w-full animate-slide-up"
        style={{ maxWidth: 460, padding: '32px 24px' }}
      >
        <div className="text-center mb-lg">
          <div style={{ fontSize: '3.5rem', marginBottom: '8px' }}>🎉</div>
          <h1 className="page-title mb-xs">เข้าร่วมวงปาร์ตี้</h1>
          <p className="text-secondary-color">
            รหัสห้อง:{' '}
            <span
              style={{
                color: 'var(--neon-cyan)',
                fontWeight: 'bold',
                letterSpacing: '1px',
                fontSize: '1.2rem',
                textShadow: '0 0 10px rgba(0, 212, 255, 0.4)',
              }}
            >
              {code?.toUpperCase()}
            </span>
          </p>
        </div>

        {error && <div className="error-msg mb-md">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <div className="input-group">
            <label className="font-semibold">ชื่อเล่นของคุณ</label>
            <div className="input-icon-wrap">
              <span className="input-icon">👤</span>
              <input
                type="text"
                className="input-field"
                placeholder="กรอกชื่อเล่น (เช่น น้าเดช)"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={15}
                autoFocus
                disabled={loading}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="font-semibold mb-sm display-block">เลือกอวาตาร์ประจำตัว</label>
            <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
              <AvatarPicker selected={avatar} onSelect={setAvatar} />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-block mt-md"
            disabled={loading || !nickname.trim()}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-sm">
                <span className="spinner sm" /> กำลังเข้าห้อง...
              </span>
            ) : (
              '🎮 เข้าเล่นเกม'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
