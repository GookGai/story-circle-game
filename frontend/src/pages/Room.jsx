import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket, useSocketEvent } from '../hooks/useSocket';
import { api } from '../utils/api';
import { getAvatarEmoji } from '../utils/avatars';
import PlayerList from '../components/PlayerList';

const GAME_LABELS = {
  'HORSE_RACE': { name: 'แข่งม้า', emoji: '🏇', minPlayers: 2 },
  'MINORITY_VOTE': { name: 'โหวตข้างน้อย', emoji: '🗳️', minPlayers: 3 },
};

export default function Room() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // Fetch room data
  useEffect(() => {
    async function fetchRoom() {
      try {
        const data = await api.get(`/api/rooms/${code}`);
        setRoom(data.room);
        setPlayers(data.room.players || []);
      } catch (err) {
        setError(err.message || 'ไม่พบห้อง');
      } finally {
        setLoading(false);
      }
    }
    fetchRoom();
  }, [code]);

  // Socket: join room channel
  useEffect(() => {
    if (!socket || !code) return;
    socket.emit('room:join', code, (res) => {
      if (res && res.room) {
        setRoom((prev) => ({ ...prev, ...res.room }));
        // Sync players list immediately after joining
        socket.emit('room:players', code, (playersRes) => {
          if (playersRes && playersRes.players) {
            setPlayers(playersRes.players);
          }
        });
      }
    });
  }, [socket, code]);

  // Socket events
  useSocketEvent(
    'room:playerList',
    useCallback((playerList) => {
      setPlayers(playerList);
    }, [])
  );

  useSocketEvent(
    'room:playerJoined',
    useCallback((data) => {
      setPlayers((prev) => {
        if (prev.find((p) => p.user.id === data.userId)) return prev;
        return [...prev, { id: 'temp', userId: data.userId, user: { id: data.userId, username: data.username, avatar: 'cat' } }];
      });
      if (socket) socket.emit('room:players', code, (res) => {
        if (res.players) setPlayers(res.players);
      });
    }, [socket, code])
  );

  useSocketEvent(
    'room:playerLeft',
    useCallback((data) => {
      setPlayers((prev) => prev.filter((p) => p.userId !== data.userId));
    }, [])
  );

  useSocketEvent(
    'room:gameChanged',
    useCallback((data) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return { ...prev, gameType: data.gameType };
      });
    }, [])
  );

  useSocketEvent(
    'room:gameStarted',
    useCallback(
      (data) => {
        const gameType = data.gameType;
        if (gameType === 'HORSE_RACE') {
          navigate(`/game/horse/${code}`);
        } else if (gameType === 'MINORITY_VOTE') {
          navigate(`/game/vote/${code}`);
        }
      },
      [code, navigate]
    )
  );

  const isHost = room?.hostId === user?.id;
  const gameInfo = GAME_LABELS[room?.gameType] || { name: 'เกม', emoji: '🎮', minPlayers: 2 };
  const canStart = players.length >= gameInfo.minPlayers;

  function handleCopyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleStartGame() {
    if (!socket) return;
    socket.emit('room:start', code);
  }

  function handleLeave() {
    if (socket) socket.emit('room:leave', code);
    navigate('/lobby');
  }

  function handleGameChange(e) {
    const nextGame = e.target.value;
    if (socket && room && nextGame) {
      socket.emit('room:changeGame', { roomId: room.id, gameType: nextGame });
    }
  }

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-screen">
        <div className="spinner lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-screen gap-lg">
        <div className="text-3xl">😵</div>
        <p className="text-secondary-color">{error}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/lobby')}>
          กลับหน้าหลัก
        </button>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Room Code */}
      <div className="text-center mb-xl animate-slide-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <p className="text-sm text-muted-color mb-xs">รหัสห้อง</p>
        <div className="room-code" onClick={handleCopyCode} title="คัดลอกรหัสห้อง">
          {code}
        </div>
        <p className="text-xs text-muted-color mt-sm">
          {copied ? '✅ คัดลอกแล้ว!' : 'แตะเพื่อคัดลอก'}
        </p>
        <button
          className="btn btn-secondary mt-sm"
          style={{ padding: '6px 16px', fontSize: '0.8rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={() => setShowQRModal(true)}
        >
          📷 แสดง QR Code
        </button>
      </div>

      {/* Game Badge / Swapping Dropdown */}
      <div className="text-center mb-lg animate-slide-up stagger-1">
        {isHost ? (
          <div className="input-group text-center" style={{ maxWidth: '280px', margin: '0 auto' }}>
            <label className="font-semibold mb-xsDisplay" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              🎮 เลือกเกมที่จะเล่น
            </label>
            <select
              className="input-field"
              value={room?.gameType}
              onChange={handleGameChange}
              style={{
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.03)',
                color: 'white',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                textAlign: 'center',
                cursor: 'pointer',
              }}
            >
              <option value="HORSE_RACE">🏇 แข่งม้า</option>
              <option value="MINORITY_VOTE">🗳️ โหวตข้างน้อย</option>
            </select>
          </div>
        ) : (
          <span className="badge secondary" style={{ fontSize: '0.875rem', padding: '4px 16px' }}>
            {gameInfo.emoji} {gameInfo.name}
          </span>
        )}
      </div>

      {/* Players */}
      <div className="glass-card no-hover mb-lg animate-slide-up stagger-2">
        <div className="flex justify-between items-center mb-md">
          <h3 className="font-semibold">
            👥 ผู้เล่น ({players.length}/{room?.maxPlayers || '?'})
          </h3>
          {!canStart && (
            <span className="text-xs text-muted-color">
              ต้องการอย่างน้อย {gameInfo.minPlayers} คน
            </span>
          )}
        </div>

        <PlayerList
          players={players}
          hostId={room?.hostId}
          currentUserId={user?.id}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-md animate-slide-up stagger-3">
        {isHost && (
          <button
            className="btn btn-success btn-lg btn-block"
            onClick={handleStartGame}
            disabled={!canStart}
          >
            🎮 เริ่มเกม
          </button>
        )}

        {!isHost && (
          <div className="text-center text-secondary-color">
            <div className="spinner sm mx-auto mb-sm" />
            รอเจ้าของห้องเริ่มเกม...
          </div>
        )}

        <button className="btn btn-danger btn-block" onClick={handleLeave}>
          🚪 ออกจากห้อง
        </button>
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="drink-overlay" onClick={() => setShowQRModal(false)} style={{ cursor: 'pointer' }}>
          <div
            className="glass-card no-hover text-center animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 340, width: '90%', padding: '32px 24px', cursor: 'default' }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '8px' }}>📷</div>
            <h3 className="text-lg font-bold mb-md" style={{ color: 'var(--neon-cyan)' }}>สแกนเข้าร่วมวง</h3>
            <div
              style={{
                background: 'white',
                padding: '12px',
                borderRadius: '16px',
                display: 'inline-block',
                boxShadow: '0 0 25px rgba(0, 212, 255, 0.2)',
                marginBottom: '16px',
              }}
            >
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  window.location.origin + '/join/' + code
                )}`}
                alt="Room QR Code"
                style={{ width: '200px', height: '200px', display: 'block' }}
              />
            </div>
            <p className="text-xs text-secondary-color mb-lg" style={{ lineHeight: '1.4' }}>
              ให้เพื่อนสแกน QR Code นี้เพื่อเข้าเล่นเกมโดยไม่ต้องล็อกอิน แค่ตั้งชื่อเล่นก็เข้าห้องได้ทันที!
            </p>
            <button className="btn btn-danger btn-block" onClick={() => setShowQRModal(false)}>
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
