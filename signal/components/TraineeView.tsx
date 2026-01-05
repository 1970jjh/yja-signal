
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, RoomConfig, GameState } from '../types';

// 축하 사운드 재생 함수
const playCelebrationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    // 빠밤 사운드 - 두 개의 상승하는 음
    const playNote = (frequency: number, startTime: number, duration: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = audioContext.currentTime;
    // 빠 (낮은 음)
    playNote(523.25, now, 0.2);  // C5
    // 밤 (높은 음)
    playNote(783.99, now + 0.2, 0.4);  // G5
  } catch (e) {
    console.log('Audio not supported');
  }
};

interface Props {
  user: User;
  roomConfig: RoomConfig | null;
  gameState: GameState;
  participants: User[];
  onHeroAction: (answer: 'O' | 'X') => void;
  onMemberAnswer: (odUserId: string, team: string, answer: 'O' | 'X') => void;
  onChangeQuestion: (team: string, direction: 'next' | 'prev' | number) => void;
  onRevealResult: (team: string) => void;
  onNextRound: (team: string) => void;
  onLeaveRoom: () => void;
  onSwitchToAdmin: () => void;
}

const TraineeView: React.FC<Props> = ({
  user,
  roomConfig,
  gameState,
  participants,
  onHeroAction,
  onMemberAnswer,
  onChangeQuestion,
  onRevealResult,
  onNextRound,
  onLeaveRoom,
  onSwitchToAdmin
}) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const celebrationPlayedRef = useRef(false);

  // 안전하게 gameState 접근
  const currentHeroId = gameState?.currentHeroId || {};
  const heroAnswerMap = gameState?.heroAnswer || {};
  const questionHistory = gameState?.questionHistory || {};
  const currentQuestionIndex = gameState?.currentQuestionIndex || {};
  const heroHistory = gameState?.heroHistory || {};
  const individualScores = gameState?.individualScores || {};
  const memberAnswers = gameState?.memberAnswers || {};
  const resultRevealed = gameState?.resultRevealed || {};
  const resultRevealedAt = gameState?.resultRevealedAt || {};

  const teamMembers = participants.filter(p => p.team === user.team);
  const isHero = currentHeroId[user.team] === user.id;
  const heroAnswer = heroAnswerMap[user.team];
  const teamHeroHistory = heroHistory[user.team] || [];

  // 현재 질문 가져오기
  const teamQuestionHistory = questionHistory[user.team] || [];
  const questionIdx = currentQuestionIndex[user.team] || 0;
  const actualQuestionIndex = teamQuestionHistory[questionIdx];
  const currentQuestion = roomConfig?.questions?.[actualQuestionIndex];

  // 내 답변 확인
  const myAnswer = memberAnswers[user.team]?.[user.id];

  // 타이머
  useEffect(() => {
    if (gameState?.isStarted && roomConfig) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - (Number(gameState.startTime) || Date.now())) / 1000);
        const total = Number(roomConfig.durationMinutes) * 60;
        setTimeLeft(Math.max(0, total - elapsed));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState?.isStarted, gameState?.startTime, roomConfig]);

  // 주인공 답변이 바뀌면 초기화
  useEffect(() => {
    if (!heroAnswer) {
      setHasAnswered(false);
      setCountdownLeft(null);
    }
  }, [heroAnswer]);

  // 결과 공개 후 10초 카운트다운
  const isResultRevealed = resultRevealed[user.team] || false;
  const revealedAt = resultRevealedAt[user.team];

  useEffect(() => {
    if (isResultRevealed && revealedAt) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - revealedAt) / 1000);
        const remaining = Math.max(0, 10 - elapsed);
        setCountdownLeft(remaining);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setCountdownLeft(null);
    }
  }, [isResultRevealed, revealedAt]);

  // 주인공으로 선택되었을 때 진동
  useEffect(() => {
    if (isHero && gameState?.isStarted) {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]); // 진동 패턴
    }
  }, [isHero, gameState?.isStarted]);

  // 정답 맞췄을 때 진동
  useEffect(() => {
    if (isResultRevealed && myAnswer && heroAnswer && myAnswer === heroAnswer) {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]); // 정답 축하 진동
    }
  }, [isResultRevealed, myAnswer, heroAnswer]);

  // 게임 종료 시 축하 사운드 및 컨페티
  useEffect(() => {
    if (gameState?.isFinished && !celebrationPlayedRef.current) {
      celebrationPlayedRef.current = true;
      playCelebrationSound();
      setShowConfetti(true);
      // 5초 후 컨페티 숨기기
      setTimeout(() => setShowConfetti(false), 5000);
    }
  }, [gameState?.isFinished]);

  // 팀원 점수 계산 및 정렬
  const getTeamScores = () => {
    return teamMembers
      .map(m => ({
        ...m,
        score: individualScores[m.id] || 0
      }))
      .sort((a, b) => b.score - a.score);
  };

  // 팀 전체 점수
  const teamTotalScore = teamMembers.reduce((sum, m) => sum + (individualScores[m.id] || 0), 0);

  // 답변 제출
  const handleAnswer = (answer: 'O' | 'X') => {
    if (hasAnswered) return;
    setHasAnswered(true);
    onMemberAnswer(user.id, user.team, answer);
    if (navigator.vibrate) navigator.vibrate(100);
  };

  // 다음 라운드
  const handleNextRound = () => {
    onNextRound(user.team);
  };

  if (!roomConfig) {
    return (
      <div className="brutal-card p-12 text-center font-black">
        <div className="animate-pulse">데이터 동기화 중...</div>
      </div>
    );
  }

  // 게임 종료 화면
  if (gameState?.isFinished) {
    const sortedScores = getTeamScores();
    const myRank = sortedScores.findIndex(s => s.id === user.id) + 1;
    const isFirstPlace = myRank === 1;

    return (
      <div className={`brutal-card p-8 w-full max-w-md text-center relative overflow-hidden ${isFirstPlace ? 'bg-gradient-to-b from-yellow-300 via-yellow-400 to-orange-400' : 'bg-yellow-300'}`}>
        {/* 컨페티 효과 */}
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute animate-bounce"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random() * 2}s`,
                  fontSize: `${12 + Math.random() * 16}px`
                }}
              >
                {['🎉', '🎊', '⭐', '✨', '🏆', '💫'][Math.floor(Math.random() * 6)]}
              </div>
            ))}
          </div>
        )}

        {/* 1위 축하 헤더 */}
        {isFirstPlace ? (
          <div className="mb-6">
            <div className="text-6xl mb-2">🏆</div>
            <h2 className="text-4xl font-black text-white drop-shadow-lg" style={{ textShadow: '2px 2px 0 #000' }}>
              축하합니다!
            </h2>
            <p className="text-xl font-black mt-2" style={{ textShadow: '1px 1px 0 #000', color: 'white' }}>
              🥇 팀 내 1위! 🥇
            </p>
          </div>
        ) : (
          <h2 className="text-4xl font-black mb-6">게임 종료!</h2>
        )}

        <div className={`brutal-inset p-6 border-4 mb-6 ${isFirstPlace ? 'bg-yellow-100 border-yellow-600' : 'bg-white'}`}>
          <p className="text-lg font-black mb-2">나의 순위</p>
          <p className={`text-6xl font-black ${isFirstPlace ? 'text-yellow-600' : 'text-indigo-600'}`}>
            {isFirstPlace ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : ''} {myRank}등
          </p>
          <p className="text-2xl font-bold mt-2">{individualScores[user.id] || 0}점</p>
        </div>

        <div className="brutal-inset p-4 bg-white border-4 mb-6">
          <p className="text-sm font-black mb-3">🏅 우리 팀 최종 순위</p>
          <div className="space-y-2">
            {sortedScores.map((member, idx) => (
              <div
                key={member.id}
                className={`flex justify-between items-center p-2 rounded ${
                  member.id === user.id
                    ? 'bg-indigo-100 border-2 border-indigo-500'
                    : idx === 0
                      ? 'bg-yellow-100 border-2 border-yellow-500'
                      : ''
                }`}
              >
                <span className="font-bold">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`} {member.name}
                </span>
                <span className="font-black">{member.score}점</span>
              </div>
            ))}
          </div>
        </div>

        <div className="brutal-inset p-4 bg-indigo-500 text-white border-4 border-black">
          <p className="text-sm font-bold">팀 총점</p>
          <p className="text-3xl font-black">{teamTotalScore}점</p>
        </div>

        {/* 하단 버튼 */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <button
            onClick={() => {
              if (confirm('방을 나가시겠습니까?')) {
                onLeaveRoom();
              }
            }}
            className="py-3 brutal-button bg-gray-200 hover:bg-gray-300 font-bold text-sm border-4 border-black"
          >
            나가기
          </button>
          <button
            onClick={() => setShowAdminModal(true)}
            className="py-3 brutal-button bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm border-4 border-black"
          >
            대시보드
          </button>
        </div>

        {/* 관리자 비밀번호 모달 */}
        {showAdminModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="brutal-card p-6 bg-white max-w-sm w-full mx-4">
              <h3 className="text-xl font-black mb-4">관리자 비밀번호</h3>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="비밀번호 입력"
                className="w-full p-3 border-4 border-black mb-2 font-bold"
              />
              {passwordError && (
                <p className="text-red-500 text-sm font-bold mb-2">{passwordError}</p>
              )}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    setShowAdminModal(false);
                    setAdminPassword('');
                    setPasswordError('');
                  }}
                  className="flex-1 py-2 brutal-button bg-gray-200 font-bold"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    if (adminPassword === '6749467') {
                      setShowAdminModal(false);
                      setAdminPassword('');
                      setPasswordError('');
                      onSwitchToAdmin();
                    } else {
                      setPasswordError('비밀번호가 틀렸습니다');
                    }
                  }}
                  className="flex-1 py-2 brutal-button brutal-button-primary font-bold"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 대기 화면
  if (!gameState?.isStarted) {
    return (
      <div className="brutal-card p-12 w-full max-w-md text-center bg-indigo-500 relative">
        <button
          onClick={() => {
            if (confirm('방을 나가시겠습니까?')) {
              onLeaveRoom();
            }
          }}
          className="absolute top-4 left-4 brutal-button px-4 py-2 bg-white text-black text-sm font-bold"
        >
          ← 뒤로가기
        </button>
        <div className="w-20 h-20 bg-white border-4 border-black flex items-center justify-center mx-auto mb-8">
          <span className="text-4xl animate-pulse">📡</span>
        </div>
        <h2 className="text-3xl font-black text-white mb-4">대기 중</h2>
        <p className="text-white/90 font-bold mb-8">관리자가 게임을 시작하면 시작됩니다</p>
        <div className="bg-black text-white p-4 border-2 border-white">
          <p className="text-xs font-bold opacity-70 mb-1">내 정보</p>
          <p className="text-xl font-black">{user.team} / {user.name}</p>
        </div>
        <div className="mt-4 bg-white/20 p-3">
          <p className="text-white/80 text-sm">
            팀원 {teamMembers.length}명 대기 중
          </p>
        </div>
      </div>
    );
  }

  const minutes = Math.floor(Number(timeLeft) / 60);
  const seconds = Number(timeLeft) % 60;

  return (
    <div className="w-full max-w-xl space-y-4">
      {/* 상단 정보 */}
      <div className="flex justify-between items-center gap-4">
        <div className="brutal-card px-4 py-2 bg-white">
          <p className="text-xs font-bold text-gray-500">남은 시간</p>
          <p className={`text-2xl font-black ${timeLeft < 30 ? 'text-rose-500 animate-pulse' : ''}`}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </p>
        </div>
        <div className="brutal-card px-4 py-2 bg-indigo-500 text-white">
          <p className="text-xs font-bold opacity-80">팀 점수</p>
          <p className="text-2xl font-black">{teamTotalScore}점</p>
        </div>
      </div>

      {/* 팀원 목록 - 주인공 표시 */}
      <div className="brutal-card p-4 bg-white">
        <p className="text-xs font-bold text-gray-500 mb-2">우리 팀</p>
        <div className="flex flex-wrap gap-2">
          {teamMembers.map(member => {
            const isCurrentHero = currentHeroId[user.team] === member.id;
            // 주인공 횟수 계산 (heroHistory에서 해당 멤버 ID 카운트)
            const heroCount = teamHeroHistory.filter(id => id === member.id).length;
            return (
              <div
                key={member.id}
                className={`px-3 py-2 border-2 border-black font-bold text-sm flex flex-col items-center gap-1 ${
                  isCurrentHero ? 'bg-yellow-300' : heroCount > 0 ? 'bg-indigo-100' : 'bg-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  {isCurrentHero && '⭐'}
                  <span>{member.name}</span>
                </div>
                {/* 야구 아웃카운트 스타일 - 주인공 횟수 표시 */}
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full border-2 ${
                        i < heroCount
                          ? 'bg-indigo-500 border-indigo-600'
                          : 'bg-gray-200 border-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 메인 게임 카드 */}
      <div className="brutal-card p-6 bg-white min-h-[400px] flex flex-col">
        {/* 주인공 화면 */}
        {isHero ? (
          <>
            {/* 주인공 알림 */}
            <div className="text-center mb-6">
              <div className="inline-block bg-yellow-300 border-4 border-black px-6 py-3 -rotate-1">
                <p className="text-2xl font-black">⭐ 당신이 주인공입니다! ⭐</p>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                당신에 대한 설명이 맞다면 O, 아니라면 X를 선택하세요
              </p>
            </div>

            {/* 질문 - 2배 크기 */}
            <div className="brutal-inset p-6 bg-slate-50 border-4 flex-1 flex items-center justify-center mb-4">
              <h2 className="text-3xl md:text-4xl font-black text-center leading-relaxed">
                {currentQuestion || "질문 로딩 중..."}
              </h2>
            </div>

            {/* 질문 선택 (4개 중 선택) */}
            {!heroAnswer && (
              <div className="mb-4">
                <p className="text-xs font-bold text-gray-500 mb-2">다른 질문 선택 ({questionIdx + 1}/4)</p>
                <div className="flex gap-2">
                  {teamQuestionHistory.map((qIdx, i) => (
                    <button
                      key={i}
                      onClick={() => onChangeQuestion(user.team, i)}
                      className={`flex-1 py-2 brutal-button text-sm font-bold ${
                        i === questionIdx ? 'bg-indigo-500 text-white' : 'bg-white'
                      }`}
                    >
                      {i + 1}번
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* O/X 선택 */}
            {!heroAnswer ? (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => onHeroAction('O')}
                  className="py-10 brutal-button brutal-button-success text-6xl font-black"
                >
                  O
                </button>
                <button
                  onClick={() => onHeroAction('X')}
                  className="py-10 brutal-button brutal-button-danger text-6xl font-black"
                >
                  X
                </button>
              </div>
            ) : !isResultRevealed ? (
              /* 결과 공개 전 - 결과공개 버튼 */
              <div className="space-y-4">
                {/* 나의 선택 */}
                <div className="bg-slate-800 border-4 border-black p-4">
                  <p className="font-black text-lg mb-3 text-center text-white">⭐ 나의 선택</p>
                  <div className="flex justify-between items-center p-2 bg-slate-700 border-2 border-slate-600">
                    <span className="font-bold text-white">주인공 (나)</span>
                    <span className={`font-black text-xl px-3 py-1 border-2 border-black ${
                      heroAnswer === 'O' ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}>
                      {heroAnswer}
                    </span>
                  </div>
                </div>

                {/* 팀원 선택 현황 */}
                <div className="bg-gray-100 border-4 border-black p-4">
                  <p className="font-black text-lg mb-3 text-center">📋 팀원 선택 현황</p>
                  <div className="space-y-2">
                    {teamMembers
                      .filter(member => member.id !== user.id)
                      .map(member => {
                        const memberAnswer = memberAnswers[user.team]?.[member.id];
                        return (
                          <div
                            key={member.id}
                            className={`flex justify-between items-center p-2 border-2 border-black ${
                              memberAnswer ? 'bg-white' : 'bg-gray-200'
                            }`}
                          >
                            <span className="font-bold">{member.name}</span>
                            {memberAnswer ? (
                              <span className={`font-black text-xl px-3 py-1 border-2 border-black ${
                                memberAnswer === 'O' ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}>
                                {memberAnswer}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">대기중...</span>
                            )}
                          </div>
                        );
                      })}
                    {teamMembers.filter(m => m.id !== user.id).length === 0 && (
                      <p className="text-center text-gray-500">팀원이 없습니다</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onRevealResult(user.team)}
                  className="w-full py-4 brutal-button bg-yellow-400 hover:bg-yellow-500 font-black text-lg border-4 border-black"
                >
                  🎉 결과 공개 🎉
                </button>
              </div>
            ) : (
              /* 결과 공개 후 */
              <div className="space-y-4">
                <div className={`p-6 border-4 border-black text-center ${
                  heroAnswer === 'O' ? 'bg-emerald-400' : 'bg-rose-400'
                }`}>
                  <p className="text-3xl font-black">정답: {heroAnswer}</p>
                </div>
                {countdownLeft !== null && countdownLeft > 0 ? (
                  <div className="text-center py-4">
                    <p className="text-lg font-bold text-gray-500">
                      {countdownLeft}초 후 다음으로 넘어갈 수 있습니다
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleNextRound}
                    className="w-full py-4 brutal-button brutal-button-primary font-black text-lg"
                  >
                    다음 주인공으로 →
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          /* 팀원 화면 */
          <>
            {/* 주인공 알림 */}
            <div className="text-center mb-4">
              <div className="inline-block bg-indigo-100 border-2 border-black px-4 py-2">
                <p className="font-black">
                  현재 주인공: {teamMembers.find(m => m.id === currentHeroId[user.team])?.name || '...'}
                </p>
              </div>
            </div>

            {/* 주인공 답변 대기 */}
            {!heroAnswer ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center brutal-inset p-8 bg-slate-100">
                  <p className="text-xl font-black animate-pulse">주인공이 선택 중...</p>
                  <p className="text-sm text-gray-500 mt-2">잠시만 기다려주세요</p>
                </div>
              </div>
            ) : !isResultRevealed ? (
              /* 결과 공개 전 - 추측하기 */
              <>
                {/* 질문 표시 - 2배 크기 */}
                <div className="brutal-inset p-6 bg-slate-50 border-4 flex-1 flex items-center justify-center mb-4">
                  <h2 className="text-3xl md:text-4xl font-black text-center leading-relaxed">
                    {currentQuestion || "질문 로딩 중..."}
                  </h2>
                </div>

                {/* 추측하기 */}
                {!hasAnswered ? (
                  <div className="space-y-3">
                    <p className="text-center font-bold text-indigo-600">
                      주인공이 뭘 골랐을까요?
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => handleAnswer('O')}
                        className="py-10 brutal-button text-6xl font-black bg-emerald-100 hover:bg-emerald-200"
                      >
                        O
                      </button>
                      <button
                        onClick={() => handleAnswer('X')}
                        className="py-10 brutal-button text-6xl font-black bg-rose-100 hover:bg-rose-200"
                      >
                        X
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-black text-white p-6 border-4 border-black text-center">
                      <p className="text-xl font-black">내 선택: {myAnswer}</p>
                      <p className="text-sm opacity-70 mt-1">주인공이 결과를 공개하면 확인됩니다</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* 결과 공개 후 */
              <>
                {/* 질문 표시 - 2배 크기 */}
                <div className="brutal-inset p-6 bg-slate-50 border-4 flex items-center justify-center mb-4">
                  <h2 className="text-3xl md:text-4xl font-black text-center leading-relaxed">
                    {currentQuestion || "질문 로딩 중..."}
                  </h2>
                </div>

                {/* 결과 표시 */}
                <div className="space-y-4">
                  <div className={`p-6 border-4 border-black text-center ${
                    heroAnswer === 'O' ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}>
                    <p className="text-3xl font-black">정답: {heroAnswer}</p>
                  </div>

                  {myAnswer && (
                    <div className={`p-4 border-4 border-black text-center ${
                      myAnswer === heroAnswer ? 'bg-emerald-200' : 'bg-rose-200'
                    }`}>
                      <p className="text-xl font-black">
                        {myAnswer === heroAnswer ? '✓ 정답! +100점' : '✗ 오답'}
                      </p>
                      <p className="text-sm mt-1">
                        내 선택: {myAnswer}
                      </p>
                    </div>
                  )}

                  {countdownLeft !== null && countdownLeft > 0 ? (
                    <div className="text-center py-4">
                      <p className="text-lg font-bold text-gray-500">
                        {countdownLeft}초 후 다음으로 넘어갈 수 있습니다
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={handleNextRound}
                      className="w-full py-4 brutal-button brutal-button-primary font-black text-lg"
                    >
                      다음 주인공으로 →
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* 개인 순위 */}
      <div className="brutal-card p-4 bg-white">
        <p className="text-xs font-bold text-gray-500 mb-2">실시간 순위</p>
        <div className="space-y-1">
          {getTeamScores().map((member, idx) => (
            <div
              key={member.id}
              className={`flex justify-between items-center px-3 py-2 ${
                member.id === user.id ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-slate-50'
              }`}
            >
              <span className="font-bold">
                {idx + 1}등 {member.name} {member.id === user.id && '(나)'}
              </span>
              <span className="font-black text-indigo-600">{member.score}점</span>
            </div>
          ))}
        </div>
      </div>

      {/* 하단 버튼들 */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            if (confirm('방을 나가시겠습니까? 재접속하면 다시 참여할 수 있습니다.')) {
              onLeaveRoom();
            }
          }}
          className="flex-1 py-3 brutal-button bg-slate-200 hover:bg-slate-300 text-sm font-bold"
        >
          나가기
        </button>
        <button
          onClick={() => setShowAdminModal(true)}
          className="flex-1 py-3 brutal-button bg-indigo-100 hover:bg-indigo-200 text-sm font-bold"
        >
          대시보드
        </button>
      </div>

      {/* 관리자 비밀번호 모달 */}
      {showAdminModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => {
            setShowAdminModal(false);
            setAdminPassword('');
            setPasswordError('');
          }}
        >
          <div
            className="brutal-card bg-white p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-black mb-4 border-b-4 border-black pb-2">관리자 인증</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (adminPassword === '6749467') {
                  setShowAdminModal(false);
                  setAdminPassword('');
                  setPasswordError('');
                  onSwitchToAdmin();
                } else {
                  setPasswordError('비밀번호가 올바르지 않습니다.');
                }
              }}
            >
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="관리자 비밀번호"
                className="w-full brutal-input mb-3 text-center font-black"
                autoFocus
              />
              {passwordError && (
                <p className="text-rose-500 text-sm font-bold mb-3">{passwordError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminModal(false);
                    setAdminPassword('');
                    setPasswordError('');
                  }}
                  className="flex-1 py-3 brutal-button bg-slate-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 brutal-button brutal-button-primary"
                >
                  확인
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TraineeView;
