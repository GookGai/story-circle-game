import { useEffect, useState } from 'react';
import { getAvatarEmoji } from '../utils/avatars';

function Confetti() {
  return (
    <div className="confetti-container">
      {Array.from({ length: 20 }, (_, i) => (
        <div key={i} className="confetti-piece" />
      ))}
    </div>
  );
}

export default function GameResult({
  emoji = '🏆',
  title,
  losers = [],
  onDismiss,
}) {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  function handleDismiss() {
    setVisible(false);
    onDismiss?.();
  }

  if (!visible) return null;

  return (
    <>
      <Confetti />

      <div className="drink-overlay" onClick={handleDismiss}>
        <div className="game-result-card" onClick={(e) => e.stopPropagation()}>
          {/* Winner emoji */}
          <div className="game-result-emoji">{emoji}</div>

          {/* Title */}
          <h2 className="game-result-title text-gradient">{title}</h2>

          {/* Losers who must drink */}
          {losers.length > 0 && (
            <div className="game-result-drinkers">
              <div className="drink-emoji">🍺</div>
              <p className="drink-text">ดื่ม!</p>

              <div className="mt-lg">
                {losers.map((loser, i) => (
                  <div
                    key={loser.id || i}
                    className="drinker-item"
                    style={{ animationDelay: `${0.8 + i * 0.15}s` }}
                  >
                    <span>{getAvatarEmoji(loser.avatar)}</span>
                    <span className="font-semibold">{loser.username}</span>
                    <span>🍺</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dismiss hint */}
          <p className="drink-subtext mt-xl text-muted-color text-sm">
            แตะเพื่อปิด
          </p>
        </div>
      </div>
    </>
  );
}
