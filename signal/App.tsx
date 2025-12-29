
import React from 'react';
import { UserRole } from './types';
import { useFirebaseRoom } from './hooks/useFirebaseRoom';
import AdminView from './components/AdminView';
import TraineeView from './components/TraineeView';
import WelcomeView from './components/WelcomeView';

const App: React.FC = () => {
  const {
    roomConfig,
    gameState,
    participants,
    currentUser,
    isConnected,
    error,
    roomExists,
    createRoom,
    joinRoom,
    startGame,
    stopGame,
    resetRoom,
    setHeroAnswer,
    nextRound,
    updateGameState
  } = useFirebaseRoom();

  // 관리자 로그인 및 방 생성
  const handleAdminLogin = async (config: Parameters<typeof createRoom>[0]) => {
    try {
      await createRoom(config);
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  // 참가자 로그인
  const handleParticipantLogin = async (name: string, team: string) => {
    await joinRoom({ name, team, role: UserRole.TRAINEE });
  };

  // 히어로 액션
  const handleHeroAction = (answer: 'O' | 'X') => {
    if (currentUser) {
      setHeroAnswer(currentUser.team, answer);
    }
  };

  // 팀 동기화 (다음 라운드)
  const handleTeamSync = (team: string, nextHeroId: string, nextQuestionIdx: number) => {
    nextRound(team, nextHeroId, nextQuestionIdx);
  };

  // 질문 패스
  const handlePass = (team: string, nextQuestionIdx: number) => {
    updateGameState({
      questionIndices: { ...gameState.questionIndices, [team]: nextQuestionIdx }
    });
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
      {/* 연결 상태 표시 */}
      {currentUser && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`brutal-badge ${isConnected ? 'bg-emerald-400' : 'bg-rose-400'} px-4 py-2`}>
            {isConnected ? '● 연결됨' : '○ 연결 중...'}
          </div>
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50">
          <div className="bg-rose-500 text-white p-4 border-4 border-black font-bold">
            {error}
          </div>
        </div>
      )}

      {!currentUser ? (
        <WelcomeView
          roomExists={roomExists}
          roomConfig={roomConfig}
          onAdminLogin={handleAdminLogin}
          onParticipantLogin={handleParticipantLogin}
        />
      ) : currentUser.role === UserRole.ADMIN ? (
        <AdminView
          roomConfig={roomConfig}
          gameState={gameState}
          participants={participants}
          onStart={startGame}
          onStop={stopGame}
          onReset={resetRoom}
        />
      ) : (
        <TraineeView
          user={currentUser}
          roomConfig={roomConfig}
          gameState={gameState}
          participants={participants}
          onHeroAction={handleHeroAction}
          onNextRound={handleTeamSync}
          onPass={handlePass}
        />
      )}
    </div>
  );
};

export default App;
