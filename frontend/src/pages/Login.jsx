import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await login(username.trim(), password);
      navigate('/lobby', { replace: true });
    } catch (err) {
      setError(err.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container flex items-center justify-center min-h-screen">
      <div
        className="glass-card no-hover w-full animate-slide-up"
        style={{ maxWidth: 400, padding: '40px 32px' }}
      >
        <h1 className="page-title mb-xl">เข้าสู่ระบบ 🎲</h1>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>ชื่อผู้ใช้</label>
            <div className="input-icon-wrap">
              <span className="input-icon">👤</span>
              <input
                type="text"
                className="input-field"
                placeholder="กรอกชื่อผู้ใช้"
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
                placeholder="กรอกรหัสผ่าน"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-block mt-lg"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-sm">
                <span className="spinner sm" /> กำลังเข้าสู่ระบบ...
              </span>
            ) : (
              'เข้าสู่ระบบ'
            )}
          </button>
        </form>

        <div className="divider" />

        <p className="text-center text-secondary-color text-sm">
          ยังไม่มีบัญชี?{' '}
          <Link to="/register" style={{ fontWeight: 600 }}>
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </div>
  );
}
