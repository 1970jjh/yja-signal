
import React, { useState } from 'react';
import { RoomConfig, GameState, User, UserRole } from '../types';

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

  const traineeParticipants = participants.filter(p => p.role === UserRole.TRAINEE);

  // 모달 상태
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  // 안전하게 gameState 가져오기
  const currentHeroId = gameState?.currentHeroId || {};
  const heroAnswer = gameState?.heroAnswer || {};
  const individualScores = gameState?.individualScores || {};
  const heroHistory = gameState?.heroHistory || {};
  const roundCount = gameState?.roundCount || {};
  const questionHistory = gameState?.questionHistory || {};
  const currentQuestionIndex = gameState?.currentQuestionIndex || {};

  // 팀별 데이터 계산
  const getTeamData = (teamName: string) => {
    const members = traineeParticipants.filter(p => p.team === teamName);
    const teamScores = members.map(m => ({
      ...m,
      score: individualScores[m.id] || 0
    })).sort((a, b) => b.score - a.score);

    const totalScore = teamScores.reduce((sum, m) => sum + m.score, 0);
    const heroId = currentHeroId[teamName];
    const hero = members.find(m => m.id === heroId);
    const answer = heroAnswer[teamName];
    const rounds = roundCount[teamName] || 0;
    const herosDone = heroHistory[teamName]?.length || 0;

    // 현재 문제 정보
    const teamQuestionHistory = questionHistory[teamName] || [];
    const teamCurrentIndex = currentQuestionIndex[teamName] ?? 0;
    const currentQuestionIdx = teamQuestionHistory[teamCurrentIndex];
    const currentQuestion = roomConfig?.questions?.[currentQuestionIdx] || null;

    return { members, teamScores, totalScore, hero, answer, rounds, herosDone, currentQuestion, teamQuestionHistory, teamCurrentIndex };
  };

  if (!roomConfig) {
    return (
      <div className="brutal-card p-12 text-center font-black">
        <div className="animate-pulse">방 생성 중...</div>
      </div>
    );
  }

  // 팀 목록 생성
  const teamNames = Array.from({ length: roomConfig.teamCount }, (_, i) => `팀 ${i + 1}`);

  // 팀별 총점으로 정렬
  const sortedTeams = [...teamNames].sort((a, b) => {
    const aScore = getTeamData(a).totalScore;
    const bScore = getTeamData(b).totalScore;
    return bScore - aScore;
  });

  return (
    <div className="w-full max-w-6xl space-y-8">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row justify-between items-stretch gap-6">
        <div className="brutal-card px-8 py-6 flex-1 bg-yellow-300">
          <h1 className="text-3xl font-black border-b-2 border-black mb-2">{roomConfig.roomName}</h1>
          <div className="flex items-center gap-4 flex-wrap">
            <span className={`brutal-badge ${gameState?.isStarted ? 'bg-emerald-400' : 'bg-black text-white'}`}>
              {gameState?.isStarted ? '● 진행 중' : gameState?.isFinished ? '■ 종료됨' : '○ 대기'}
            </span>
            <p className="text-lg font-black">접속: {traineeParticipants.length}명</p>
          </div>
        </div>

        <div className="flex gap-4">
          {!gameState?.isStarted && !gameState?.isFinished ? (
            <button
              onClick={onStart}
              disabled={traineeParticipants.length === 0}
              className={`px-8 py-4 brutal-button ${
                traineeParticipants.length === 0 ? 'bg-slate-300 cursor-not-allowed' : 'brutal-button-success'
              }`}
            >
              게임 시작
            </button>
          ) : (
            <button
              onClick={onStop}
              className="px-8 py-4 brutal-button brutal-button-danger"
            >
              게임 종료
            </button>
          )}
          <button
            onClick={() => {
              if (confirm('방을 초기화하시겠습니까?')) {
                onReset();
              }
            }}
            className="px-6 py-4 brutal-button brutal-button-secondary"
          >
            초기화
          </button>
        </div>
      </div>

      {/* 참가자 목록 */}
      <div className="brutal-card p-6">
        <h3 className="text-xl font-black mb-4 border-b-4 border-black pb-2">
          참가자 현황 ({traineeParticipants.length}명)
        </h3>
        {traineeParticipants.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p className="font-bold">아직 참가자가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {traineeParticipants.map(p => (
              <div key={p.id} className="brutal-inset p-2 bg-white text-center">
                <p className="font-black text-sm truncate">{p.name}</p>
                <p className="text-xs text-indigo-600 font-bold">{p.team}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 팀별 순위 및 개인 점수 - 그리드 레이아웃 */}
      <div className="brutal-card p-4">
        <h3 className="text-xl font-black mb-4 border-b-4 border-black pb-2">
          팀별 순위 및 개인 점수
        </h3>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {sortedTeams.map((teamName, teamRank) => {
            const data = getTeamData(teamName);

            return (
              <div key={teamName} className="border-4 border-black bg-white flex flex-col">
                {/* 팀 헤더 - 컴팩트 */}
                <div className={`p-3 border-b-4 border-black ${
                  teamRank === 0 ? 'bg-yellow-300' : teamRank === 1 ? 'bg-slate-200' : teamRank === 2 ? 'bg-orange-200' : 'bg-slate-100'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-black text-lg">{teamRank + 1}위 {teamName}</p>
                      <p className="text-xs text-gray-600">
                        {data.members.length}명 · R{data.rounds}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-2xl text-indigo-600">{data.totalScore}</p>
                      {gameState?.isStarted && data.hero && (
                        <p className="text-xs">⭐{data.hero.name}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 개인 점수 - 컴팩트 리스트 */}
                <div className="p-2 bg-white flex-1 overflow-y-auto max-h-[300px]">
                  {data.teamScores.length === 0 ? (
                    <p className="text-center text-gray-400 py-4 text-sm">팀원 없음</p>
                  ) : (
                    <div className="space-y-1">
                      {data.teamScores.map((member, idx) => {
                        const isCurrentHero = currentHeroId[teamName] === member.id;
                        const wasHero = heroHistory[teamName]?.includes(member.id);

                        return (
                          <div
                            key={member.id}
                            className={`flex justify-between items-center px-2 py-1 text-sm ${
                              isCurrentHero ? 'bg-yellow-200 border-l-4 border-yellow-500' : 'bg-slate-50'
                            }`}
                          >
                            <span className="font-bold truncate flex-1">
                              {idx + 1}. {isCurrentHero && '⭐'}{member.name}
                              {wasHero && !isCurrentHero && <span className="text-gray-400 ml-1">★</span>}
                            </span>
                            <span className="font-black text-indigo-600 ml-2">
                              {member.score}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 실시간 현황 테이블 */}
      {gameState?.isStarted && (
        <div className="brutal-card p-6">
          <h3 className="text-xl font-black mb-4 border-b-4 border-black pb-2">실시간 게임 현황</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-black text-white">
                  <th className="px-4 py-3 font-black text-sm">팀</th>
                  <th className="px-4 py-3 font-black text-sm">현재 주인공</th>
                  <th className="px-4 py-3 font-black text-sm">현재 문제</th>
                  <th className="px-4 py-3 font-black text-sm">선택</th>
                  <th className="px-4 py-3 font-black text-sm">라운드</th>
                  <th className="px-4 py-3 font-black text-sm">팀 점수</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black">
                {teamNames.map((team) => {
                  const data = getTeamData(team);
                  return (
                    <tr key={team} className="hover:bg-yellow-50">
                      <td className="px-4 py-3 font-black text-indigo-600">{team}</td>
                      <td className="px-4 py-3 font-bold">{data.hero?.name || '-'}</td>
                      <td className="px-4 py-3">
                        {data.currentQuestion ? (
                          <button
                            onClick={() => setSelectedTeam(team)}
                            className="brutal-badge bg-indigo-100 hover:bg-indigo-200 cursor-pointer text-left max-w-[200px] truncate transition-colors"
                            title={data.currentQuestion}
                          >
                            📋 {data.currentQuestion.slice(0, 20)}...
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {data.answer ? (
                          <span className={`brutal-badge ${data.answer === 'O' ? 'bg-emerald-400' : 'bg-rose-400'}`}>
                            {data.answer}
                          </span>
                        ) : (
                          <span className="text-gray-400 animate-pulse">선택 중...</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold">{data.rounds}</td>
                      <td className="px-4 py-3 font-black text-xl">{data.totalScore}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 문제 보기 모달 */}
      {selectedTeam && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedTeam(null)}
        >
          <div
            className="brutal-card bg-white p-8 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 border-b-4 border-black pb-4">
              <h2 className="text-2xl font-black">{selectedTeam} 현재 문제</h2>
              <button
                onClick={() => setSelectedTeam(null)}
                className="brutal-button px-4 py-2 bg-slate-200 hover:bg-slate-300"
              >
                ✕
              </button>
            </div>

            {(() => {
              const data = getTeamData(selectedTeam);
              return (
                <div className="space-y-6">
                  {/* 주인공 정보 */}
                  <div className="brutal-inset p-4 bg-yellow-50">
                    <p className="text-sm text-gray-600 mb-1">현재 주인공</p>
                    <p className="font-black text-xl">⭐ {data.hero?.name || '-'}</p>
                  </div>

                  {/* 현재 문제 */}
                  <div className="brutal-inset p-4 bg-indigo-50">
                    <p className="text-sm text-gray-600 mb-2">
                      현재 문제 ({data.teamCurrentIndex + 1}/4)
                    </p>
                    <p className="font-black text-lg leading-relaxed">
                      {data.currentQuestion || '문제 없음'}
                    </p>
                  </div>

                  {/* 주인공 선택 */}
                  {data.answer && (
                    <div className="brutal-inset p-4 bg-emerald-50">
                      <p className="text-sm text-gray-600 mb-1">주인공 선택</p>
                      <p className={`font-black text-3xl ${data.answer === 'O' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {data.answer}
                      </p>
                    </div>
                  )}

                  {/* 전체 문제 목록 */}
                  <div className="brutal-inset p-4 bg-slate-50">
                    <p className="text-sm text-gray-600 mb-3">이번 라운드 문제 (4개)</p>
                    <div className="space-y-2">
                      {data.teamQuestionHistory.map((qIdx, idx) => {
                        const question = roomConfig?.questions?.[qIdx];
                        const isCurrent = idx === data.teamCurrentIndex;
                        return (
                          <div
                            key={idx}
                            className={`p-3 border-2 border-black ${
                              isCurrent ? 'bg-yellow-200 font-bold' : 'bg-white'
                            }`}
                          >
                            <span className="text-indigo-600 mr-2">{idx + 1}.</span>
                            {question || '질문 없음'}
                            {isCurrent && <span className="ml-2 text-xs brutal-badge bg-yellow-400">현재</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
