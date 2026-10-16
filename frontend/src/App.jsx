import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAuth } from './hooks/useAuth';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
const HorseRace = lazy(() => import('./pages/HorseRace'));
const MinorityVote = lazy(() => import('./pages/MinorityVote'));
const PanicJump = lazy(() => import('./pages/PanicJump'));
const Stats = lazy(() => import('./pages/Stats'));
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
      <Suspense fallback={<div className="spinner lg" role="status" aria-label="กำลังโหลด" />}>
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
          path="/game/jump/:code"
          element={
            <ProtectedRoute>
              <PanicJump />
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
      </Suspense>

      {!isLanding && <Navbar />}

      <div style={{ position: 'fixed', bottom: 4, right: 8, fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', pointerEvents: 'none', zIndex: 9999 }}>
        v{pkg.version}
      </div>
    </>
  );
}
