import { getAvatarEmoji } from '../utils/avatars';

export default function PlayerList({ players = [], hostId, currentUserId }) {
  if (players.length === 0) {
    return (
      <p className="text-center text-muted-color p-md">
        ยังไม่มีผู้เล่น...
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {players.map((player, i) => {
        const userId = player.user?.id || player.userId || player.id;
        const username = player.user?.username || player.username || 'ผู้เล่น';
        const avatar = player.user?.avatar || player.avatar || 'cat';
        const isHost = userId === hostId;
        const isMe = userId === currentUserId;

        return (
          <div
            key={userId}
            className="player-item"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div className={`avatar-circle ${isHost ? 'glow-pink' : ''}`}>
              {getAvatarEmoji(avatar)}
            </div>

            <div className="player-info">
              <div className="player-name">
                {username}
                {isHost && <span title="เจ้าของห้อง">👑</span>}
                {isMe && (
                  <span className="text-xs text-cyan"> (คุณ)</span>
                )}
              </div>
              <div className="player-meta flex items-center gap-xs">
                <span
                  className={`online-dot ${player.online === false ? 'offline' : ''}`}
                />
                {player.online === false ? 'ออฟไลน์' : 'ออนไลน์'}
              </div>
            </div>

            <div className="flex items-center gap-sm">
              {player.score !== undefined && player.score > 0 && (
                <div className="player-drinks" style={{ color: 'var(--neon-cyan)', borderColor: 'var(--neon-cyan)', boxShadow: '0 0 10px rgba(0,212,255,0.2)' }}>
                  ⭐ {player.score}
                </div>
              )}

              {player.drinkCount !== undefined && player.drinkCount > 0 && (
                <div className="player-drinks">
                  🍺 {player.drinkCount}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
