const HORSE_ABILITIES = {
  "พญาลม": {
    ability: "เจ้าแห่งลมพายุ",
    desc: "เมื่อสปีดพุ่งตัว (Burst) จะเร็วแรงกว่าม้าตัวอื่น +6%",
    emoji: "🌪️"
  },
  "เจ้าฟ้า": {
    ability: "สมาธิบริสุทธิ์",
    desc: "มุ่งมั่นแน่วแน่ ภูมิคุ้มกันสูง ไม่มีทางวิ่งสะดุดล้ม (Stumble) ตลอดการแข่ง",
    emoji: "✨"
  },
  "หมูตัน": {
    ability: "อึดและทนทาน",
    desc: "ฟื้นตัวจากการสะดุดล้มรวดเร็วมาก (ติดสถานะสะดุดเพียง 1 Tick)",
    emoji: "🛡️"
  },
  "จอมซิ่ง": {
    ability: "ไนโตรทางตรง",
    desc: "ช่วงทางตรง 350 เมตรสุดท้าย (ระยะ > 2150m) สปีดวิ่งจะเพิ่มขึ้น +10% อย่างถาวร",
    emoji: "🚀"
  },
  "มังกรดำ": {
    ability: "โชคชะตาลึกลับ",
    desc: "มีโอกาสเกิดสุ่มสถานะดี/ร้ายบ่อยขึ้น +50% สุ่มพุ่งตัวได้บ่อย",
    emoji: "🔮"
  },
  "สิงห์สนามซ้อม": {
    ability: "เครื่องร้อนไว",
    desc: "สตาร์ทตัวแรงมาก! ช่วง 15 Ticks แรกจะวิ่งเร็วขึ้น +12%",
    emoji: "🦁"
  },
  "เต่าบินเกียร์ห้า": {
    ability: "แรงฮึดไล่แซง",
    desc: "หากอยู่ลำดับสุดท้ายขณะใดๆ จะได้รับความเร็วแซงเพิ่มขึ้น +10%",
    emoji: "🐢"
  },
  "สายฟ้าหน้ามึน": {
    ability: "เดาทางยาก",
    desc: "การก้าววิ่งสุ่มความก้าวหน้าสูงมาก คาดเดายาก ลุ้นพุ่งแซงหน้าดื้อๆ",
    emoji: "⚡"
  }
};

const renderStars = (stars, type) => {
  const isFive = stars === 5;
  const isOne = stars === 1;
  
  let starColor = 'var(--text-primary)';
  let glow = 'none';
  let label = '';
  
  if (isFive) {
    starColor = '#ffd700'; // Gold
    glow = '0 0 10px rgba(255, 215, 0, 0.8)';
    label = '👑';
  } else if (isOne) {
    starColor = '#ff4d4d'; // Red
    glow = '0 0 6px rgba(255, 77, 77, 0.5)';
    label = '💩';
  } else {
    if (type === 'notknow') {
      starColor = 'var(--neon-yellow)';
      glow = '0 0 4px rgba(255, 225, 77, 0.4)';
    } else if (type === 'guess') {
      starColor = 'var(--neon-pink)';
      glow = '0 0 4px rgba(255, 45, 120, 0.4)';
    } else {
      starColor = 'var(--neon-cyan)';
      glow = '0 0 4px rgba(0, 212, 255, 0.4)';
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      {label && <span style={{ fontSize: '0.9rem', marginRight: '2px' }}>{label}</span>}
      <span style={{ color: starColor, textShadow: glow, letterSpacing: '1px', fontWeight: 'bold' }}>
        {'★'.repeat(stars)}
      </span>
      <span style={{ opacity: 0.12, color: '#fff', letterSpacing: '1px' }}>
        {'★'.repeat(5 - stars)}
      </span>
    </span>
  );
};

export default function HorseCard({
  index,
  emoji,
  name,
  guruNotKnow,
  guruGuess,
  guruRandom,
  selected,
  betCount = 0,
  onClick,
}) {
  const abilityInfo = HORSE_ABILITIES[name] || { ability: "ความสามารถทั่วไป", desc: "ความสามารถมาตรฐานระดับโปร", emoji: "🏇" };

  return (
    <div
      className={`horse-card ${selected ? 'selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px', 
        minHeight: '220px', 
        justifyContent: 'space-between', 
        position: 'relative',
        padding: '16px',
        alignItems: 'center', 
        textAlign: 'center'
      }}
    >
      {/* Absolute Bet Count Badge */}
      {betCount > 0 && (
        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }}>
          <span className="badge" style={{ padding: '4px 10px', fontSize: '0.7rem', background: 'var(--gradient-danger)', boxShadow: '0 0 12px rgba(255, 59, 59, 0.3)', fontWeight: 'bold' }}>
            🔥 {betCount} แทง
          </span>
        </div>
      )}

      {/* Center Section: Emoji, Name, and Stars */}
      <div className="animate-slide-up" style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        width: '100%',
        gap: '4px',
        animationDelay: `${index * 0.03}s`
      }}>
        <div className="horse-card-emoji" style={{ fontSize: '2.5rem', marginBottom: '2px', lineHeight: 1, textAlign: 'center' }}>{emoji}</div>
        
        <div className="horse-card-name" style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '2px 0 6px 0', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', width: '100%', textAlign: 'center' }}>
          {name}
        </div>

        {/* Guru Ratings Display */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', alignItems: 'center', margin: '4px 0', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.78rem', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>🤷 กรู(ไม่)รู:</span>
            {renderStars(guruNotKnow || 3, 'notknow')}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.78rem', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>🎲 กรูเดา:</span>
            {renderStars(guruGuess || 3, 'guess')}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.78rem', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>🤪 กรูมั่ว:</span>
            {renderStars(guruRandom || 3, 'random')}
          </div>
        </div>
      </div>

      {/* Special Ability Badge Segment */}
      <div className="rounded-lg animate-slide-up" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px', 
        textAlign: 'center',
        width: '100%',
        padding: '8px var(--space-sm)',
        background: 'rgba(0, 212, 255, 0.04)', 
        border: '1px solid rgba(0, 212, 255, 0.12)',
        animationDelay: `${index * 0.03 + 0.05}s`
      }}>
        <span className="text-xs font-bold" style={{ color: 'var(--neon-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.75rem', width: '100%' }}>
          {abilityInfo.emoji} สกิล: {abilityInfo.ability}
        </span>
        <span className="text-xs text-muted-color" style={{ fontSize: '0.65rem', lineHeight: '1.3', textAlign: 'center', display: 'block', width: '100%', color: 'var(--text-secondary)' }}>
          {abilityInfo.desc}
        </span>
      </div>

      {selected && (
        <div
          className="text-center text-xs text-cyan mt-xs animate-slide-up"
          style={{ animationDuration: '0.2s', fontWeight: 'bold' }}
        >
          ✅ เลือกม้าตัวนี้แล้ว
        </div>
      )}
    </div>
  );
}
