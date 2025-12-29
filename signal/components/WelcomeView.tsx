
import React, { useState } from 'react';
import { RoomConfig } from '../types';
import { INITIAL_QUESTIONS } from '../constants';

interface Props {
  roomExists: boolean;
  roomConfig: RoomConfig | null;
  onAdminLogin: (config: RoomConfig) => void;
  onParticipantLogin: (name: string, team: string) => void;
}

type ViewMode = 'select' | 'admin' | 'participant';

const WelcomeView: React.FC<Props> = ({ roomExists, roomConfig, onAdminLogin, onParticipantLogin }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('select');

  // 참가자 상태
  const [name, setName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('Team 1');

  // 관리자 상태
  const [password, setPassword] = useState('');
  const [roomName, setRoomName] = useState('');
  const [adminTeamCount, setAdminTeamCount] = useState(4);
  const [duration, setDuration] = useState(10);
  const [questions, setQuestions] = useState(INITIAL_QUESTIONS.join('\n'));

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const ADMIN_PASSWORD = '6749467';

  const handleParticipantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      await onParticipantLogin(name, selectedTeam);
    } catch (err) {
      setError('참가에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== ADMIN_PASSWORD) {
      setError('비밀번호가 올바르지 않습니다.');
      return;
    }
    if (!roomName.trim()) {
      setError('방 이름을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      await onAdminLogin({
        roomName,
        teamCount: adminTeamCount,
        durationMinutes: duration,
        questions: questions.split('\n').filter(q => q.trim() !== '')
      });
    } catch (err) {
      setError('방 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 역할 선택 화면
  if (viewMode === 'select') {
    return (
      <div className="brutal-card w-full max-w-md p-10">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-black mb-1 uppercase tracking-tighter">이심전심 시그널</h1>
          <div className="bg-yellow-300 border-2 border-black inline-block px-3 py-1 -rotate-1">
            <p className="text-black font-black text-xs">주인공의 마음을 읽어라!</p>
          </div>
        </div>

        {/* 방 상태 표시 */}
        <div className={`mb-8 p-4 border-4 border-black text-center ${roomExists ? 'bg-emerald-100' : 'bg-slate-100'}`}>
          {roomExists ? (
            <>
              <p className="font-black text-emerald-600">● 게임 준비됨</p>
              <p className="text-sm font-bold mt-1">{roomConfig?.roomName}</p>
            </>
          ) : (
            <p className="font-black text-slate-500">○ 대기 중 (관리자가 방을 만들어야 합니다)</p>
          )}
        </div>

        <div className="space-y-4">
          <button
            onClick={() => setViewMode('participant')}
            disabled={!roomExists}
            className={`w-full py-6 brutal-button text-xl uppercase ${
              roomExists ? 'brutal-button-primary' : 'bg-slate-300 cursor-not-allowed'
            }`}
          >
            참가하기
          </button>
          <button
            onClick={() => setViewMode('admin')}
            className="w-full py-4 brutal-button brutal-button-secondary text-lg uppercase"
          >
            관리자
          </button>
        </div>
      </div>
    );
  }

  // 참가자 화면 - 팀과 이름만 선택
  if (viewMode === 'participant') {
    const teamCount = roomConfig?.teamCount || 4;

    return (
      <div className="brutal-card w-full max-w-md p-10">
        <button
          onClick={() => setViewMode('select')}
          className="mb-6 brutal-button px-4 py-2 text-sm"
        >
          ← 뒤로
        </button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-black uppercase tracking-tighter">참가하기</h1>
          {roomConfig && (
            <p className="mt-2 text-indigo-600 font-bold">{roomConfig.roomName}</p>
          )}
        </div>

        <form onSubmit={handleParticipantSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-black text-black mb-2 uppercase">팀 선택</label>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: teamCount }, (_, i) => (
                <button
                  key={i + 1}
                  type="button"
                  onClick={() => setSelectedTeam(`Team ${i + 1}`)}
                  className={`py-4 brutal-button font-black text-lg ${
                    selectedTeam === `Team ${i + 1}` ? 'brutal-button-primary' : ''
                  }`}
                >
                  Team {i + 1}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-black text-black mb-2 uppercase">내 이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름 입력"
              className="w-full brutal-input font-black text-xl"
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-rose-500 text-white p-3 border-2 border-black font-bold text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-6 brutal-button text-2xl uppercase ${
              isLoading ? 'bg-slate-300 cursor-wait' : 'brutal-button-success'
            }`}
          >
            {isLoading ? '접속 중...' : '입장!'}
          </button>
        </form>
      </div>
    );
  }

  // 관리자 화면
  return (
    <div className="brutal-card w-full max-w-2xl p-10 max-h-[90vh] overflow-y-auto">
      <button
        onClick={() => setViewMode('select')}
        className="mb-6 brutal-button px-4 py-2 text-sm"
      >
        ← 뒤로
      </button>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-black uppercase tracking-tighter">관리자</h1>
      </div>

      <form onSubmit={handleAdminSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-black text-black mb-2 uppercase">관리자 비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            className="w-full brutal-input font-black"
          />
        </div>

        <div className="border-t-4 border-black pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-black text-black mb-2 uppercase">방 이름</label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="예: 신입사원 OT"
                className="w-full brutal-input font-black"
              />
            </div>
            <div>
              <label className="block text-sm font-black text-black mb-2 uppercase">팀 수</label>
              <input
                type="number"
                value={adminTeamCount}
                onChange={(e) => setAdminTeamCount(parseInt(e.target.value) || 4)}
                min={2}
                max={10}
                className="w-full brutal-input font-black"
              />
            </div>
            <div>
              <label className="block text-sm font-black text-black mb-2 uppercase">게임 시간 (분)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 10)}
                min={1}
                max={60}
                className="w-full brutal-input font-black"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-black text-black mb-2 uppercase">질문 목록 (한 줄에 하나씩)</label>
          <textarea
            rows={6}
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
            className="w-full brutal-input text-sm leading-relaxed"
          />
        </div>

        {error && (
          <div className="bg-rose-500 text-white p-3 border-2 border-black font-bold text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-5 brutal-button text-xl uppercase ${
            isLoading ? 'bg-slate-300 cursor-wait' : 'brutal-button-success'
          }`}
        >
          {isLoading ? '생성 중...' : '방 생성하기'}
        </button>
      </form>
    </div>
  );
};

export default WelcomeView;
