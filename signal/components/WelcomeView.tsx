
import React, { useState, useEffect } from 'react';
import { UserRole, RoomConfig } from '../types';

interface Props {
  onLogin: (name: string, team: string, role: UserRole, roomName?: string) => void;
  roomConfig: RoomConfig | null;
}

const WelcomeView: React.FC<Props> = ({ onLogin, roomConfig }) => {
  const [role, setRole] = useState<UserRole>(UserRole.TRAINEE);
  const [name, setName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('Team 1');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const ADMIN_PASSWORD = '6749467';

  useEffect(() => {
    if (roomConfig && !selectedTeam) {
      setSelectedTeam('Team 1');
    }
  }, [roomConfig]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (role === UserRole.ADMIN) {
      if (password !== ADMIN_PASSWORD) {
        setError('비밀번호가 올바르지 않습니다.');
        return;
      }
      onLogin('관리자', 'Admin', role);
    } else {
      if (!roomConfig) {
        setError('개설된 방이 없습니다. 관리자가 방을 먼저 만들어야 합니다.');
        return;
      }
      if (!name) {
        setError('이름을 입력해주세요.');
        return;
      }
      onLogin(name, selectedTeam, role, roomConfig.roomName);
    }
  };

  return (
    <div className="brutal-card w-full max-w-md p-10 animate-in fade-in zoom-in duration-500">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black text-black mb-1 uppercase tracking-tighter">이심전심 시그널</h1>
        <div className="bg-yellow-300 border-2 border-black inline-block px-3 py-1 -rotate-1">
          <p className="text-black font-black text-xs">주인공의 마음을 읽어라!</p>
        </div>
      </div>

      <div className="grid grid-cols-2 border-4 border-black mb-8 overflow-hidden bg-black">
        <button
          type="button"
          onClick={() => { setRole(UserRole.TRAINEE); setError(''); }}
          className={`py-3 text-sm font-black transition-all ${
            role === UserRole.TRAINEE ? 'bg-indigo-500 text-white' : 'bg-white text-black'
          }`}
        >
          참가자
        </button>
        <button
          type="button"
          onClick={() => { setRole(UserRole.ADMIN); setError(''); }}
          className={`py-3 text-sm font-black transition-all ${
            role === UserRole.ADMIN ? 'bg-indigo-500 text-white' : 'bg-white text-black'
          }`}
        >
          관리자
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {role === UserRole.TRAINEE ? (
          <>
            <div>
              <label className="block text-sm font-black text-black mb-2">과정명 (선택)</label>
              <div className="brutal-inset p-4 font-black text-indigo-600 bg-white border-4">
                {roomConfig ? roomConfig.roomName : '현재 개설된 방 없음'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-black text-black mb-2">팀 선택</label>
              <div className="relative">
                <select
                  disabled={!roomConfig}
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="w-full brutal-input appearance-none cursor-pointer pr-10 font-black"
                >
                  {roomConfig ? (
                    Array.from({ length: roomConfig.teamCount }, (_, i) => (
                      <option key={i + 1} value={`Team ${i + 1}`}>Team {i + 1}</option>
                    ))
                  ) : (
                    <option>방 생성 대기 중...</option>
                  )}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none font-black">▼</div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-black text-black mb-2">내 이름</label>
              <input
                type="text"
                required
                disabled={!roomConfig}
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder="입력하세요"
                className="w-full brutal-input font-black"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-sm font-black text-black mb-2">관리자 비밀번호</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="패스워드"
              className="w-full brutal-input font-black"
            />
          </div>
        )}

        {error && (
          <div className="bg-rose-500 text-white p-3 border-2 border-black font-bold text-xs">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={role === UserRole.TRAINEE && !roomConfig}
          className={`w-full py-5 brutal-button text-xl uppercase ${
            role === UserRole.TRAINEE && !roomConfig 
              ? 'bg-slate-300 cursor-not-allowed' 
              : 'brutal-button-primary'
          }`}
        >
          접속하기
        </button>
      </form>
    </div>
  );
};

export default WelcomeView;
