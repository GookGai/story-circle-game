import { useMemo } from 'react';

export default function Timer({ seconds, total = 30, size = 80 }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = total > 0 ? seconds / total : 0;
  const dashOffset = circumference * (1 - progress);

  const status = useMemo(() => {
    if (seconds <= 5) return 'danger';
    if (seconds <= 10) return 'warning';
    return '';
  }, [seconds]);

  const strokeColor = useMemo(() => {
    if (seconds <= 5) return 'var(--neon-red)';
    if (seconds <= 10) return 'var(--neon-yellow)';
    return 'var(--neon-green)';
  }, [seconds]);

  return (
    <div className={`timer-circle ${status}`}>
      <svg width={size} height={size}>
        <circle
          className="timer-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="timer-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={strokeColor}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <span className="timer-text">{seconds}</span>
    </div>
  );
}
