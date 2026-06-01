import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import { getAvatarEmoji } from '../utils/avatars';

export default function Stats() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchStats() {
      try {
        const endpoint = roomId
          ? `/api/stats/room/${roomId}`
          : '/api/stats';
        const data = await api.get(endpoint);
        const sorted = (data.players || []).sort(
          (a, b) => (b.drinkCount || 0) - (a.drinkCount || 0)
        );
        setPlayers(sorted);
      } catch (err) {
        setError(err.message || 'โหลดสถิติไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [roomId]);

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

  const maxDrinks = Math.max(1, ...players.map((p) => p.drinkCount || 0));
  const top3 = players.slice(0, 3);

  return (
    <div className="page-container">
      <h1 className="page-title animate-slide-up">สถิติวงเหล้า 🍺</h1>

      {/* Podium */}
      {top3.length >= 1 && (
        <div className="podium animate-slide-up stagger-1">
          {/* 2nd place */}
          {top3[1] && (
            <div className="podium-item">
              <div className="avatar-circle lg">
                {getAvatarEmoji(top3[1].avatar)}
              </div>
              <span className="text-sm font-semibold truncate" style={{ maxWidth: 80 }}>
                {top3[1].username}
              </span>
              <div className="podium-stand second">
                {top3[1].drinkCount || 0}
              </div>
            </div>
          )}

          {/* 1st place */}
          {top3[0] && (
            <div className="podium-item">
              <div className="text-2xl animate-bounce-in">👑</div>
              <div className="avatar-circle xl glow-pink">
                {getAvatarEmoji(top3[0].avatar)}
              </div>
              <span className="text-sm font-bold truncate" style={{ maxWidth: 80 }}>
                {top3[0].username}
              </span>
              <div className="podium-stand first">
                {top3[0].drinkCount || 0}
              </div>
            </div>
          )}

          {/* 3rd place */}
          {top3[2] && (
            <div className="podium-item">
              <div className="avatar-circle lg">
                {getAvatarEmoji(top3[2].avatar)}
              </div>
              <span className="text-sm font-semibold truncate" style={{ maxWidth: 80 }}>
                {top3[2].username}
              </span>
              <div className="podium-stand third">
                {top3[2].drinkCount || 0}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard */}
      <div className="glass-card no-hover animate-slide-up stagger-2">
        <h3 className="font-semibold mb-md">🏆 อันดับทั้งหมด</h3>

        {players.length === 0 ? (
          <p className="text-center text-muted-color p-lg">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="flex flex-col">
            {players.map((player, i) => {
              const isMe = player.id === user?.id;
              const pct = maxDrinks > 0 ? ((player.drinkCount || 0) / maxDrinks) * 100 : 0;

              return (
                <div
                  key={player.id}
                  className={`leaderboard-row ${isMe ? 'highlight' : ''}`}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <span className="leaderboard-rank">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </span>
                  <div className="avatar-circle sm">
                    {getAvatarEmoji(player.avatar)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate flex items-center gap-xs">
                      {player.username}
                      {isMe && <span className="text-xs text-cyan">(คุณ)</span>}
                    </div>
                    <div className="leaderboard-bar mt-xs">
                      <div
                        className="leaderboard-bar-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="leaderboard-drinks">
                    🍺 {player.drinkCount || 0}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Back button */}
      {roomId && (
        <button
          className="btn btn-secondary btn-block mt-xl animate-slide-up stagger-3"
          onClick={() => navigate(`/room/${roomId}`)}
        >
          ← กลับห้อง
        </button>
      )}
    </div>
  );
}
