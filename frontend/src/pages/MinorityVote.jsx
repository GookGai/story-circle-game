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
  
  const [isSetter, setIsSetter] = useState(false);
  const [setterInfo, setSetterInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [isHost, setIsHost] = useState(false);

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
      setPhase(PHASES.REVEAL);
      setResults({
        percentA: data.countA + data.countB > 0 ? Math.round((data.countA / (data.countA + data.countB)) * 100) : 0,
        percentB: data.countA + data.countB > 0 ? Math.round((data.countB / (data.countA + data.countB)) * 100) : 0,
        countA: data.countA,
        countB: data.countB,
        isTie: data.isTie,
      });
      setLosers(data.drinkers || []);
      
      // Update drink count if I am in the losers
      const myLoss = (data.drinkers || []).find(l => l.userId === user?.id);
      if (myLoss) {
        setDrinkCount(prev => prev + 1);
      }
      
      setShowResult(true);
    }, [user])
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
    navigate(`/room/${code}`);
  }

  return (
    <div className="page-container">
      <div className="flex justify-between items-center mb-lg animate-slide-up">
        <h1 className="page-title mb-0">🗳️ โหวตข้างน้อย</h1>
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
                ✍️ ตั้งตัวเลือกคำตอบ
              </h3>

              <div className="input-group">
                <label>ตัวเลือก A</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="ตัวเลือกแรก (เช่น เบียร์)"
                  value={optionA}
                  onChange={(e) => setOptionA(e.target.value)}
                  autoFocus
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
                />
              </div>

              <button
                className="btn btn-primary btn-block mt-md"
                onClick={handleSubmitQuestion}
                disabled={
                  !optionA.trim() || !optionB.trim() || submitting
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

      {/* Voting Phase */}
      {phase === PHASES.VOTING && currentQuestion && (
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
      {phase === PHASES.REVEAL && results && !showResult && (
        <div className="animate-slide-up">
          <h2 className="text-xl font-bold text-center mb-lg">📊 ผลโหวต</h2>

          <div className="glass-card no-hover mb-lg">
            <p className="text-lg font-semibold text-center mb-lg">
              {currentQuestion?.question}
            </p>

            <div className="vote-reveal">
              <div className="vote-bar mb-md">
                <div
                  className="vote-bar-fill a"
                  style={{ width: `${results.percentA || 0}%` }}
                >
                  A: {results.countA} ({results.percentA}%)
                </div>
              </div>
              <div className="vote-bar">
                <div
                  className="vote-bar-fill b"
                  style={{ width: `${results.percentB || 0}%` }}
                >
                  B: {results.countB} ({results.percentB}%)
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
          emoji={losers.length === 0 ? '🎉' : '🍺'}
          title={
            results?.isTie
              ? 'เสมอ! ทุกคนดื่ม! 🍻'
              : 'ฝ่ายข้างน้อยดื่ม!'
          }
          losers={losers}
          onDismiss={() => setShowResult(false)}
        />
      )}
    </div>
  );
}
