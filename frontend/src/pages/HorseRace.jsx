import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket, useSocketEvent } from '../hooks/useSocket';
import HorseCard from '../components/HorseCard';
import Timer from '../components/Timer';
import DrinkCounter from '../components/DrinkCounter';
import GameResult from '../components/GameResult';
import { api } from '../utils/api';
import { getAvatarEmoji } from '../utils/avatars';

const HORSE_EMOJIS = ['🐎', '🦄', '🏇', '🐴', '🎠', '🦓', '🐗', '🫏'];

const HORSE_ABILITIES = {
  "พญาลม": { ability: "เจ้าแห่งลมพายุ", emoji: "🌪️" },
  "เจ้าฟ้า": { ability: "สมาธิบริสุทธิ์", emoji: "✨" },
  "หมูตัน": { ability: "อึดและทนทาน", emoji: "🛡️" },
  "จอมซิ่ง": { ability: "ไนโตรทางตรง", emoji: "🚀" },
  "มังกรดำ": { ability: "โชคชะตาลึกลับ", emoji: "🔮" },
  "สิงห์สนามซ้อม": { ability: "เครื่องร้อนไว", emoji: "🦁" },
  "เต่าบินเกียร์ห้า": { ability: "แรงฮึดไล่แซง", emoji: "🐢" },
  "สายฟ้าหน้ามึน": { ability: "เดาทางยาก", emoji: "⚡" }
};

const PHASES = {
  BETTING: 'betting',
  RACING: 'racing',
  RESULT: 'result',
};

export default function HorseRace() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [phase, setPhase] = useState(PHASES.BETTING);
  const [raceId, setRaceId] = useState(null);
  const [horses, setHorses] = useState([]);
  const [selectedHorseId, setSelectedHorseId] = useState(null);
  const [bets, setBets] = useState({}); // { horseId: count }
  const [positions, setPositions] = useState({}); // { horseId: percentage }
  const [timer, setTimer] = useState(30);
  const [isHost, setIsHost] = useState(false);
  const [winner, setWinner] = useState(null);
  const [losers, setLosers] = useState([]);
  const [drinkCount, setDrinkCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [racing, setRacing] = useState(false);
  const [rankings, setRankings] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [raceBets, setRaceBets] = useState([]);
  const [horseEvents, setHorseEvents] = useState({});

  // Initialize room and check host
  useEffect(() => {
    async function init() {
      try {
        const data = await api.get(`/api/rooms/${code}`);
        setIsHost(data.room.hostId === user?.id);
        
        // Fetch current drink count
        const stats = await api.get(`/api/stats/room/${data.room.id}`);
        const myStat = stats.leaderboard.find(s => s.userId === user?.id);
        if (myStat) setDrinkCount(myStat.count);
      } catch (err) {
        console.error(err);
      }
    }
    init();
  }, [code, user]);

  // Socket: join room channel and create race if host
  useEffect(() => {
    if (!socket || !code) return;
    
    // Make sure we are in the room channel
    socket.emit('room:join', code, () => {
      // If host and no race yet, start one automatically
      if (isHost && !raceId) {
        socket.emit('horse:newRace', code);
      }
    });

    // We can also poll for the room's current active race if we join late,
    // but for now relying on host to start it or events.
  }, [socket, code, isHost, raceId]);

  // Timer countdown
  useEffect(() => {
    let interval;
    if (phase === PHASES.BETTING && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    } else if (timer === 0 && isHost && phase === PHASES.BETTING) {
      // Auto close betting if timer runs out
      handleStartRace();
    }
    return () => clearInterval(interval);
  }, [phase, timer, isHost]);

  // Socket events
  useSocketEvent(
    'horse:raceCreated',
    useCallback((data) => {
      setRaceId(data.race.id);
      setHorses(data.horses);
      setPhase(PHASES.BETTING);
      setSelectedHorseId(null);
      setBets({});
      setPositions({});
      setWinner(null);
      setLosers([]);
      setRankings([]);
      setLeaderboard([]);
      setShowResult(false);
      setTimer(30);
      setRaceBets([]);
      setHorseEvents({});
    }, [])
  );

  useSocketEvent(
    'horse:betUpdate',
    useCallback((data) => {
      const newBets = {};
      data.betCounts.forEach(b => {
        newBets[b.horseId] = b.count;
      });
      setBets(newBets);
    }, [])
  );

  useSocketEvent(
    'horse:raceStarting',
    useCallback(() => {
      setPhase(PHASES.RACING);
      setRacing(true);
    }, [])
  );

  useSocketEvent(
    'horse:frame',
    useCallback((data) => {
      const newPositions = {};
      const newEvents = {};
      // server distance is out of 2500
      data.frame.horses.forEach(h => {
        newPositions[h.horseId] = (h.distance / 2500) * 100;
        newEvents[h.horseId] = h.event;
      });
      setPositions(newPositions);
      setHorseEvents(newEvents);
      setRacing(!data.isLast);
    }, [])
  );

  useSocketEvent(
    'horse:result',
    useCallback((data) => {
      setPhase(PHASES.RESULT);
      setWinner(data.winner);
      setLosers(data.loserBettors || []);
      setRankings(data.rankings || []);
      setLeaderboard(data.leaderboard || []);
      setRaceBets(data.bets || []);
      setRacing(false);
      
      // Update drink count if I am in the losers
      const myLoss = data.loserBettors.find(l => l.userId === user?.id);
      if (myLoss) {
        setDrinkCount(prev => prev + 1);
      }
      
      setShowResult(true);
    }, [user])
  );

  useSocketEvent(
    'room:goBackToLobby',
    useCallback(() => {
      navigate(`/room/${code}`);
    }, [navigate, code])
  );

  function handleBet(horseId) {
    if (phase !== PHASES.BETTING) return;
    setSelectedHorseId(horseId);
    if (socket && raceId) {
      socket.emit('horse:bet', { raceId, horseId });
    }
  }

  function handleStartRace() {
    if (socket && raceId) {
      socket.emit('horse:startRace', raceId);
    }
  }

  function handlePlayAgain() {
    if (socket) {
      socket.emit('horse:newRace', code);
    }
  }

  function handleBackToRoom() {
    if (socket && code) {
      socket.emit('room:backToLobby', code);
    }
  }

  const getHorseEmoji = (horseId) => {
    const idx = horses.findIndex(h => h.id === horseId);
    if (idx === -1) return '🏇';
    return HORSE_EMOJIS[idx % HORSE_EMOJIS.length];
  };

  const guruNotKnow5 = horses.find(h => h.guruNotKnow === 5);
  const guruGuess5 = horses.find(h => h.guruGuess === 5);
  const guruRandom5 = horses.find(h => h.guruRandom === 5);

  const guruNotKnow1 = horses.find(h => h.guruNotKnow === 1);
  const guruGuess1 = horses.find(h => h.guruGuess === 1);
  const guruRandom1 = horses.find(h => h.guruRandom === 1);

  return (
    <div className="page-container">
      <div className="game-header-bar animate-slide-up">
        <h1 className="page-title mb-0" style={{ fontSize: '1.4rem' }}>🏇 แข่งม้า</h1>
        <DrinkCounter count={drinkCount} />
      </div>

      {/* Betting Phase */}
      {phase === PHASES.BETTING && (
        <div className="animate-slide-up">
          <div className="text-center mb-lg">
            <Timer seconds={timer} total={30} />
            <p className="text-secondary-color mt-sm">เลือกม้าที่จะแทง!</p>
          </div>

          {horses.length > 0 && (
            <div className="glass-card no-hover mb-lg" style={{ 
              padding: '16px', 
              border: '1px solid rgba(255, 225, 77, 0.15)', 
              background: 'rgba(255, 225, 77, 0.02)', 
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 15px rgba(255, 225, 77, 0.02)'
            }}>
              <h3 className="text-center font-bold mb-md" style={{ 
                color: '#ffd700', 
                fontSize: '1.05rem', 
                textShadow: '0 0 8px rgba(255, 215, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}>
                🔮 โพยทรรศนะจาก 3 กูรู
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1.4fr', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                  <span>กูรูวิเคราะห์</span>
                  <span style={{ color: 'var(--neon-green)' }}>👑 เต็งห้าดาว</span>
                  <span style={{ color: '#ff4d4d' }}>💩 บ๊วยหนึ่งดาว</span>
                </div>
                
                {/* Guru 1 */}
                {guruNotKnow5 && guruNotKnow1 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1.4fr', gap: '8px', alignItems: 'center', fontSize: '0.82rem' }}>
                    <span className="font-semibold" style={{ color: 'var(--neon-yellow)' }}>🤷 กรู(ไม่)รู</span>
                    <span className="truncate" style={{ color: '#ffd700', fontWeight: '500' }}>
                      {getHorseEmoji(guruNotKnow5.id)} {guruNotKnow5.name}
                    </span>
                    <span className="truncate" style={{ color: 'var(--text-muted)', opacity: 0.85 }}>
                      {getHorseEmoji(guruNotKnow1.id)} {guruNotKnow1.name}
                    </span>
                  </div>
                )}

                {/* Guru 2 */}
                {guruGuess5 && guruGuess1 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1.4fr', gap: '8px', alignItems: 'center', fontSize: '0.82rem', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                    <span className="font-semibold" style={{ color: 'var(--neon-pink)' }}>🎲 กรูเดา</span>
                    <span className="truncate" style={{ color: '#ffd700', fontWeight: '500' }}>
                      {getHorseEmoji(guruGuess5.id)} {guruGuess5.name}
                    </span>
                    <span className="truncate" style={{ color: 'var(--text-muted)', opacity: 0.85 }}>
                      {getHorseEmoji(guruGuess1.id)} {guruGuess1.name}
                    </span>
                  </div>
                )}

                {/* Guru 3 */}
                {guruRandom5 && guruRandom1 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1.4fr', gap: '8px', alignItems: 'center', fontSize: '0.82rem', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                    <span className="font-semibold" style={{ color: 'var(--neon-cyan)' }}>🤪 กรูมั่ว</span>
                    <span className="truncate" style={{ color: '#ffd700', fontWeight: '500' }}>
                      {getHorseEmoji(guruRandom5.id)} {guruRandom5.name}
                    </span>
                    <span className="truncate" style={{ color: 'var(--text-muted)', opacity: 0.85 }}>
                      {getHorseEmoji(guruRandom1.id)} {guruRandom1.name}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {!horses.length && (
            <div className="text-center py-xl">
              <div className="spinner lg mx-auto mb-md" />
              <p>กำลังเตรียมสนามแข่ง...</p>
            </div>
          )}

          <div className="horse-selection-grid">
            {horses.map((horse, i) => (
              <HorseCard
                key={horse.id}
                index={i}
                emoji={HORSE_EMOJIS[i % HORSE_EMOJIS.length]}
                name={horse.name}
                guruNotKnow={horse.guruNotKnow}
                guruGuess={horse.guruGuess}
                guruRandom={horse.guruRandom}
                selected={selectedHorseId === horse.id}
                betCount={bets[horse.id] || 0}
                onClick={() => handleBet(horse.id)}
              />
            ))}
          </div>

          {isHost && horses.length > 0 && (
            <button
              className="btn btn-danger btn-block mt-xl"
              onClick={handleStartRace}
            >
              🏁 เริ่มแข่งเลย
            </button>
          )}
        </div>
      )}

      {/* Racing Phase */}
      {phase === PHASES.RACING && (
        <div className="animate-slide-up">
          <div className="race-status-header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <span className="pulse-ring" />
              <h2 className="text-xl font-bold" style={{ margin: 0 }}>
                🏁 แข่งอยู่!
              </h2>
              <span className="pulse-ring" />
            </div>
            {selectedHorseId && (
              <p className="text-xs text-secondary-color" style={{ marginTop: '6px', opacity: 0.8 }}>
                คุณเชียร์: {HORSE_EMOJIS[horses.findIndex(h => h.id === selectedHorseId) % HORSE_EMOJIS.length]} {horses.find(h => h.id === selectedHorseId)?.name}
              </p>
            )}
          </div>

          <div className="race-track">
            {horses.map((horse, i) => {
              const pos = positions[horse.id] || 0;
              return (
                <div key={horse.id} className="horse-lane">
                  <div className="horse-lane-bg" />
                  <span className="horse-lane-number">{i + 1}</span>
                  <div className="horse-progress">
                    <div
                      className={`horse-trail lane-${i}`}
                      style={{ width: `${pos}%` }}
                    />
                    {/* Floating status badge */}
                    {horseEvents[horse.id] === 'burst' && (
                      <span 
                        className="absolute text-xs animate-bounce" 
                        style={{ 
                          top: '-15px', 
                          left: `calc(${pos}% - 8px)`, 
                          zIndex: 5, 
                          fontWeight: 'bold', 
                          color: '#ffea00',
                          textShadow: '0 0 8px rgba(255, 234, 0, 0.8)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        🔥 พุ่ง!
                      </span>
                    )}
                    {horseEvents[horse.id] === 'stumble' && (
                      <span 
                        className="absolute text-xs animate-pulse" 
                        style={{ 
                          top: '-15px', 
                          left: `calc(${pos}% - 8px)`, 
                          zIndex: 5, 
                          fontWeight: 'bold', 
                          color: '#ff3333',
                          textShadow: '0 0 8px rgba(255, 51, 51, 0.8)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        💫 มึน!
                      </span>
                    )}

                    <span
                      className={`horse ${racing ? 'galloping' : ''} ${horseEvents[horse.id] === 'burst' ? 'bursting' : ''} ${horseEvents[horse.id] === 'stumble' ? 'stumbling' : ''}`}
                      style={{ left: `calc(${pos}% - 12px)` }}
                    >
                      {HORSE_EMOJIS[i % HORSE_EMOJIS.length]}
                    </span>
                  </div>
                  <div className="finish-line" />
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-sm justify-center mt-lg">
            {horses.map((horse, i) => (
              <span
                key={horse.id}
                className="badge outline"
                style={{
                  borderColor:
                    selectedHorseId === horse.id ? 'var(--neon-cyan)' : undefined,
                }}
              >
                {HORSE_EMOJIS[i % HORSE_EMOJIS.length]} {horse.name}
                {selectedHorseId === horse.id && ' ⭐'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Result Phase */}
      {phase === PHASES.RESULT && !showResult && (
        <div className="text-center animate-slide-up">
          <h2 className="text-xl font-bold mb-lg">🏆 ผลการแข่ง</h2>
          {winner && (
            <div className="glass-card no-hover mb-lg text-center">
              <div style={{ fontSize: '4rem' }}>{HORSE_EMOJIS[horses.findIndex(h => h.id === winner.id) % HORSE_EMOJIS.length]}</div>
              <p className="text-lg font-bold text-gradient mt-sm">
                {winner.name} ชนะ!
              </p>
            </div>
          )}

          {/* Horse Finishing Placements */}
          {rankings.length > 0 && (
            <div className="glass-card no-hover mb-lg" style={{ textAlign: 'left' }}>
              <h3 className="text-md font-bold mb-md flex items-center gap-xs">
                🏁 ลำดับการเข้าเส้นชัย
              </h3>
              <div className="flex flex-col gap-sm">
                {rankings.map((h, i) => {
                  const placeEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
                  const isSafe = i < 3;
                  const horseBettors = raceBets.filter(b => b.horseId === h.id);
                  return (
                    <div
                      key={h.id}
                      className="flex flex-col gap-xs p-sm glass-card compact"
                      style={{
                        borderColor: isSafe ? 'rgba(124, 255, 45, 0.4)' : 'rgba(255, 45, 120, 0.4)',
                        background: isSafe ? 'rgba(124, 255, 45, 0.02)' : 'rgba(255, 45, 120, 0.02)',
                        boxShadow: isSafe ? '0 0 10px rgba(124, 255, 45, 0.05)' : 'none',
                      }}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-md">
                          <span style={{ fontSize: '1.25rem', width: '24px', textAlign: 'center', fontWeight: 'bold' }}>{placeEmoji}</span>
                          <span style={{ fontSize: '1.75rem' }}>{HORSE_EMOJIS[horses.findIndex(original => original.id === h.id) % HORSE_EMOJIS.length]}</span>
                          <div>
                            <div className="font-semibold" style={{ color: h.color }}>{h.name}</div>
                            <div className="text-xs text-muted-color">ความเร็ว: {h.speed} | สเตมิน่า: {h.stamina}</div>
                            <div className="text-xs text-muted-color" style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px', color: 'var(--neon-cyan)', opacity: 0.9, fontWeight: '500' }}>
                              {HORSE_ABILITIES[h.name]?.emoji} สกิล: {HORSE_ABILITIES[h.name]?.ability}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-sm">
                          <span
                            style={{
                              padding: '4px 10px',
                              fontSize: '0.75rem',
                              borderRadius: '12px',
                              fontWeight: '700',
                              background: isSafe ? 'var(--gradient-success)' : 'var(--gradient-danger)',
                              color: isSafe ? '#0a0015' : 'white',
                              boxShadow: isSafe ? '0 0 10px rgba(124, 255, 45, 0.2)' : '0 0 10px rgba(255, 59, 59, 0.2)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {isSafe ? 'รอดตัว 🟢' : 'ต้องดื่ม 🍻'}
                          </span>
                          <div className="text-sm font-bold text-secondary-color">
                            {h.finishTick ? `${h.finishTick} วิ` : 'ยังไม่ถึง'}
                          </div>
                        </div>
                      </div>

                      {/* Bettors list for this horse */}
                      {horseBettors.length > 0 && (
                        <div className="mt-xs pt-xs flex flex-wrap gap-xs items-center w-full" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <span className="text-xs text-muted-color mr-xs">👥 คนที่เลือก:</span>
                          {horseBettors.map((b) => (
                            <div key={b.userId} className="flex items-center gap-xs p-xs rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.02)' }}>
                              <div className="avatar-circle sm" style={{ width: '18px', height: '18px', fontSize: '0.85rem', borderWidth: '1px' }}>
                                {getAvatarEmoji(b.avatar)}
                              </div>
                              <span className="font-semibold text-xs">{b.username}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* User Leaderboard */}
          {leaderboard.length > 0 && (
            <div className="glass-card no-hover mb-lg" style={{ textAlign: 'left' }}>
              <h3 className="text-md font-bold mb-md flex items-center gap-xs">
                🏆 อันดับคะแนนสะสมในห้อง
              </h3>
              <div className="flex flex-col gap-xs">
                {leaderboard.map((player, index) => {
                  const isTop = index === 0;
                  return (
                    <div key={player.userId} className="flex items-center justify-between p-sm" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex items-center gap-md">
                        <span style={{ fontWeight: 'bold', width: '20px', color: isTop ? 'var(--neon-yellow)' : 'var(--text-color)' }}>#{index + 1}</span>
                        <div className="avatar-circle sm glow-purple">
                          {getAvatarEmoji(player.avatar)}
                        </div>
                        <span className="font-semibold">{player.username}</span>
                      </div>
                      <div className="font-bold" style={{ color: 'var(--neon-cyan)' }}>
                        ⭐ {player.score} แต้ม
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isHost && (
            <div className="flex flex-col gap-md">
              <button className="btn btn-primary btn-block" onClick={handlePlayAgain}>
                🔄 เล่นอีกรอบ
              </button>
              <button className="btn btn-secondary btn-block" onClick={handleBackToRoom}>
                🚪 กลับห้อง
              </button>
            </div>
          )}
        </div>
      )}

      {/* Game Result Overlay */}
      {showResult && (
        <GameResult
          emoji="🏆"
          title={
            winner
              ? `${winner.name} ชนะ!`
              : 'จบการแข่ง!'
          }
          losers={losers.map(l => ({ username: l.username, avatar: l.avatar }))}
          onDismiss={() => setShowResult(false)}
        />
      )}
    </div>
  );
}
