import { lazy, Suspense } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import PartyHome from "./pages/PartyHome";
import Login from "./pages/Login";
import Register from "./pages/Register";

const PartyRoom = lazy(() => import("./pages/PartyRoom"));
function RoomRoute() {
  const { user, loading } = useAuth();
  const { code } = useParams();
  if (loading)
    return (
      <div className="party-loading">
        <span className="spinner" role="status" aria-label="กำลังโหลด" />
      </div>
    );
  return user ? <PartyRoom /> : <Navigate to={`/join/${code}`} replace />;
}
function LobbyRedirect() {
  return <Navigate to="/?create=1" replace />;
}

export default function App() {
  const { pathname } = useLocation();
  return (
    <>
      <Suspense
        fallback={
          <div className="party-loading">
            <span className="spinner" role="status" aria-label="กำลังโหลดเกม" />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<PartyHome />} />
          <Route path="/join/:code" element={<PartyHome />} />
          <Route path="/room/:code" element={<RoomRoute />} />
          <Route path="/game/:game/:code" element={<RoomRoute />} />
          <Route path="/lobby" element={<LobbyRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {["/login", "/register"].includes(pathname) && (
        <Link className="account-back" to="/">
          ← กลับไปตั้งวง
        </Link>
      )}
    </>
  );
}
