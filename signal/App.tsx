
import React, { useEffect, useState } from 'react';
import { UserRole } from './types';
import { useFirebaseRoom } from './hooks/useFirebaseRoom';
import AdminView from './components/AdminView';
import TraineeView from './components/TraineeView';
import WelcomeView from './components/WelcomeView';

const App: React.FC = () => {
  const [isRestoring, setIsRestoring] = useState(true);

  const {
    roomConfig,
    gameState,
    participants,
    currentUser,
    isConnected,
    error,
    roomList,
    createRoom,
    joinRoom,
    joinRoomAsAdmin,
    leaveRoom,
    deleteRoom,
    startGame,
    stopGame,
    resetRoom,
    setHeroAnswer,
    submitMemberAnswer,
    changeQuestion,
    revealResult,
    nextRound,
    skipToNextHero,
    switchToAdmin,
    refreshRoomList,
    restoreSession,
    clearSession
  } = useFirebaseRoom();

  // 앱 시작 시 세션 복원 시도
  useEffect(() => {
    const restore = async () => {
      await restoreSession();
      setIsRestoring(false);
    };
    restore();
  }, [restoreSession]);

  // 관리자 - 새 방 생성
  const handleAdminLogin = async (config: Parameters<typeof createRoom>[0]) => {
    try {
      await createRoom(config);
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  // 관리자 - 기존 방 입장
  const handleAdminJoinRoom = async (roomId: string) => {
    await joinRoomAsAdmin(roomId);
  };

  // 참가자 로그인
  const handleParticipantLogin = async (roomId: string, name: string, team: string) => {
    await joinRoom(roomId, { name, team, role: UserRole.TRAINEE });
  };

  // 방 삭제
  const handleDeleteRoom = async (roomId: string) => {
    await deleteRoom(roomId);
  };

  // 주인공 O/X 선택
  const handleHeroAction = (answer: 'O' | 'X') => {
    if (currentUser) {
      setHeroAnswer(currentUser.team, answer);
    }
  };

  // 팀원 답변 제출
  const handleMemberAnswer = (odUserId: string, team: string, answer: 'O' | 'X') => {
    submitMemberAnswer(odUserId, team, answer);
  };

  // 질문 변경
  const handleChangeQuestion = (team: string, direction: 'next' | 'prev' | number) => {
    changeQuestion(team, direction);
  };

  // 결과 공개
  const handleRevealResult = (team: string) => {
    revealResult(team);
  };

  // 다음 라운드
  const handleNextRound = (team: string) => {
    nextRound(team);
  };

  // 순서넘기기 (관리자용)
  const handleSkipHero = (team: string) => {
    skipToNextHero(team);
  };

  // 방 나가기 (참가자용)
  const handleLeaveRoom = () => {
    leaveRoom();
  };

  // 관리자 로그아웃
  const handleAdminLogout = () => {
    clearSession();
    window.location.reload();
  };

  // 세션 복원 중 로딩 화면
  if (isRestoring) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="brutal-card p-12 text-center font-black">
          <div className="animate-pulse">세션 복원 중...</div>
        </div>
      </div>
    );
  }

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
          roomList={roomList}
          onAdminLogin={handleAdminLogin}
          onAdminJoinRoom={handleAdminJoinRoom}
          onParticipantLogin={handleParticipantLogin}
          onDeleteRoom={handleDeleteRoom}
          onRefreshRooms={refreshRoomList}
        />
      ) : currentUser.role === UserRole.ADMIN ? (
        <AdminView
          roomConfig={roomConfig}
          gameState={gameState}
          participants={participants}
          onStart={startGame}
          onStop={stopGame}
          onReset={resetRoom}
          onSkipHero={handleSkipHero}
          onLogout={handleAdminLogout}
        />
      ) : (
        <TraineeView
          user={currentUser}
          roomConfig={roomConfig}
          gameState={gameState}
          participants={participants}
          onHeroAction={handleHeroAction}
          onMemberAnswer={handleMemberAnswer}
          onChangeQuestion={handleChangeQuestion}
          onRevealResult={handleRevealResult}
          onNextRound={handleNextRound}
          onLeaveRoom={handleLeaveRoom}
          onSwitchToAdmin={switchToAdmin}
        />
      )}
    </div>
  );
};

export default App;
