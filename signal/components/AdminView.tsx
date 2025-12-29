
import React, { useState } from 'react';
import { RoomConfig, GameState, User, UserRole } from '../types';
import TraineeView from './TraineeView';

interface Props {
  roomConfig: RoomConfig | null;
  gameState: GameState;
  participants: User[];
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}

const AdminView: React.FC<Props> = ({
  roomConfig,
  gameState,
  participants,
  onStart,
  onStop,
  onReset
}) => {
  const [inspectingTeam, setInspectingTeam] = useState<string | null>(null);

  const closeInspector = () => setInspectingTeam(null);

  const traineeParticipants = participants.filter(p => p.role === UserRole.TRAINEE);

  // 안전하게 scores 가져오기
  const scores = gameState?.scores || {};
  const currentHeroId = gameState?.currentHeroId || {};
  const heroAnswer = gameState?.heroAnswer || {};
  const roundCount = gameState?.roundCount || {};

  const getMockUserForTeam = (teamName: string) => {
    const heroId = currentHeroId[teamName];
    const hero = participants.find(p => p.id === heroId);
    if (hero) return hero;
    const member = participants.find(p => p.team === teamName);
    if (member) return member;
    return { id: 'mock', name: 'ADMIN-VIEW', team: teamName, role: UserRole.TRAINEE, score: 0 } as User;
  };

  if (!roomConfig) {
    return (
      <div className="brutal-card p-12 text-center font-black">
        <div className="animate-pulse">CREATING ROOM...</div>
      </div>
    );
  }

  const teamNames = Object.keys(scores);

  return (
    <div className="w-full max-w-6xl space-y-10">
      {/* Header Dashboard Info */}
      <div className="flex flex-col md:flex-row justify-between items-stretch gap-6">
        <div className="brutal-card px-10 py-6 flex-1 bg-yellow-300">
          <h1 className="text-4xl font-black border-b-2 border-black mb-2 uppercase tracking-tight">{roomConfig.roomName}</h1>
          <div className="flex items-center gap-4 flex-wrap">
            <span className={`brutal-badge ${gameState?.isStarted ? 'bg-emerald-400' : 'bg-black text-white'}`}>
              {gameState?.isStarted ? '● LIVE' : gameState?.isFinished ? '■ ENDED' : '○ READY'}
            </span>
            <p className="text-lg font-black">접속: {traineeParticipants.length}명</p>
          </div>
        </div>

        <div className="flex gap-4">
          {!gameState?.isStarted && !gameState?.isFinished ? (
            <button
              onClick={onStart}
              disabled={traineeParticipants.length === 0}
              className={`px-10 py-4 brutal-button uppercase ${
                traineeParticipants.length === 0 ? 'bg-slate-300 cursor-not-allowed' : 'brutal-button-success'
              }`}
            >
              게임 시작
            </button>
          ) : (
            <button
              onClick={onStop}
              className="px-10 py-4 brutal-button brutal-button-danger uppercase"
            >
              종료
            </button>
          )}
          <button
            onClick={() => {
              if (confirm('방을 초기화하시겠습니까? 모든 참가자가 나가게 됩니다.')) {
                onReset();
              }
            }}
            className="px-6 py-4 brutal-button brutal-button-secondary uppercase"
          >
            초기화
          </button>
        </div>
      </div>

      {/* 참가자 목록 */}
      <div className="brutal-card p-8">
        <h3 className="text-2xl font-black mb-6 border-b-4 border-black pb-2 uppercase">
          참가자 ({traineeParticipants.length}명)
        </h3>
        {traineeParticipants.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            <p className="text-xl font-bold">아직 참가자가 없습니다.</p>
            <p className="mt-2">참가자들이 접속하면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {traineeParticipants.map(p => (
              <div key={p.id} className="brutal-inset p-4 bg-white">
                <p className="font-black text-lg">{p.name}</p>
                <p className="text-sm text-indigo-600 font-bold">{p.team}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Cards Grid */}
      {teamNames.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {teamNames.map((team) => {
            const score = scores[team] || 0;
            const teamMembers = traineeParticipants.filter(p => p.team === team);
            return (
              <button
                key={team}
                onClick={() => setInspectingTeam(team)}
                className="brutal-card p-8 flex flex-col items-center justify-center space-y-4 hover:bg-black hover:text-white group cursor-pointer"
              >
                <span className="text-xl font-black uppercase tracking-widest">{team}</span>
                <div className="bg-indigo-500 text-white w-full py-4 border-4 border-black group-hover:bg-white group-hover:text-black transition-colors">
                  <span className="text-5xl font-black">{score}</span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="font-black">Round: {roundCount[team] || 0}</span>
                  <span className="font-bold text-slate-500">({teamMembers.length}명)</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Real-time Status Table */}
      {teamNames.length > 0 && (
        <div className="brutal-card p-10">
          <h3 className="text-2xl font-black mb-8 border-b-4 border-black pb-2 uppercase italic">실시간 현황</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-black text-white border-b-4 border-black">
                  <th className="px-6 py-4 font-black uppercase text-sm">팀</th>
                  <th className="px-6 py-4 font-black uppercase text-sm">인원</th>
                  <th className="px-6 py-4 font-black uppercase text-sm">현재 주인공</th>
                  <th className="px-6 py-4 font-black uppercase text-sm">선택</th>
                  <th className="px-6 py-4 font-black uppercase text-sm">점수</th>
                </tr>
              </thead>
              <tbody className="divide-y-4 divide-black">
                {teamNames.map((team) => {
                  const score = scores[team] || 0;
                  const heroId = currentHeroId[team];
                  const hero = participants.find(p => p.id === heroId);
                  const answer = heroAnswer[team];
                  const teamMembers = traineeParticipants.filter(p => p.team === team);
                  return (
                    <tr
                      key={team}
                      className="cursor-pointer hover:bg-yellow-100 transition-colors"
                      onClick={() => setInspectingTeam(team)}
                    >
                      <td className="px-6 py-6 font-black text-indigo-600 text-xl italic">{team}</td>
                      <td className="px-6 py-6 font-bold">{teamMembers.length}명</td>
                      <td className="px-6 py-6 font-bold">{hero?.name || '---'}</td>
                      <td className="px-6 py-6">
                        {answer ? (
                          <div className={`brutal-badge inline-block ${answer === 'O' ? 'bg-emerald-400' : 'bg-rose-400'}`}>
                            {answer}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-bold animate-pulse">생각중...</span>
                        )}
                      </td>
                      <td className="px-6 py-6 font-black text-3xl">{score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspector Modal */}
      {inspectingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/80 backdrop-blur-md">
          <div className="brutal-card w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-100 flex flex-col p-4">
            <div className="flex justify-between items-center mb-6 px-4 bg-indigo-500 border-4 border-black p-4 text-white">
              <h2 className="text-2xl font-black uppercase tracking-tighter">{inspectingTeam} 모니터링</h2>
              <button
                onClick={closeInspector}
                className="w-12 h-12 flex items-center justify-center brutal-button brutal-button-secondary text-black"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pointer-events-none opacity-90 scale-90 origin-top">
              <TraineeView
                user={getMockUserForTeam(inspectingTeam)}
                roomConfig={roomConfig}
                gameState={gameState}
                participants={participants}
                onHeroAction={() => {}}
                onNextRound={() => {}}
                onPass={() => {}}
                isReadOnly={true}
              />
            </div>
            <div className="mt-6 bg-black text-white p-2 text-center text-[10px] font-black uppercase tracking-[0.3em]">
              관리자 모니터링 모드
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
