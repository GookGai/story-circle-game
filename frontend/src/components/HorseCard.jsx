export default function HorseCard({
  index,
  emoji,
  name,
  stats,
  selected,
  betCount = 0,
  onClick,
}) {
  return (
    <div
      className={`horse-card ${selected ? 'selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className="flex items-center gap-md">
        <div className="horse-card-emoji">{emoji}</div>

        <div className="flex-1">
          <div className="horse-card-name text-left">{name}</div>

          <div className="stat-bar">
            <span className="stat-label">ความเร็ว</span>
            <div className="stat-track">
              <div
                className="stat-fill speed"
                style={{ width: `${stats.speed}%` }}
              />
            </div>
          </div>

          <div className="stat-bar">
            <span className="stat-label">พละกำลัง</span>
            <div className="stat-track">
              <div
                className="stat-fill stamina"
                style={{ width: `${stats.stamina}%` }}
              />
            </div>
          </div>

          <div className="stat-bar">
            <span className="stat-label">โชค</span>
            <div className="stat-track">
              <div
                className="stat-fill luck"
                style={{ width: `${stats.luck}%` }}
              />
            </div>
          </div>
        </div>

        {betCount > 0 && (
          <div className="horse-card-bets">
            <span className="badge">{betCount} แทง</span>
          </div>
        )}
      </div>

      {selected && (
        <div
          className="text-center text-xs text-cyan mt-sm animate-slide-up"
          style={{ animationDuration: '0.2s' }}
        >
          ✅ เลือกม้าตัวนี้แล้ว
        </div>
      )}
    </div>
  );
}
