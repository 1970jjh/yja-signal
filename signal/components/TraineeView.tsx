
import React, { useState, useEffect } from 'react';
import { User, RoomConfig, GameState } from '../types';

interface Props {
  user: User;
  roomConfig: RoomConfig | null;
  gameState: GameState;
  participants: User[];
  onHeroAction: (answer: 'O' | 'X') => void;
  onTeamSync: (newState: GameState) => void;
  isReadOnly?: boolean;
}

const TraineeView: React.FC<Props> = ({ user, roomConfig, gameState, participants, onHeroAction, onTeamSync, isReadOnly = false }) => {
  const [passCount, setPassCount] = useState(3);
  const [userGuess, setUserGuess] = useState<'O' | 'X' | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const isHero = gameState.currentHeroId[user.team] === user.id;
  const currentQuestionIdx = gameState.questionIndices[user.team] || 0;
  const currentQuestion = roomConfig?.questions[currentQuestionIdx];
  const heroAnswer = gameState.heroAnswer[user.team];

  useEffect(() => {
    if (gameState.isStarted && roomConfig) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - (Number(gameState.startTime) || Date.now())) / 1000);
        const total = Number(roomConfig.durationMinutes) * 60;
        setTimeLeft(Math.max(0, total - elapsed));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState.isStarted, gameState.startTime, roomConfig]);

  useEffect(() => {
    if (isHero && heroAnswer && !showResult && !isReadOnly) {
      setCountdown(5);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleNextRound();
            if (navigator.vibrate) navigator.vibrate(200);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isHero, heroAnswer, showResult, isReadOnly]);

  const handleNextRound = () => {
    if (!roomConfig || isReadOnly) return;
    const teamParticipants = participants.filter(p => p.team === user.team);
    const currentHeroIdx = teamParticipants.findIndex(p => p.id === user.id);
    const nextHeroIdx = (currentHeroIdx + 1) % teamParticipants.length;
    const nextHeroId = teamParticipants[nextHeroIdx].id;
    const nextQIdx = Math.floor(Math.random() * roomConfig.questions.length);

    const newState = {
      ...gameState,
      scores: { ...gameState.scores, [user.team]: (Number(gameState.scores[user.team]) || 0) + 100 },
      currentHeroId: { ...gameState.currentHeroId, [user.team]: nextHeroId },
      heroAnswer: { ...gameState.heroAnswer, [user.team]: null },
      questionIndices: { ...gameState.questionIndices, [user.team]: nextQIdx },
      roundCount: { ...gameState.roundCount, [user.team]: (Number(gameState.roundCount[user.team]) || 0) + 1 }
    };
    onTeamSync(newState);
    setUserGuess(null);
  };

  const handlePass = () => {
    if (passCount > 0 && roomConfig && !isReadOnly) {
      setPassCount(prev => prev - 1);
      const nextQIdx = Math.floor(Math.random() * roomConfig.questions.length);
      onTeamSync({
        ...gameState,
        questionIndices: { ...gameState.questionIndices, [user.team]: nextQIdx }
      });
    }
  };

  const handleGuess = (guess: 'O' | 'X') => {
    if (isReadOnly) return;
    setUserGuess(guess);
    if (guess === heroAnswer) {
      if (navigator.vibrate) navigator.vibrate(100);
    }
  };

  if (!roomConfig) return <div className="brutal-card p-12 text-center font-black">SYNCING SIGNAL DATA...</div>;

  if (gameState.isFinished) {
    const sortedTeams = Object.entries(gameState.scores).sort((a, b) => Number(b[1]) - Number(a[1]));
    const teamIndex = sortedTeams.findIndex(t => t[0] === user.team);
    const rank = (teamIndex === -1 ? 0 : teamIndex) + 1;
    
    return (
      <div className="brutal-card p-12 w-full max-w-md text-center bg-yellow-300">
        <h2 className="text-5xl font-black mb-4 uppercase italic">OVER!</h2>
        <div className="space-y-6 mb-10">
          <div className="brutal-inset p-8 bg-white border-4">
            <p className="text-xl font-black uppercase">TEAM RANK</p>
            <p className="text-8xl font-black text-indigo-600">{rank}#</p>
          </div>
          <div className="brutal-inset p-8 bg-white border-4">
            <p className="text-xl font-black uppercase">SCORE</p>
            <p className="text-6xl font-black text-emerald-600">{gameState.scores[user.team]}</p>
          </div>
        </div>
        {!isReadOnly && (
          <button onClick={() => window.location.reload()} className="w-full py-5 brutal-button brutal-button-primary text-xl uppercase">
            REBOOT SIGNAL
          </button>
        )}
      </div>
    );
  }

  if (!gameState.isStarted) {
    return (
      <div className="brutal-card p-16 w-full max-w-md text-center bg-indigo-500">
        <div className="w-24 h-24 bg-white border-4 border-black flex items-center justify-center mx-auto mb-10 shadow-[8px_8px_0px_#000]">
          <span className="text-5xl animate-pulse">📡</span>
        </div>
        <h2 className="text-4xl font-black text-white mb-4 uppercase">READY?</h2>
        <p className="text-white/90 font-bold mb-10 italic">Waiting for Command Center to start signal...</p>
        <div className="bg-black text-white p-6 border-2 border-white">
          <p className="text-xs font-black uppercase tracking-widest opacity-70 mb-2">My Profile</p>
          <p className="text-2xl font-black">{user.team} // {user.name}</p>
        </div>
      </div>
    );
  }

  const minutes = Math.floor(Number(timeLeft) / 60);
  const seconds = Number(timeLeft) % 60;

  return (
    <div className={`w-full max-w-xl space-y-8 ${isReadOnly ? 'scale-90 pointer-events-none' : ''}`}>
      {/* Header Info */}
      <div className="flex justify-between items-stretch gap-6">
        <div className="brutal-card px-8 py-4 flex-1 bg-white">
          <p className="text-xs font-black uppercase italic mb-1">Time Left</p>
          <p className={`text-4xl font-black ${timeLeft < 30 ? 'text-rose-500 animate-pulse' : 'text-black'}`}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </p>
        </div>
        <div className="brutal-card px-8 py-4 bg-indigo-500 text-white">
          <p className="text-xs font-black uppercase italic mb-1">Points</p>
          <p className="text-4xl font-black">{gameState.scores[user.team] || 0}</p>
        </div>
      </div>

      {/* Main Game Interface */}
      <div className="brutal-card p-10 min-h-[500px] flex flex-col items-center justify-between relative bg-white">
        {countdown > 0 && (
          <div className="absolute inset-0 bg-yellow-400 z-20 flex flex-col items-center justify-center border-4 border-black p-4">
             <p className="text-3xl font-black text-black uppercase mb-6 italic">Next Signal Starting...</p>
             <div className="w-24 h-24 bg-black text-white flex items-center justify-center text-6xl font-black shadow-[8px_8px_0px_#fff]">
               {countdown}
             </div>
          </div>
        )}

        <div className="w-full text-center">
          <div className={`inline-block border-2 border-black px-4 py-1 text-xs font-black mb-6 uppercase tracking-widest ${isHero ? 'bg-indigo-500 text-white' : 'bg-yellow-300 text-black'}`}>
            {isHero ? 'You are the Hero' : `HERO: ${participants.find(p => p.id === gameState.currentHeroId[user.team])?.name}`}
          </div>
          
          <div className="brutal-inset p-10 bg-slate-50 border-4 min-h-[220px] flex items-center justify-center mb-10 relative">
            <h2 className="text-3xl font-black text-black leading-tight uppercase">
              "{currentQuestion || "LOADING SIGNAL..."}"
            </h2>
            <div className="absolute -top-4 -right-4 bg-black text-white px-3 py-1 text-xs font-black">?</div>
          </div>
        </div>

        <div className="w-full space-y-8">
          {isHero ? (
            <>
              {!heroAnswer ? (
                <div className="grid grid-cols-2 gap-6">
                  <button
                    onClick={() => onHeroAction('O')}
                    className="py-12 brutal-button brutal-button-success text-7xl font-black"
                  >
                    O
                  </button>
                  <button
                    onClick={() => onHeroAction('X')}
                    className="py-12 brutal-button brutal-button-danger text-7xl font-black"
                  >
                    X
                  </button>
                </div>
              ) : (
                <div className="bg-black text-white p-8 border-4 border-black text-center shadow-[8px_8px_0px_#4f46e5]">
                  <p className="text-2xl font-black uppercase mb-1">Choice Locked: {heroAnswer}</p>
                  <p className="text-xs font-bold opacity-60 italic">Wait for your team to decode your heart signal!</p>
                </div>
              )}
              
              <div className="flex justify-center">
                <button
                  disabled={passCount === 0 || !!heroAnswer}
                  onClick={handlePass}
                  className={`px-8 py-3 brutal-button text-sm flex items-center gap-4 ${passCount > 0 && !heroAnswer ? 'bg-yellow-300' : 'bg-slate-300 opacity-50 cursor-not-allowed'}`}
                >
                  <span className="bg-black text-white px-2 py-0.5">SKIP</span>
                  <span className="font-black">REMAINING: {passCount}</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {heroAnswer ? (
                <div className="space-y-6">
                   <p className="text-center font-black uppercase text-indigo-600 tracking-tighter text-xl">What is Hero's Choice?</p>
                   <div className="grid grid-cols-2 gap-6">
                    <button
                      onClick={() => handleGuess('O')}
                      disabled={!!userGuess}
                      className={`py-12 brutal-button text-7xl font-black transition-all ${
                        userGuess === 'O' 
                          ? (userGuess === heroAnswer ? 'bg-emerald-400' : 'bg-slate-300') 
                          : 'bg-white text-black'
                      }`}
                    >
                      O
                    </button>
                    <button
                      onClick={() => handleGuess('X')}
                      disabled={!!userGuess}
                      className={`py-12 brutal-button text-7xl font-black transition-all ${
                        userGuess === 'X' 
                          ? (userGuess === heroAnswer ? 'bg-emerald-400' : 'bg-slate-300') 
                          : 'bg-white text-black'
                      }`}
                    >
                      X
                    </button>
                  </div>
                  {userGuess && (
                    <div className={`p-4 border-4 border-black text-center font-black uppercase text-xl ${userGuess === heroAnswer ? 'bg-emerald-400' : 'bg-rose-400'}`}>
                      {userGuess === heroAnswer ? '✓ SIGNAL MATCH (+100)' : '✗ SIGNAL MISMATCH'}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 brutal-inset bg-black text-white">
                   <p className="font-black text-xl uppercase italic tracking-widest animate-pulse">Waiting for Hero Signal...</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TraineeView;
