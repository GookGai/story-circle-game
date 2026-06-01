export default function VoteOption({
  label,
  text,
  selected,
  onClick,
  result,
  revealed,
}) {
  const isA = label === 'A';
  const optionClass = isA ? 'option-a' : 'option-b';

  return (
    <div
      className={`vote-card ${optionClass} ${selected ? 'selected' : ''} ${
        revealed ? 'vote-reveal' : ''
      }`}
      onClick={!revealed ? onClick : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && !revealed && onClick?.()}
    >
      <div className="vote-letter">{label}</div>
      <div className="text-lg font-semibold">{text}</div>

      {revealed && result && (
        <div className="mt-md animate-slide-up" style={{ animationDuration: '0.3s' }}>
          <div className="vote-bar">
            <div
              className={`vote-bar-fill ${isA ? 'a' : 'b'}`}
              style={{ width: `${result.percent || 0}%` }}
            >
              {result.count} โหวต ({result.percent}%)
            </div>
          </div>
          {result.isMinority && (
            <p className="text-sm text-pink mt-sm animate-shake">
              ⚠️ ฝ่ายข้างน้อย!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
