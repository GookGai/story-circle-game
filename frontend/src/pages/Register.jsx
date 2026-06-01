import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AvatarPicker from '../components/AvatarPicker';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatar, setAvatar] = useState('cat');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!username.trim() || !password || !confirmPassword) {
      setError('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    if (username.trim().length < 2) {
      setError('ชื่อผู้ใช้ต้องมีอย่างน้อย 2 ตัวอักษร');
      return;
    }

    if (password.length < 4) {
      setError('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
      return;
    }

    if (password !== confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await register(username.trim(), password, avatar);
      navigate('/lobby', { replace: true });
    } catch (err) {
      setError(err.message || 'สมัครสมาชิกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container flex flex-col justify-center min-h-screen">
      <div
        className="glass-card no-hover w-full animate-slide-up mx-auto"
        style={{ maxWidth: 440, padding: '32px 24px' }}
      >
        <h1 className="page-title mb-lg">สมัครสมาชิก 🎉</h1>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>ชื่อผู้ใช้</label>
            <div className="input-icon-wrap">
              <span className="input-icon">👤</span>
              <input
                type="text"
                className="input-field"
                placeholder="ตั้งชื่อของคุณ"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          <div className="input-group">
            <label>รหัสผ่าน</label>
            <div className="input-icon-wrap">
              <span className="input-icon">🔒</span>
              <input
                type="password"
                className="input-field"
                placeholder="ตั้งรหัสผ่าน"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="input-group">
            <label>ยืนยันรหัสผ่าน</label>
            <div className="input-icon-wrap">
              <span className="input-icon">🔑</span>
              <input
                type="password"
                className="input-field"
                placeholder="กรอกรหัสผ่านอีกครั้ง"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="input-group">
            <label>เลือกอวาตาร์</label>
            <AvatarPicker selected={avatar} onSelect={setAvatar} />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-block mt-md"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-sm">
                <span className="spinner sm" /> กำลังสมัคร...
              </span>
            ) : (
              'สมัครสมาชิก'
            )}
          </button>
        </form>

        <div className="divider" />

        <p className="text-center text-secondary-color text-sm">
          มีบัญชีอยู่แล้ว?{' '}
          <Link to="/login" style={{ fontWeight: 600 }}>
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
}
