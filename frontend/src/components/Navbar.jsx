import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getAvatarEmoji } from '../utils/avatars';

const NAV_ITEMS = [
  { path: '/lobby', icon: '🏠', label: 'หน้าหลัก' },
  { path: '/stats', icon: '📊', label: 'สถิติ' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Don't render on landing
  if (location.pathname === '/') return null;

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `bottom-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <span className="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}

      {/* Profile / Logout */}
      <button
        className={`bottom-nav-item ${
          location.pathname === '/profile' ? 'active' : ''
        }`}
        onClick={logout}
        style={{ background: 'none', border: 'none' }}
      >
        <span className="nav-icon">
          {user ? getAvatarEmoji(user.avatar) : '👤'}
        </span>
        <span>ออก</span>
      </button>
    </nav>
  );
}
