import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { getAvatarEmoji } from '../utils/avatars';
import { api } from '../utils/api';

const GAMES = [
  { id: 'HORSE_RACE', name: 'แข่งม้า', emoji: '🏇', description: 'แทงม้าแล้วลุ้น!' },
  { id: 'MINORITY_VOTE', name: 'โหวตข้างน้อย', emoji: '🗳️', description: 'อย่าเป็นฝ่ายข้างน้อย!' },
];

export default function Lobby() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { connected } = useSocket();

  const [selectedGame, setSelectedGame] = useState(GAMES[0].id);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [roomCode, setRoomCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  async function handleCreateRoom() {
    setError('');
    setCreating(true);
    try {
      const data = await api.post('/api/rooms', {
        gameType: selectedGame,
        maxPlayers,
      });
      navigate(`/room/${data.room.code}`);
    } catch (err) {
      setError(err.message || 'สร้างห้องไม่สำเร็จ');
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinRoom(e) {
    e.preventDefault();
    if (!roomCode.trim()) {
      setError('กรุณากรอกรหัสห้อง');
      return;
    }

    setError('');
    setJoining(true);
    try {
      await api.post(`/api/rooms/${roomCode.trim().toUpperCase()}/join`);
      navigate(`/room/${roomCode.trim().toUpperCase()}`);
    } catch (err) {
      setError(err.message || 'เข้าร่วมห้องไม่สำเร็จ');
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="page-container">
      {/* Welcome Header */}
      <div className="flex items-center gap-md mb-xl animate-slide-up">
        <div className="avatar-circle lg glow-purple">
          {getAvatarEmoji(user?.avatar)}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold">สวัสดี, {user?.username}!</h2>
          <p className="text-sm text-secondary-color flex items-center gap-xs">
            <span
              className="online-dot"
              style={!connected ? { background: 'var(--text-muted)', boxShadow: 'none' } : {}}
            />
            {connected ? 'ออนไลน์' : 'กำลังเชื่อมต่อ...'}
          </p>
        </div>
        <button className="btn btn-ghost text-sm" onClick={logout}>
          ออก
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Create Room */}
      <div className="glass-card no-hover mb-lg animate-slide-up stagger-1">
        <h3 className="text-lg font-semibold mb-lg flex items-center gap-sm">
          🎮 สร้างห้อง
        </h3>

        {/* Game Selection */}
        <div className="input-group">
          <label>เลือกเกม</label>
          <div className="flex flex-col gap-sm">
            {GAMES.map((game) => (
              <button
                key={game.id}
                type="button"
                onClick={() => setSelectedGame(game.id)}
                className={`glass-card compact flex items-center gap-md cursor-pointer ${
                  selectedGame === game.id ? 'selected' : ''
                }`}
                style={{
                  borderColor:
                    selectedGame === game.id
                      ? 'var(--neon-cyan)'
                      : 'var(--glass-border)',
                  boxShadow:
                    selectedGame === game.id
                      ? '0 0 15px rgba(0,212,255,0.2)'
                      : 'none',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '2rem' }}>{game.emoji}</span>
                <div>
                  <div className="font-semibold">{game.name}</div>
                  <div className="text-xs text-muted-color">{game.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Max Players */}
        <div className="input-group mt-md">
          <label className="flex justify-between">
            <span>จำนวนผู้เล่นสูงสุด</span>
            <span className="text-cyan font-bold">{maxPlayers} คน</span>
          </label>
          <input
            type="range"
            className="range-slider"
            min={2}
            max={15}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
          />
          <div className="flex justify-between text-xs text-muted-color">
            <span>2</span>
            <span>15</span>
          </div>
        </div>

        <button
          className="btn btn-primary btn-block mt-lg"
          onClick={handleCreateRoom}
          disabled={creating}
        >
          {creating ? (
            <span className="flex items-center gap-sm">
              <span className="spinner sm" /> กำลังสร้าง...
            </span>
          ) : (
            '🎲 สร้างห้อง'
          )}
        </button>
      </div>

      {/* Join Room */}
      <div className="glass-card no-hover animate-slide-up stagger-2">
        <h3 className="text-lg font-semibold mb-lg flex items-center gap-sm">
          🚪 เข้าร่วมห้อง
        </h3>

        <form onSubmit={handleJoinRoom}>
          <div className="input-group">
            <label>รหัสห้อง</label>
            <input
              type="text"
              className="input-field text-center"
              placeholder="กรอกรหัส 6 หลัก"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
              maxLength={6}
              style={{
                fontFamily: 'var(--font-en)',
                fontSize: '1.5rem',
                fontWeight: 700,
                letterSpacing: '0.2em',
              }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-secondary btn-block"
            disabled={joining || roomCode.length < 4}
          >
            {joining ? (
              <span className="flex items-center gap-sm">
                <span className="spinner sm" /> กำลังเข้าร่วม...
              </span>
            ) : (
              '🎯 เข้าร่วมห้อง'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
