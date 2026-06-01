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

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner lg" />
      </div>
    );
  }

  if (!user) {
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
    </>
  );
}
