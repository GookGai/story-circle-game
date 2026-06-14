import { useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const FLOATING_EMOJIS = ['🍺', '🎉', '🃏', '🎲', '🍻', '🥂', '🎯', '🎪'];

function FloatingParticles() {
  const particles = useMemo(() => {
    return FLOATING_EMOJIS.map((emoji, i) => ({
      emoji,
      style: {
        left: `${5 + Math.random() * 90}%`,
        top: `${5 + Math.random() * 90}%`,
        fontSize: `${1 + Math.random() * 1.5}rem`,
        opacity: 0.15 + Math.random() * 0.15,
        '--duration': `${6 + Math.random() * 8}s`,
        '--delay': `${Math.random() * 5}s`,
        animationDelay: `${Math.random() * 5}s`,
      },
    }));
  }, []);

  return (
    <>
      {particles.map((p, i) => (
        <span key={i} className="particle" style={p.style}>
          {p.emoji}
        </span>
      ))}
    </>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate('/lobby', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <FloatingParticles />

      <div
        className="glass-card no-hover text-center relative"
        style={{ zIndex: 1, maxWidth: 420, width: '90%', padding: '48px 32px' }}
      >
        {/* Logo */}
        <div
          className="animate-bounce-in"
          style={{ fontSize: '5rem', marginBottom: 8, lineHeight: 1 }}
        >
          🎲
        </div>

        {/* Title */}
        <h1
          className="animate-slide-up stagger-1"
          style={{
            fontSize: '2.5rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, var(--neon-pink), var(--neon-orange))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 8,
          }}
        >
          Story Circle
        </h1>

        {/* Tagline */}
        <p
          className="animate-slide-up stagger-2"
          style={{
            color: 'var(--text-secondary)',
            fontSize: '1.1rem',
            marginBottom: 40,
          }}
        >
          เกมปาร์ตี้สำหรับวงเหล้า
        </p>

        {/* Buttons */}
        <div className="flex flex-col gap-md animate-slide-up stagger-3">
          <Link to="/login" className="btn btn-primary btn-lg btn-block">
            เข้าสู่ระบบ
          </Link>
          <Link to="/register" className="btn btn-secondary btn-lg btn-block">
            สมัครสมาชิก
          </Link>
        </div>

        {/* Subtle version */}
        <p
          className="animate-slide-up stagger-4"
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
            marginTop: 32,
          }}
        >
          v1.0.3 • Made with 🍺
        </p>
      </div>
    </div>
  );
}
