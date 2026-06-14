import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket, useSocketEvent } from '../hooks/useSocket';
import { getAvatarEmoji } from '../utils/avatars';
import VoteOption from '../components/VoteOption';
import Timer from '../components/Timer';
import DrinkCounter from '../components/DrinkCounter';
import GameResult from '../components/GameResult';
import { api } from '../utils/api';

const PHASES = {
  WAITING: 'waiting',
  QUESTION: 'question',
  VOTING: 'voting',
  REVEAL: 'reveal',
};

export default function MinorityVote() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [phase, setPhase] = useState(PHASES.WAITING);
  const [roomId, setRoomId] = useState(null);
  const [roundId, setRoundId] = useState(null);
  
  const [question, setQuestion] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  
  const [selectedVote, setSelectedVote] = useState(null);
  const [voted, setVoted] = useState(false);
  const [voteCount, setVoteCount] = useState({ current: 0, total: 0 });
  const [timer, setTimer] = useState(20);
  
  const [results, setResults] = useState(null);
  const [losers, setLosers] = useState([]);
  const [drinkCount, setDrinkCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  
  const [countdown, setCountdown] = useState(null);
  const [pendingResults, setPendingResults] = useState(null);
  
  const [isSetter, setIsSetter] = useState(false);
  const [setterInfo, setSetterInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [isHost, setIsHost] = useState(false);
  
  const [aiCategory, setAiCategory] = useState('general');
  const [aiLoading, setAiLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Initialize room
  useEffect(() => {
    async function init() {
      try {
        const data = await api.get(`/api/rooms/${code}`);
        setRoomId(data.room.id);
        setIsHost(data.room.hostId === user?.id);
        setVoteCount(prev => ({ ...prev, total: data.room.players?.length || 0 }));
        
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

  // Join room and setup initial state
  useEffect(() => {
    if (!socket || !code || !roomId) return;
    
    socket.emit('room:join', code, () => {
      // If host, start the first turn automatically if we're waiting
      if (isHost && phase === PHASES.WAITING) {
        socket.emit('vote:nextTurn', roomId);
      }
    });
  }, [socket, code, roomId, isHost, phase]);

  // Timer logic for voting phase
  useEffect(() => {
    let interval;
    if (phase === PHASES.VOTING && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    } else if (timer === 0 && phase === PHASES.VOTING && isHost) {
      // Auto reveal when timer ends (host does it)
      if (roundId) {
        socket.emit('vote:reveal', roundId);
      }
    }
    return () => clearInterval(interval);
  }, [phase, timer, isHost, roundId, socket]);

  // Countdown timer logic
  useEffect(() => {
    if (countdown === null) return;
    
    if (countdown > 0) {
      const timeoutId = setTimeout(() => {
        setCountdown(c => c - 1);
      }, 1000);
      return () => clearTimeout(timeoutId);
    } else {
      setCountdown(null);
      if (pendingResults) {
        const data = pendingResults;
        setPhase(PHASES.REVEAL);
        setResults({
          percentA: data.countA + data.countB > 0 ? Math.round((data.countA / (data.countA + data.countB)) * 100) : 0,
          percentB: data.countA + data.countB > 0 ? Math.round((data.countB / (data.countA + data.countB)) * 100) : 0,
          countA: data.countA,
          countB: data.countB,
          votesA: data.votesA || [],
          votesB: data.votesB || [],
          isTie: data.isTie,
          isMindMatch: data.isMindMatch,
        });
        setLosers(data.drinkers || []);
        
        // Update drink count if I am in the losers
        const myLoss = (data.drinkers || []).find(l => l.userId === user?.id);
        if (myLoss) {
          setDrinkCount(prev => prev + 1);
        }
        
        setShowResult(true);
      }
    }
  }, [countdown, pendingResults, user]);

  // Socket Events
  useSocketEvent(
    'vote:nextSetter',
    useCallback((data) => {
      setPhase(PHASES.QUESTION);
      setIsSetter(data.userId === user?.id);
      setSetterInfo(data);
      setCurrentQuestion(null);
      setSelectedVote(null);
      setVoted(false);
      setResults(null);
      setShowResult(false);
      setQuestion('');
      setOptionA('');
      setOptionB('');
      setVoteCount(prev => ({ ...prev, current: 0 }));
      setCountdown(null);
      setPendingResults(null);
    }, [user])
  );

  useSocketEvent(
    'vote:newQuestion',
    useCallback((data) => {
      setPhase(PHASES.VOTING);
      setRoundId(data.roundId);
      setCurrentQuestion({
        question: data.question,
        optionA: data.optionA,
        optionB: data.optionB,
      });
      setTimer(20);
      setSelectedVote(null);
      setVoted(false);
      setVoteCount(prev => ({ ...prev, current: 0 }));
      setCountdown(null);
      setPendingResults(null);
    }, [])
  );

  useSocketEvent(
    'vote:update',
    useCallback((data) => {
      setVoteCount(prev => ({ ...prev, current: data.totalVotes }));
    }, [])
  );

  useSocketEvent(
    'vote:revealed',
    useCallback((data) => {
      // Store pending results and initiate countdown
      setPendingResults(data);
      setCountdown(3);
    }, [])
  );

  useSocketEvent(
    'room:goBackToLobby',
    useCallback(() => {
      navigate(`/room/${code}`);
    }, [navigate, code])
  );

  function handleSubmitQuestion() {
    if (!optionA.trim() || !optionB.trim()) return;
    setSubmitting(true);
    socket.emit('vote:setQuestion', {
      roomId,
      question: question.trim() || 'โหวตเลือกข้างน้อย! 🗳️',
      optionA: optionA.trim(),
      optionB: optionB.trim(),
    });
    setSubmitting(false);
  }

  function handleGenerateAIQuestion() {
    if (!socket) return;
    setAiLoading(true);
    socket.emit('vote:generateAIQuestion', { category: aiCategory }, (res) => {
      setAiLoading(false);
      if (res && res.success) {
        setQuestion(res.question || '');
        setOptionA(res.optionA || '');
        setOptionB(res.optionB || '');
      }
    });
  }

  function handleVote(option) {
    if (voted || phase !== PHASES.VOTING) return;
    setSelectedVote(option);
  }

  function handleConfirmVote() {
    if (!selectedVote || voted) return;
    socket.emit('vote:cast', { roundId, choice: selectedVote });
    setVoted(true);
  }

  function handleNextQuestion() {
    socket.emit('vote:nextTurn', roomId);
  }

  function handleBackToRoom() {
    if (socket && code) {
      socket.emit('room:backToLobby', code);
    }
  }

  return (
    <div className="page-container">
      <div className="game-header-bar animate-slide-up">
        <h1 className="page-title mb-0" style={{ fontSize: '1.4rem' }}>
          {voteCount.total === 2 ? '🧠 เกมรู้ใจ (Mind Match)' : '🗳️ โหวตข้างน้อย'}
        </h1>
        <DrinkCounter count={drinkCount} />
      </div>

      {phase === PHASES.WAITING && (
        <div className="text-center py-xl animate-slide-up">
          <div className="spinner lg mx-auto mb-md" />
          <p>กำลังเตรียมเกม...</p>
        </div>
      )}

      {/* Question Setting Phase */}
      {phase === PHASES.QUESTION && (
        <div className="animate-slide-up">
          {isSetter ? (
            <div className="glass-card no-hover">
              <h3 className="text-lg font-semibold mb-lg text-center">
                ✍️ ตั้งคำถามและตัวเลือก
              </h3>

              {/* AI Helper Panel */}
              <div
                className="rounded-lg mb-lg"
                style={{
                  background: 'rgba(0, 212, 255, 0.04)',
                  border: '1px solid rgba(0, 212, 255, 0.12)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <span
                  className="text-xs font-bold"
                  style={{ color: 'var(--neon-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  🤖 ตัวช่วยคิดโจทย์ด้วย AI
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    className="input-field"
                    value={aiCategory}
                    onChange={(e) => setAiCategory(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: '120px',
                      padding: '6px 12px',
                      background: 'var(--bg-card)',
                      color: 'white',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                    }}
                    disabled={aiLoading || submitting}
                  >
                    <option value="general">🎲 ทั่วไปกวนๆ</option>
                    <option value="travel">⛰️ ท่องเที่ยว</option>
                    <option value="food">🍲 อาหารการกิน</option>
                    <option value="love">💖 เรื่องความรัก</option>
                    <option value="funny">👻 สมมติขำๆ</option>
                    <option value="party">🍻 สายตี้วงเหล้า</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleGenerateAIQuestion}
                    disabled={aiLoading || submitting}
                    style={{ padding: '8px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                  >
                    {aiLoading ? 'กำลังสุ่ม...' : '✨ สุ่มโจทย์'}
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label>คำถามหลัก (ไม่บังคับ)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="เช่น เบียร์ขวดนี้ต้องเป็นของใคร? (ปล่อยว่างเพื่อใช้คำถามปกติ)"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={aiLoading || submitting}
                />
              </div>

              <div className="input-group">
                <label>ตัวเลือก A</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="ตัวเลือกแรก (เช่น เบียร์)"
                  value={optionA}
                  onChange={(e) => setOptionA(e.target.value)}
                  autoFocus
                  disabled={aiLoading || submitting}
                />
              </div>

              <div className="input-group">
                <label>ตัวเลือก B</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="ตัวเลือกที่สอง (เช่น โซจู)"
                  value={optionB}
                  onChange={(e) => setOptionB(e.target.value)}
                  disabled={aiLoading || submitting}
                />
              </div>

              <button
                className="btn btn-primary btn-block mt-md"
                onClick={handleSubmitQuestion}
                disabled={
                  !optionA.trim() || !optionB.trim() || submitting || aiLoading
                }
              >
                📤 เริ่มโหวต
              </button>
            </div>
          ) : (
            <div className="glass-card no-hover text-center">
              <div className="spinner lg mx-auto mb-lg" />
              <p className="text-lg font-semibold">กำลังรอตัวเลือก...</p>
              {setterInfo && (
                <p className="text-secondary-color mt-sm">
                  {getAvatarEmoji(setterInfo.avatar)} {setterInfo.username} กำลังตั้งตัวเลือก
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Countdown Screen */}
      {countdown !== null && (
        <div className="flex flex-col items-center justify-center py-xl animate-fade-in" style={{ minHeight: '350px' }}>
          <p className="text-secondary-color text-lg mb-md animate-pulse font-semibold">🎲 นับถอยหลังเปิดเผยผลโหวต...</p>
          <div 
            className="flex items-center justify-center font-bold animate-bounce-in" 
            style={{ 
              fontSize: '6rem', 
              width: '150px', 
              height: '150px', 
              borderRadius: '50%', 
              background: 'rgba(255,255,255,0.03)', 
              border: '4px solid var(--neon-cyan)', 
              boxShadow: '0 0 30px rgba(0, 212, 255, 0.3)', 
              color: 'var(--neon-cyan)'
            }}
          >
            {countdown === 0 ? '🔥' : countdown}
          </div>
        </div>
      )}

      {/* Voting Phase */}
      {countdown === null && phase === PHASES.VOTING && currentQuestion && (
        <div className="animate-slide-up">
          <div className="text-center mb-lg">
            <Timer seconds={timer} total={20} />
          </div>

          <div className="glass-card no-hover mb-lg text-center">
            <p className="text-xl font-bold">{currentQuestion.question}</p>
          </div>

          <div className="flex flex-col gap-md mb-lg">
            <VoteOption
              label="A"
              text={currentQuestion.optionA}
              selected={selectedVote === 'A'}
              onClick={() => handleVote('A')}
              result={null}
              revealed={false}
            />
            <VoteOption
              label="B"
              text={currentQuestion.optionB}
              selected={selectedVote === 'B'}
              onClick={() => handleVote('B')}
              result={null}
              revealed={false}
            />
          </div>

          <div className="text-center text-sm text-secondary-color mb-md">
            โหวตแล้ว {voteCount.current}/{voteCount.total} คน
          </div>

          <button
            className="btn btn-primary btn-block"
            onClick={handleConfirmVote}
            disabled={!selectedVote || voted}
          >
            {voted ? '✅ โหวตแล้ว' : '📩 ส่งโหวต'}
          </button>
        </div>
      )}

      {/* Reveal Phase */}
      {countdown === null && phase === PHASES.REVEAL && results && !showResult && (
        <div className="animate-slide-up">
          <h2 className="text-xl font-bold text-center mb-lg">📊 ผลโหวต</h2>

          <div className="glass-card no-hover mb-lg">
            <p className="text-lg font-semibold text-center mb-lg">
              {currentQuestion?.question}
            </p>

            {/* Clear Winner Announcement */}
            <div className="text-center mb-lg p-md rounded-xl animate-bounce-in" style={{ 
              background: results.isTie ? 'rgba(255, 45, 120, 0.05)' : 'rgba(124, 255, 45, 0.05)',
              border: results.isTie ? '1px solid rgba(255, 45, 120, 0.2)' : '1px solid rgba(124, 255, 45, 0.2)',
            }}>
              {results.isMindMatch ? (
                results.isTie ? (
                  <div>
                    <h3 className="text-lg font-bold text-gradient">💔 ใจไม่ตรงกัน!</h3>
                    <p className="text-sm text-secondary-color mt-xs">โหวตคนละทางแบบนี้ ต้องดื่มทั้งคู่! 🍻</p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--neon-green)', textShadow: '0 0 15px rgba(124, 255, 45, 0.4)' }}>
                      🎉 ใจตรงกันสุดๆ! รอดทั้งคู่!
                    </h3>
                    <p className="text-sm text-secondary-color mt-xs">
                      ทั้งสองคนเลือก {results.countA > results.countB ? currentQuestion?.optionA : currentQuestion?.optionB} เหมือนกันเป๊ะ!
                    </p>
                  </div>
                )
              ) : (
                results.isTie ? (
                  <div>
                    <h3 className="text-lg font-bold text-gradient">⚖️ ผลลัพธ์: เสมอ!</h3>
                    <p className="text-sm text-secondary-color mt-xs">เจ๊ากันไป ไม่มีใครเป็นเสียงส่วนน้อย ทุกคนต้องดื่ม! 🍻</p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--neon-green)', textShadow: '0 0 15px rgba(124, 255, 45, 0.4)' }}>
                      🏆 ตัวเลือกข้างน้อยที่ชนะ: {results.countA < results.countB ? currentQuestion?.optionA : currentQuestion?.optionB}
                    </h3>
                    <p className="text-sm text-secondary-color mt-xs">
                      ฝ่ายเสียงส่วนน้อยชนะกติกาเกมนี้ไป! คนที่ตอบตัวเลือกนี้จะต้องดื่ม! 🍻
                    </p>
                  </div>
                )
              )}
            </div>

            {/* Zoom Controls */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>🔍 ซูมกราฟ:</span>
              <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem', borderRadius: '4px' }} onClick={() => setZoomLevel(z => Math.max(1, z - 0.25))}>-</button>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', minWidth: '36px', textAlign: 'center' }}>{Math.round(zoomLevel * 100)}%</span>
              <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem', borderRadius: '4px' }} onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}>+</button>
              <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem', borderRadius: '4px' }} onClick={() => setZoomLevel(1)}>รีเซ็ต</button>
            </div>

            {/* Styled Vote Bars */}
            <div className="vote-reveal">
              <div 
                className="vote-bar mb-md" 
                style={{ 
                  height: `${42 * zoomLevel}px`, 
                  borderRadius: `${21 * zoomLevel}px`,
                  border: results.isTie ? '1px solid rgba(255, 45, 120, 0.3)' : (results.countA < results.countB ? '2px solid var(--neon-green)' : '1px solid var(--glass-border)'),
                  boxShadow: (!results.isTie && results.countA < results.countB) ? '0 0 15px rgba(124, 255, 45, 0.15)' : 'none',
                  background: 'rgba(255,255,255,0.02)',
                  overflow: 'hidden'
                }}
              >
                <div
                  className="vote-bar-fill a animate-slide-up"
                  style={{ 
                    width: `${results.percentA || 0}%`, 
                    height: '100%', 
                    borderRadius: `${21 * zoomLevel}px`,
                    background: results.isTie ? 'var(--gradient-danger)' : (results.countA < results.countB ? 'var(--gradient-success)' : 'rgba(255,255,255,0.08)'),
                    color: (results.countA < results.countB && !results.isTie) ? '#0a0015' : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 15px',
                    fontSize: `${1 * zoomLevel}rem`
                  }}
                >
                  <span className="font-bold">A: {currentQuestion?.optionA}</span>
                  <span className="font-bold">{results.countA} โหวต ({results.percentA}%)</span>
                </div>
              </div>
              
              <div 
                className="vote-bar" 
                style={{ 
                  height: `${42 * zoomLevel}px`, 
                  borderRadius: `${21 * zoomLevel}px`,
                  border: results.isTie ? '1px solid rgba(255, 45, 120, 0.3)' : (results.countB < results.countA ? '2px solid var(--neon-green)' : '1px solid var(--glass-border)'),
                  boxShadow: (!results.isTie && results.countB < results.countA) ? '0 0 15px rgba(124, 255, 45, 0.15)' : 'none',
                  background: 'rgba(255,255,255,0.02)',
                  overflow: 'hidden'
                }}
              >
                <div
                  className="vote-bar-fill b animate-slide-up"
                  style={{ 
                    width: `${results.percentB || 0}%`, 
                    height: '100%', 
                    borderRadius: `${21 * zoomLevel}px`,
                    background: results.isTie ? 'var(--gradient-danger)' : (results.countB < results.countA ? 'var(--gradient-success)' : 'rgba(255,255,255,0.08)'),
                    color: (results.countB < results.countA && !results.isTie) ? '#0a0015' : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 15px',
                    fontSize: `${1 * zoomLevel}rem`
                  }}
                >
                  <span className="font-bold">B: {currentQuestion?.optionB}</span>
                  <span className="font-bold">{results.countB} โหวต ({results.percentB}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Voter Breakdown & Drinkers List */}
          <div className="flex flex-col gap-md mb-lg">
            <h3 className="text-md font-bold mb-xs flex items-center gap-xs">
              📊 รายชื่อจำแนกการโหวต
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              {/* Voters Option A */}
              <div className="glass-card no-hover compact" style={{ borderColor: results.isTie ? 'rgba(255, 45, 120, 0.3)' : (results.countA < results.countB ? 'rgba(124, 255, 45, 0.4)' : 'rgba(255,255,255,0.05)'), background: 'rgba(255,255,255,0.01)' }}>
                <div className="flex items-center justify-between mb-sm border-b pb-xs" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <h4 className="font-bold text-sm" style={{ color: results.isTie ? 'white' : (results.countA < results.countB ? 'var(--neon-pink)' : 'var(--neon-green)') }}>
                    🗳️ ฝ่าย A ({currentQuestion?.optionA})
                  </h4>
                  <span 
                    style={{ 
                      padding: '2px 8px', 
                      fontSize: '0.7rem', 
                      borderRadius: '8px', 
                      fontWeight: 'bold', 
                      background: results.isTie ? 'var(--gradient-danger)' : (results.countA < results.countB ? 'var(--gradient-danger)' : 'var(--gradient-success)'),
                      color: (results.countA >= results.countB && !results.isTie) ? '#0a0015' : 'white',
                      boxShadow: (results.countA >= results.countB && !results.isTie) ? '0 0 10px rgba(124, 255, 45, 0.15)' : '0 0 10px rgba(255, 59, 59, 0.15)'
                    }}
                  >
                    {results.isMindMatch ? (results.isTie ? '💔 ใจไม่ตรงกัน!' : 'ใจตรงกัน 🟢') : (results.isTie ? 'ต้องดื่ม 🍻' : (results.countA < results.countB ? 'ต้องดื่ม 🍻' : 'ปลอดภัย 🟢'))}
                  </span>
                </div>
                <div className="flex flex-wrap gap-xs">
                  {results.votesA?.length === 0 ? (
                    <span className="text-xs text-muted-color py-xs">ไม่มีผู้โหวตตัวเลือกนี้</span>
                  ) : (
                    results.votesA.map((v) => (
                      <div key={v.userId} className="flex items-center gap-xs p-xs rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.03)' }}>
                        <div className="avatar-circle sm" style={{ width: '22px', height: '22px', fontSize: '0.8rem', borderWidth: '1px' }}>
                          {getAvatarEmoji(v.avatar)}
                        </div>
                        <span className="font-medium">{v.username}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Voters Option B */}
              <div className="glass-card no-hover compact" style={{ borderColor: results.isTie ? 'rgba(255, 45, 120, 0.3)' : (results.countB < results.countA ? 'rgba(124, 255, 45, 0.4)' : 'rgba(255,255,255,0.05)'), background: 'rgba(255,255,255,0.01)' }}>
                <div className="flex items-center justify-between mb-sm border-b pb-xs" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <h4 className="font-bold text-sm" style={{ color: results.isTie ? 'white' : (results.countB < results.countA ? 'var(--neon-pink)' : 'var(--neon-green)') }}>
                    🗳️ ฝ่าย B ({currentQuestion?.optionB})
                  </h4>
                  <span 
                    style={{ 
                      padding: '2px 8px', 
                      fontSize: '0.7rem', 
                      borderRadius: '8px', 
                      fontWeight: 'bold', 
                      background: results.isTie ? 'var(--gradient-danger)' : (results.countB < results.countA ? 'var(--gradient-danger)' : 'var(--gradient-success)'),
                      color: (results.countB >= results.countA && !results.isTie) ? '#0a0015' : 'white',
                      boxShadow: (results.countB >= results.countA && !results.isTie) ? '0 0 10px rgba(124, 255, 45, 0.15)' : '0 0 10px rgba(255, 59, 59, 0.15)'
                    }}
                  >
                    {results.isMindMatch ? (results.isTie ? '💔 ใจไม่ตรงกัน!' : 'ใจตรงกัน 🟢') : (results.isTie ? 'ต้องดื่ม 🍻' : (results.countB < results.countA ? 'ต้องดื่ม 🍻' : 'ปลอดภัย 🟢'))}
                  </span>
                </div>
                <div className="flex flex-wrap gap-xs">
                  {results.votesB?.length === 0 ? (
                    <span className="text-xs text-muted-color py-xs">ไม่มีผู้โหวตตัวเลือกนี้</span>
                  ) : (
                    results.votesB.map((v) => (
                      <div key={v.userId} className="flex items-center gap-xs p-xs rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.03)' }}>
                        <div className="avatar-circle sm" style={{ width: '22px', height: '22px', fontSize: '0.8rem', borderWidth: '1px' }}>
                          {getAvatarEmoji(v.avatar)}
                        </div>
                        <span className="font-medium">{v.username}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {isHost && (
            <button className="btn btn-primary btn-block" onClick={handleNextQuestion}>
              ➡️ โหวตรอบถัดไป
            </button>
          )}
          <button className="btn btn-secondary btn-block mt-md" onClick={handleBackToRoom}>
            🚪 กลับห้อง
          </button>
        </div>
      )}

      {/* Game Result Overlay */}
      {showResult && (
        <GameResult
          emoji={losers.length === 0 ? '🎉' : '🍻'}
          title={
            results?.isMindMatch 
              ? (losers.length === 0 ? 'รอดทั้งคู่! 🎉' : 'ดื่มทั้งคู่! 🍻')
              : (results?.isTie ? 'เสมอ! ทุกคนดื่ม! 🍻' : 'ฝ่ายข้างน้อยดื่ม!')
          }
          losers={losers}
          onDismiss={() => setShowResult(false)}
        />
      )}

      {/* Countdown Overlay */}
      {countdown !== null && countdown > 0 && (
        <div className="countdown-overlay animate-fade-in">
          <div key={countdown} className="countdown-number">
            {countdown}
          </div>
        </div>
      )}
    </div>
  );
}
