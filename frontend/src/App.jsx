import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
import HorseRace from './pages/HorseRace';
import MinorityVote from './pages/MinorityVote';
import Stats from './pages/Stats';
import JoinRoom from './pages/JoinRoom';
import pkg from '../package.json';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner lg" />
      </div>
    );
  }

  if (!user) {
    const pathParts = location.pathname.split('/');
    const isRoomOrGame = pathParts[1] === 'room' || pathParts[1] === 'game';
    const code = pathParts[1] === 'room' ? pathParts[2] : pathParts[3];

    if (isRoomOrGame && code) {
      return <Navigate to={`/join/${code}`} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/join/:code" element={<JoinRoom />} />
        <Route
          path="/lobby"
          element={
            <ProtectedRoute>
              <Lobby />
            </ProtectedRoute>
          }
        />
        <Route
          path="/room/:code"
          element={
            <ProtectedRoute>
              <Room />
            </ProtectedRoute>
          }
        />
        <Route
          path="/game/horse/:code"
          element={
            <ProtectedRoute>
              <HorseRace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/game/vote/:code"
          element={
            <ProtectedRoute>
              <MinorityVote />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stats/:roomId?"
          element={
            <ProtectedRoute>
              <Stats />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {!isLanding && <Navbar />}

      <div style={{ position: 'fixed', bottom: 4, right: 8, fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', pointerEvents: 'none', zIndex: 9999 }}>
        v{pkg.version}
      </div>
    </>
  );
}
