
import React, { useState } from 'react';
import { RoomConfig, GameState, User, UserRole } from '../types';
import { INITIAL_QUESTIONS } from '../constants';
import TraineeView from './TraineeView';

interface Props {
  roomConfig: RoomConfig | null;
  gameState: GameState;
  participants: User[];
  onCreateRoom: (config: RoomConfig) => void;
  onStart: () => void;
  onStop: () => void;
}

const AdminView: React.FC<Props> = ({ roomConfig, gameState, participants, onCreateRoom, onStart, onStop }) => {
  const [showConfig, setShowConfig] = useState(!roomConfig);
  const [roomName, setRoomName] = useState(roomConfig?.roomName || '');
  const [teamCount, setTeamCount] = useState(roomConfig?.teamCount || 4);
  const [duration, setDuration] = useState(roomConfig?.durationMinutes || 10);
  const [questions, setQuestions] = useState(roomConfig?.questions.join('\n') || INITIAL_QUESTIONS.join('\n'));
  
  const [inspectingTeam, setInspectingTeam] = useState<string | null>(null);

  const handleCreate = () => {
    onCreateRoom({
      roomName,
      teamCount,
      durationMinutes: duration,
      questions: questions.split('\n').filter(q => q.trim() !== '')
    });
    setShowConfig(false);
  };

  const closeInspector = () => setInspectingTeam(null);

  if (showConfig) {
    return (
      <div className="brutal-card w-full max-w-3xl p-10 max-h-[90vh] overflow-y-auto">
        <h2 className="text-3xl font-black mb-8 border-b-4 border-black pb-4 uppercase">Create Signal Room</h2>
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-black mb-2 uppercase">Room Name</label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full brutal-input"
              />
            </div>
            <div>
              <label className="block text-sm font-black mb-2 uppercase">Number of Teams</label>
              <input
                type="number"
                value={teamCount}
                onChange={(e) => setTeamCount(parseInt(e.target.value))}
                className="w-full brutal-input"
              />
            </div>
            <div>
              <label className="block text-sm font-black mb-2 uppercase">Duration (Min)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full brutal-input"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-black mb-2 uppercase">Question Pool</label>
            <textarea
              rows={8}
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              className="w-full brutal-input text-sm leading-relaxed"
            />
          </div>
          <button
            onClick={handleCreate}
            className="w-full py-5 brutal-button brutal-button-success text-2xl"
          >
            CONFIRM & CREATE
          </button>
        </div>
      </div>
    );
  }

  const getMockUserForTeam = (teamName: string) => {
    const heroId = gameState.currentHeroId[teamName];
    const hero = participants.find(p => p.id === heroId);
    if (hero) return hero;
    const member = participants.find(p => p.team === teamName);
    if (member) return member;
    return { id: 'mock', name: 'ADMIN-VIEW', team: teamName, role: UserRole.TRAINEE, score: 0 } as User;
  };

  return (
    <div className="w-full max-w-6xl space-y-10">
      {/* Header Dashboard Info */}
      <div className="flex flex-col md:flex-row justify-between items-stretch gap-6">
        <div className="brutal-card px-10 py-6 flex-1 bg-yellow-300">
          <h1 className="text-4xl font-black border-b-2 border-black mb-2 uppercase tracking-tight">{roomConfig?.roomName}</h1>
          <div className="flex items-center gap-4">
             <span className="brutal-badge bg-black text-white">LIVE</span>
             <p className="text-lg font-black">Connected: {participants.filter(p => p.role === UserRole.TRAINEE).length} users</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {!gameState.isStarted && !gameState.isFinished ? (
            <button
              onClick={onStart}
              className="px-10 py-4 brutal-button brutal-button-success uppercase"
            >
              Start Signal
            </button>
          ) : (
            <button
              onClick={onStop}
              className="px-10 py-4 brutal-button brutal-button-danger uppercase"
            >
              Terminate
            </button>
          )}
          <button
            onClick={() => setShowConfig(true)}
            className="px-10 py-4 brutal-button brutal-button-secondary uppercase"
          >
            Edit Pool
          </button>
        </div>
      </div>

      {/* Team Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.keys(gameState.scores).map((team) => {
          const score = gameState.scores[team];
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
              <div className="flex gap-2">
                 <span className="text-sm font-black">Round: {gameState.roundCount[team] || 0}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Real-time Status Table */}
      <div className="brutal-card p-10">
        <h3 className="text-2xl font-black mb-8 border-b-4 border-black pb-2 uppercase italic">Real-time Stream Status</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-black text-white border-b-4 border-black">
                <th className="px-6 py-4 font-black uppercase text-sm">Team Unit</th>
                <th className="px-6 py-4 font-black uppercase text-sm">Active Hero</th>
                <th className="px-6 py-4 font-black uppercase text-sm">Choice State</th>
                <th className="px-6 py-4 font-black uppercase text-sm">Current Points</th>
              </tr>
            </thead>
            <tbody className="divide-y-4 divide-black">
              {Object.entries(gameState.scores).map(([team, score]) => {
                const heroId = gameState.currentHeroId[team];
                const hero = participants.find(p => p.id === heroId);
                const answer = gameState.heroAnswer[team];
                return (
                  <tr 
                    key={team} 
                    className="cursor-pointer hover:bg-yellow-100 transition-colors"
                    onClick={() => setInspectingTeam(team)}
                  >
                    <td className="px-6 py-6 font-black text-indigo-600 text-xl italic">{team}</td>
                    <td className="px-6 py-6 font-bold">{hero?.name || '---'}</td>
                    <td className="px-6 py-6">
                      {answer ? (
                        <div className={`brutal-badge inline-block ${answer === 'O' ? 'bg-emerald-400' : 'bg-rose-400'}`}>
                          {answer} SELECTED
                        </div>
                      ) : (
                        <span className="text-slate-400 font-bold animate-pulse">THINKING...</span>
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

      {/* Inspector Modal */}
      {inspectingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="brutal-card w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-100 flex flex-col p-4">
            <div className="flex justify-between items-center mb-6 px-4 bg-indigo-500 border-4 border-black p-4 text-white">
              <h2 className="text-2xl font-black uppercase tracking-tighter">Monitoring: {inspectingTeam}</h2>
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
                onTeamSync={() => {}}
                isReadOnly={true}
              />
            </div>
            <div className="mt-6 bg-black text-white p-2 text-center text-[10px] font-black uppercase tracking-[0.3em]">
              Admin Restricted Access Mode
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
