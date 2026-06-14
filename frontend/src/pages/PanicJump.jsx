import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket, useSocketEvent } from '../hooks/useSocket';
import { api } from '../utils/api';
import { getAvatarEmoji } from '../utils/avatars';

const PHASES = {
  JUMPING: 'JUMPING',
  CALCULATING: 'CALCULATING',
  REVEAL: 'REVEAL',
  FINAL_SUMMARY: 'FINAL_SUMMARY',
};

export default function PanicJump() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [room, setRoom] = useState(null);
  const [phase, setPhase] = useState(PHASES.JUMPING);
  const [roundId, setRoundId] = useState(null);
  const [roundNum, setRoundNum] = useState(1);
  const [maxRounds, setMaxRounds] = useState(3);
  const [quota, setQuota] = useState(0);
  
  const [timeLeft, setTimeLeft] = useState(8);
  const [hasJumped, setHasJumped] = useState(false);
  
  const [revealData, setRevealData] = useState(null);
  const [finalData, setFinalData] = useState(null);

  // Fetch room data
  useEffect(() => {
    async function fetchRoom() {
      try {
        const data = await api.get(`/api/rooms/${code}`);
        setRoom(data.room);
      } catch (err) {
        console.error(err);
      }
    }
    fetchRoom();
  }, [code]);

  useEffect(() => {
    if (!socket || !code) return;
    socket.emit('room:join', code);
  }, [socket, code]);

  // Host auto-starts game upon entering
  useEffect(() => {
    if (socket && room && room.hostId === user?.id && !roundId) {
      socket.emit('jump:start', room.id);
    }
  }, [socket, room, user, roundId]);

  // Timer logic for JUMPING phase
  useEffect(() => {
    if (phase !== PHASES.JUMPING || timeLeft <= 0) return;
    
    const timerId = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(timerId);
  }, [phase, timeLeft]);

  // Timer logic for CALCULATING phase
  useEffect(() => {
    if (phase === PHASES.CALCULATING) {
      const playerCount = (revealData?.survivors?.length || 0) + (revealData?.drinkers?.length || 0);
      const calculateTime = 4000 + (playerCount * 800); // Dynamic timer based on player count
      
      const timerId = setTimeout(() => {
        setPhase(PHASES.REVEAL);
      }, calculateTime);
      return () => clearTimeout(timerId);
    }
  }, [phase, revealData]);

  // Socket Events
  useSocketEvent('jump:roundStarted', useCallback((data) => {
    setRoundId(data.roundId);
    setRoundNum(data.roundNum);
    setMaxRounds(data.maxRounds);
    setQuota(data.quota);
    setPhase(PHASES.JUMPING);
    setTimeLeft(data.duration);
    setHasJumped(false);
    setRevealData(null);
  }, []));

  useSocketEvent('jump:revealed', useCallback((data) => {
    setRevealData(data);
    setPhase(PHASES.CALCULATING);
  }, []));

  useSocketEvent('jump:gameFinished', useCallback((data) => {
    setFinalData(data);
    setPhase(PHASES.FINAL_SUMMARY);
  }, []));

  useSocketEvent('room:goBackToLobby', useCallback(() => {
    navigate(`/room/${code}`);
  }, [navigate, code]));

  // Prevent rapid double clicks
  const isJumpingRef = useRef(false);
  useEffect(() => {
    isJumpingRef.current = false;
  }, [roundId]);

  // Handlers
  const handleJump = () => {
    if (hasJumped || isJumpingRef.current || timeLeft <= 0 || !socket || !room || !roundId) return;
    
    isJumpingRef.current = true;
    setHasJumped(true);
    socket.emit('jump:action', { roundId, roomId: room.id }, (res) => {
      if (res?.error) {
        if (res.error === "คุณกระโดดไปแล้ว") {
          // If server says we already jumped, just ignore the error
          // as we want the button to stay in the "Jumped!" state.
          return;
        }
        setHasJumped(false);
        isJumpingRef.current = false;
        alert(res.error);
      }
    });
  };

  const isHost = room?.hostId === user?.id;

  return (
    <div className="page-container">
      <div className="game-header-bar animate-slide-down">
        <h1 className="page-title mb-0" style={{ fontSize: '1.4rem' }}>🪂 ร่มชูชีพวัดใจ</h1>
        <span className="badge primary">รอบที่ {roundNum}/{maxRounds}</span>
      </div>

      <div className="game-content mt-xl">
        {phase === PHASES.JUMPING && (
          <div className="text-center animate-bounce-in flex flex-col items-center justify-center min-h-[60vh]">
            <div className="glass-card mb-xl text-center" style={{ width: '100%', maxWidth: '300px' }}>
              <h3 className="text-lg text-secondary-color mb-xs">⏳ เหลือเวลาโดด</h3>
              <div 
                style={{ 
                  fontSize: '5rem', 
                  fontWeight: 'bold', 
                  color: timeLeft <= 3 ? 'var(--neon-pink)' : 'var(--neon-cyan)', 
                  textShadow: '0 0 20px currentColor',
                  fontFamily: 'monospace'
                }}
              >
                {timeLeft}s
              </div>
            </div>
            
            <button 
              className={`btn ${hasJumped ? 'btn-secondary' : 'btn-danger'} pulse-animation flex flex-col items-center justify-center`}
              style={{ 
                width: '240px', 
                height: '240px', 
                borderRadius: '50%', 
                fontSize: '2rem', 
                boxShadow: hasJumped ? 'inset 0 0 20px rgba(0,0,0,0.5)' : '0 0 50px rgba(255, 45, 120, 0.6)',
                transition: 'all 0.3s ease'
              }}
              onClick={handleJump}
              disabled={hasJumped || timeLeft <= 0}
            >
              <span style={{ fontSize: '4rem', marginBottom: '10px' }}>{hasJumped ? '🪂' : '🔥'}</span>
              <span>{hasJumped ? 'กระโดดแล้ว!' : 'กระโดด!'}</span>
            </button>
            <div className="badge primary mt-lg mb-sm" style={{ fontSize: '1.1rem', padding: '8px 16px', background: 'rgba(0, 212, 255, 0.1)', border: '1px solid var(--neon-cyan)' }}>
              🎯 โควต้ารอดชีวิตรอบนี้: <span className="font-bold text-gradient">{quota} คน</span>
            </div>
            <p className="text-secondary-color">รีบกดกระโดดให้รอดโควต้า แต่ห้ามเป็นคนแรกหรือคนสุดท้าย!</p>
          </div>
        )}

        {phase === PHASES.CALCULATING && (
          <div className="text-center flex flex-col items-center justify-start min-h-[60vh] relative overflow-hidden" style={{ height: '400px', borderRadius: '16px', background: 'rgba(0,0,0,0.2)' }}>
            <h2 className="text-2xl font-bold text-gradient mb-xs mt-lg relative z-10" style={{ background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: '20px' }}>กำลังดิ่งพสุธา...</h2>
            <p className="text-secondary-color text-sm relative z-10" style={{ background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: '12px' }}>ใครช้า... ใครรอด... ลุ้นกัน!</p>
            
            <div className="absolute inset-0 w-full h-full pointer-events-none">
              {(() => {
                const allJumps = [
                  ...(revealData?.survivors || []).map(j => ({ ...j, isSurvivor: true })),
                  ...(revealData?.drinkers || []).map(j => ({ ...j, isSurvivor: false }))
                ].sort((a, b) => a.jumpOrder - b.jumpOrder);

                return allJumps.map((jump, idx) => {
                  const isSurvivor = jump.isSurvivor;
                  const isMe = jump.user.id === user?.id;
                  
                  // Animation config
                  const animName = isSurvivor ? 'parachute-fall' : 'free-fall';
                  const animDuration = isSurvivor ? '4.5s' : '2.5s'; // Slower animations
                  const delay = `${idx * 0.8}s`; // More stagger delay
                  const leftPos = `${15 + (idx * 25) % 60}%`; // Spread horizontally
                  
                  return (
                    <div 
                      key={jump.user.id} 
                      style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: leftPos, 
                        animation: `${animName} ${animDuration} ease-in forwards`,
                        animationDelay: delay,
                        opacity: 0,
                        zIndex: 5
                      }}
                      className="flex flex-col items-center"
                    >
                      <div style={{ fontSize: '3rem', marginBottom: '-10px', zIndex: 2 }}>
                        {isSurvivor ? '🪂' : '🔥'}
                      </div>
                      <div className={`avatar-circle md ${isMe ? 'pulse-animation' : ''}`} style={{ 
                        border: isMe ? '3px solid var(--neon-cyan)' : (isSurvivor ? '2px solid var(--neon-green)' : '2px solid var(--neon-pink)'), 
                        background: '#111',
                        boxShadow: isMe ? '0 0 15px var(--neon-cyan)' : 'none',
                        transform: isMe ? 'scale(1.2)' : 'scale(1)'
                      }}>
                        {getAvatarEmoji(jump.user.avatar)}
                      </div>
                      <div className="text-sm font-bold mt-xs px-sm py-[4px] rounded-full whitespace-nowrap" style={{
                        background: isMe ? 'var(--primary-color)' : 'rgba(0,0,0,0.8)',
                        color: 'white',
                        border: isMe ? '1px solid var(--neon-cyan)' : '1px solid rgba(255,255,255,0.2)',
                        boxShadow: isMe ? '0 0 10px var(--neon-cyan)' : 'none',
                        zIndex: isMe ? 10 : 1
                      }}>
                        {jump.user.username} {isMe && '(คุณ)'}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {phase === PHASES.REVEAL && (
          <div className="text-center animate-slide-up">
            <h2 className="text-xl font-bold mb-md text-gradient">ผลรอบที่ {revealData?.roundNum}</h2>
            
            <div className="glass-card mb-lg text-left">
              <h3 className="font-bold text-md mb-sm flex items-center gap-xs" style={{ color: 'var(--neon-green)' }}>
                🎉 ผู้รอดชีวิต (+1 ดาว)
              </h3>
              <div className="flex flex-col gap-xs mb-md">
                {revealData?.survivors.map(s => (
                  <div key={s.user.id} className="flex items-center gap-sm p-sm rounded-lg" style={{ background: 'rgba(124, 255, 45, 0.1)', border: '1px solid rgba(124, 255, 45, 0.3)' }}>
                    <div className="avatar-circle">{getAvatarEmoji(s.user.avatar)}</div>
                    <div className="flex-1">
                      <span className="font-bold">{s.user.username}</span>
                      <div className="text-xs text-secondary-color">ลำดับที่ {s.jumpOrder} - {s.reason}</div>
                    </div>
                    <div className="text-xl">🌟 <span className="text-sm">+{s.points}</span></div>
                  </div>
                ))}
                {(!revealData?.survivors || revealData.survivors.length === 0) && (
                  <p className="text-secondary-color text-sm py-sm text-center">ไม่มีใครรอดเลย...</p>
                )}
              </div>

              <h3 className="font-bold text-md mb-sm flex items-center gap-xs" style={{ color: 'var(--neon-pink)' }}>
                💀 ผู้เสียชีวิต (ต้องดื่ม)
              </h3>
              <div className="flex flex-col gap-xs">
                {revealData?.drinkers.map(d => (
                  <div key={d.user.id} className="flex items-center gap-sm p-sm rounded-lg" style={{ background: 'rgba(255, 45, 120, 0.1)', border: '1px solid rgba(255, 45, 120, 0.3)' }}>
                    <div className="avatar-circle">{getAvatarEmoji(d.user.avatar)}</div>
                    <div className="flex-1">
                      <span className="font-bold">{d.user.username}</span>
                      <div className="text-xs text-secondary-color">ลำดับที่ {d.jumpOrder} - {d.reason}</div>
                    </div>
                    <div className="text-xl">🍻</div>
                  </div>
                ))}
              </div>
            </div>

            {revealData?.allScores && (
              <div className="glass-card mb-lg text-left compact" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
                <h3 className="font-bold text-sm mb-sm text-secondary-color">🏆 ตารางคะแนนรวมล่าสุด</h3>
                <div className="flex flex-col gap-xs">
                  {revealData.allScores.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between p-xs rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div className="flex items-center gap-xs">
                        <span className="avatar-circle sm" style={{ width: '28px', height: '28px', fontSize: '1rem' }}>{getAvatarEmoji(s.avatar)}</span>
                        <span className="font-medium">{s.username}</span>
                      </div>
                      <span className="font-bold text-gradient text-md">{s.score} 🌟</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isHost && (
              roundNum < maxRounds ? (
                <button className="btn btn-primary btn-block btn-lg pulse-animation" onClick={() => socket.emit('jump:nextRound', room.id)}>
                  ไปลุยรอบที่ {roundNum + 1}
                </button>
              ) : (
                <button className="btn btn-danger btn-block btn-lg pulse-animation" onClick={() => socket.emit('jump:finish', room.id)}>
                  สรุปผลคนแพ้!
                </button>
              )
            )}
            {!isHost && (
              <p className="text-secondary-color mt-md">รอเจ้าของห้องเริ่มรอบถัดไป...</p>
            )}
          </div>
        )}

        {phase === PHASES.FINAL_SUMMARY && (
          <div className="text-center animate-bounce-in">
            <h2 className="text-2xl font-bold text-gradient mb-md" style={{ textShadow: '0 0 20px rgba(0, 212, 255, 0.5)' }}>
              บทลงโทษชุดใหญ่! 🚨
            </h2>
            
            <div className="glass-card mb-lg" style={{ borderColor: 'var(--neon-pink)', boxShadow: '0 0 30px rgba(255, 45, 120, 0.2)' }}>
              <h3 className="text-md font-bold mb-md text-secondary-color">ผู้แพ้ (คะแนนน้อยที่สุด)</h3>
              <div className="flex flex-wrap justify-center gap-md mb-md">
                {finalData?.losers.map(l => (
                  <div key={l.id} className="text-center">
                    <div className="avatar-circle lg mx-auto mb-xs" style={{ width: '90px', height: '90px', fontSize: '3.5rem', border: '3px solid var(--neon-pink)' }}>
                      {getAvatarEmoji(l.avatar)}
                    </div>
                    <div className="font-bold text-lg mt-sm">{l.username}</div>
                    <div className="text-sm text-secondary-color">{l.score} คะแนน</div>
                  </div>
                ))}
              </div>
              <div className="p-sm rounded-lg" style={{ background: 'rgba(255, 45, 120, 0.15)' }}>
                <p className="text-lg font-bold" style={{ color: 'var(--neon-pink)' }}>โดนเพียว 1 แก้วเต็ม! 🥃</p>
                <p className="text-sm text-secondary-color">รับผิดชอบความช้าของตัวเองซะ!</p>
              </div>
            </div>

            <div className="glass-card mb-lg text-left compact">
              <h3 className="font-bold text-sm mb-sm text-muted-color">สรุปคะแนนทุกคน (3 รอบ)</h3>
              <div className="flex flex-col gap-xs">
                {finalData?.allScores.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between p-xs rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center gap-xs">
                      <span className="avatar-circle sm" style={{ width: '28px', height: '28px', fontSize: '1rem' }}>{getAvatarEmoji(s.avatar)}</span>
                      <span className="font-medium">{s.username}</span>
                    </div>
                    <span className="font-bold text-gradient text-lg">{s.score} 🌟</span>
                  </div>
                ))}
              </div>
            </div>

            {isHost && (
              <button className="btn btn-secondary btn-block btn-lg" onClick={() => socket.emit('room:backToLobby', room.id)}>
                กลับล็อบบี้
              </button>
            )}
            {!isHost && (
              <p className="text-secondary-color mt-md">รอเจ้าของห้องพากลับล็อบบี้...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
