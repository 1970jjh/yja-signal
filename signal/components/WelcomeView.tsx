
import React, { useState } from 'react';
import { RoomConfig } from '../types';
import { INITIAL_QUESTIONS } from '../constants';
import { RoomInfo } from '../hooks/useFirebaseRoom';

interface Props {
  roomList: RoomInfo[];
  onAdminLogin: (config: RoomConfig) => void;
  onAdminJoinRoom: (roomId: string) => void;
  onParticipantLogin: (roomId: string, name: string, team: string) => void;
  onDeleteRoom: (roomId: string) => void;
  onRefreshRooms: () => void;
}

type ViewMode = 'select' | 'admin' | 'admin-create' | 'participant-join';

const WelcomeView: React.FC<Props> = ({
  roomList,
  onAdminLogin,
  onAdminJoinRoom,
  onParticipantLogin,
  onDeleteRoom,
  onRefreshRooms
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('select');
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomInfo | null>(null);

  // 참가자 상태
  const [name, setName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('팀 1');

  // 관리자 상태
  const [password, setPassword] = useState('');
  const [roomName, setRoomName] = useState('');
  const [adminTeamCount, setAdminTeamCount] = useState(4);
  const [duration, setDuration] = useState(10);
  const [questions, setQuestions] = useState(INITIAL_QUESTIONS.join('\n\n'));

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const ADMIN_PASSWORD = '6749467';

  const handlePasswordCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsPasswordVerified(true);
      setError('');
      onRefreshRooms();
    } else {
      setError('비밀번호가 올바르지 않습니다.');
    }
  };

  const handleRoomSelect = (room: RoomInfo) => {
    setSelectedRoom(room);
    setSelectedTeam('팀 1');
    setViewMode('participant-join');
  };

  const handleParticipantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }

    if (!selectedRoom) {
      setError('방을 선택해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      await onParticipantLogin(selectedRoom.id, name, selectedTeam);
    } catch (err) {
      setError('참가에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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
        questions: questions.split(/\n\n+/).map(q => q.trim()).filter(q => q !== '')
      });
    } catch (err) {
      console.error('Room creation error:', err);
      setError('방 생성에 실패했습니다. 다시 시도해주세요.');
      setIsLoading(false);
    }
  };

  const handleDeleteRoom = async (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('정말로 이 방을 삭제하시겠습니까?')) {
      await onDeleteRoom(roomId);
      onRefreshRooms();
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // 메인 화면 - 방 목록 + 관리자 버튼
  if (viewMode === 'select') {
    return (
      <div className="brutal-card w-full max-w-md p-8">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-black text-black mb-1 uppercase tracking-tighter">이심전심 시그널</h1>
          <div className="bg-yellow-300 border-2 border-black inline-block px-3 py-1 -rotate-1">
            <p className="text-black font-black text-xs">주인공의 마음을 읽어라!</p>
          </div>
        </div>

        {/* 방 목록 - 바로 클릭해서 참가 */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-black text-sm uppercase">참가할 방 선택</h2>
            <button
              onClick={onRefreshRooms}
              className="text-xs brutal-button px-2 py-1"
            >
              새로고침
            </button>
          </div>

          {roomList.length === 0 ? (
            <div className="p-6 border-4 border-black bg-slate-100 text-center">
              <p className="text-slate-500 font-bold text-sm">아직 열린 방이 없습니다</p>
              <p className="text-slate-400 text-xs mt-1">관리자가 방을 만들어야 합니다</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {roomList.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleRoomSelect(room)}
                  className="w-full p-4 brutal-button text-left hover:bg-indigo-100 transition-colors brutal-button-primary"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-black text-lg">{room.roomName}</p>
                      <p className="text-xs opacity-80">
                        {room.teamCount}팀 · {room.participantCount}명 참가 중
                      </p>
                    </div>
                    <div className="text-right">
                      {room.isStarted ? (
                        <span className="bg-emerald-500 text-white px-2 py-1 text-xs font-bold border-2 border-black">진행 중</span>
                      ) : (
                        <span className="bg-yellow-300 text-black px-2 py-1 text-xs font-bold border-2 border-black">대기 중</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 관리자 버튼 */}
        <button
          onClick={() => setViewMode('admin')}
          className="w-full py-3 brutal-button brutal-button-secondary text-sm uppercase"
        >
          관리자
        </button>
      </div>
    );
  }

  // 참가자 - 팀과 이름 입력 화면
  if (viewMode === 'participant-join' && selectedRoom) {
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
          <p className="mt-2 text-indigo-600 font-bold">{selectedRoom.roomName}</p>
        </div>

        <form onSubmit={handleParticipantSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-black text-black mb-2 uppercase">팀 선택</label>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: selectedRoom.teamCount }, (_, i) => (
                <button
                  key={i + 1}
                  type="button"
                  onClick={() => setSelectedTeam(`팀 ${i + 1}`)}
                  className={`py-4 brutal-button font-black text-lg ${
                    selectedTeam === `팀 ${i + 1}` ? 'brutal-button-primary' : ''
                  }`}
                >
                  팀 {i + 1}
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

  // 관리자 화면 - 비밀번호 먼저 확인
  if (viewMode === 'admin' && !isPasswordVerified) {
    return (
      <div className="brutal-card w-full max-w-md p-10">
        <button
          onClick={() => setViewMode('select')}
          className="mb-6 brutal-button px-4 py-2 text-sm"
        >
          ← 뒤로
        </button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-black uppercase tracking-tighter">관리자</h1>
        </div>

        <form onSubmit={handlePasswordCheck} className="space-y-6">
          <div>
            <label className="block text-sm font-black text-black mb-2 uppercase">관리자 비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              className="w-full brutal-input font-black text-xl text-center"
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
            className="w-full py-5 brutal-button brutal-button-primary text-xl uppercase"
          >
            확인
          </button>
        </form>
      </div>
    );
  }

  // 관리자 화면 - 비밀번호 확인 후 방 목록 및 관리
  if (viewMode === 'admin' && isPasswordVerified) {
    return (
      <div className="brutal-card w-full max-w-lg p-10 max-h-[90vh] overflow-y-auto">
        <button
          onClick={() => {
            setViewMode('select');
            setIsPasswordVerified(false);
            setPassword('');
          }}
          className="mb-6 brutal-button px-4 py-2 text-sm"
        >
          ← 뒤로
        </button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-black uppercase tracking-tighter">방 관리</h1>
        </div>

        {/* 새 방 만들기 버튼 */}
        <button
          onClick={() => setViewMode('admin-create')}
          className="w-full py-5 brutal-button brutal-button-success text-xl uppercase mb-6"
        >
          + 새 방 만들기
        </button>

        {/* 기존 방 목록 */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-black text-lg">기존 방 목록</h2>
            <button
              onClick={onRefreshRooms}
              className="brutal-button px-3 py-1 text-sm"
            >
              새로고침
            </button>
          </div>

          {roomList.length === 0 ? (
            <div className="p-6 border-4 border-black bg-slate-100 text-center">
              <p className="text-slate-500 font-bold">아직 만들어진 방이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {roomList.map((room) => (
                <div
                  key={room.id}
                  className="p-4 border-4 border-black bg-white"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-black text-lg">{room.roomName}</p>
                      <p className="text-xs text-slate-600">
                        {room.teamCount}팀 · {room.participantCount}명 · {formatTime(room.createdAt)}
                      </p>
                    </div>
                    <div>
                      {room.isStarted ? (
                        <span className="bg-emerald-400 text-white px-2 py-1 text-xs font-bold border-2 border-black">진행 중</span>
                      ) : (
                        <span className="bg-yellow-300 px-2 py-1 text-xs font-bold border-2 border-black">대기 중</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => onAdminJoinRoom(room.id)}
                      className="flex-1 py-3 brutal-button brutal-button-primary font-bold"
                    >
                      입장
                    </button>
                    <button
                      onClick={(e) => handleDeleteRoom(room.id, e)}
                      className="py-3 px-4 brutal-button bg-rose-500 text-white font-bold"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 관리자 화면 - 새 방 만들기
  if (viewMode === 'admin-create') {
    return (
      <div className="brutal-card w-full max-w-2xl p-10 max-h-[90vh] overflow-y-auto">
        <button
          onClick={() => setViewMode('admin')}
          className="mb-6 brutal-button px-4 py-2 text-sm"
        >
          ← 뒤로
        </button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-black uppercase tracking-tighter">새 방 만들기</h1>
        </div>

        <form onSubmit={handleAdminSubmit} className="space-y-6">
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

          <div>
            <label className="block text-sm font-black text-black mb-2 uppercase">질문 목록 (빈 줄로 문항 구분)</label>
            <textarea
              rows={10}
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder="질문 1 내용 (여러 줄 가능)

질문 2 내용 (여러 줄 가능)

질문 3 내용..."
              className="w-full brutal-input text-sm leading-relaxed"
            />
            <p className="text-xs text-gray-500 mt-1">* 긴 질문은 여러 줄 작성 가능, 문항 사이에 빈 줄(엔터 두 번)로 구분</p>
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
  }

  return null;
};

export default WelcomeView;
