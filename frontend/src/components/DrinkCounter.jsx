import { useState, useEffect, useRef } from 'react';

export default function DrinkCounter({ count = 0 }) {
  const [bumped, setBumped] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > prevCount.current) {
      setBumped(true);
      const timer = setTimeout(() => setBumped(false), 500);
      prevCount.current = count;
      return () => clearTimeout(timer);
    }
    prevCount.current = count;
  }, [count]);

  return (
    <div className="drink-counter">
      <span>🍺</span>
      <span className={`drink-number ${bumped ? 'bumped' : ''}`}>
        {count}
      </span>
    </div>
  );
}
