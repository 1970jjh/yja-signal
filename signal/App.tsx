
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, UserRole, RoomConfig, GameState, BroadcastMessage } from './types';
import { INITIAL_QUESTIONS } from './constants';
import AdminView from './components/AdminView';
import TraineeView from './components/TraineeView';
import WelcomeView from './components/WelcomeView';

const BC_CHANNEL_NAME = 'clay_quiz_sync_v1';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [roomConfig, setRoomConfig] = useState<RoomConfig | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    isStarted: false,
    isFinished: false,
    startTime: null,
    currentHeroId: {},
    heroAnswer: {},
    scores: {},
    roundCount: {},
    questionIndices: {}
  });
  const [participants, setParticipants] = useState<User[]>([]);
  
  const bc = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    bc.current = new BroadcastChannel(BC_CHANNEL_NAME);
    
    bc.current.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      const { type, payload } = event.data;
      
      switch (type) {
        case 'SYNC':
          if (payload.roomConfig) setRoomConfig(payload.roomConfig);
          if (payload.gameState) setGameState(payload.gameState);
          if (payload.participants) setParticipants(payload.participants);
          break;
        case 'START':
          setGameState(prev => ({ ...prev, isStarted: true, startTime: Date.now() }));
          if (navigator.vibrate) navigator.vibrate(200);
          break;
        case 'FINISH':
        case 'ADMIN_STOP':
          setGameState(prev => ({ ...prev, isFinished: true, isStarted: false }));
          break;
        case 'HERO_ANSWER':
          setGameState(prev => ({
            ...prev,
            heroAnswer: { ...prev.heroAnswer, [payload.team]: payload.answer }
          }));
          break;
        case 'NEXT_ROUND':
          setGameState(payload.newState);
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          break;
      }
    };

    // Request sync from any existing tabs
    bc.current.postMessage({ type: 'SYNC', payload: {} });

    return () => {
      bc.current?.close();
    };
  }, []);

  const syncAll = useCallback((config: RoomConfig | null, state: GameState, users: User[]) => {
    bc.current?.postMessage({
      type: 'SYNC',
      payload: { roomConfig: config, gameState: state, participants: users }
    });
  }, []);

  const handleLogin = (name: string, team: string, role: UserRole, roomName?: string) => {
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      team,
      role,
      score: 0
    };
    setCurrentUser(newUser);
    const updatedParticipants = [...participants, newUser];
    setParticipants(updatedParticipants);
    syncAll(roomConfig, gameState, updatedParticipants);
  };

  const handleCreateRoom = (config: RoomConfig) => {
    setRoomConfig(config);
    const initialScores: Record<string, number> = {};
    const initialHeroes: Record<string, string> = {};
    const initialRounds: Record<string, number> = {};
    const initialIndices: Record<string, number> = {};

    for (let i = 1; i <= config.teamCount; i++) {
      const teamName = `Team ${i}`;
      initialScores[teamName] = 0;
      initialRounds[teamName] = 0;
      initialIndices[teamName] = 0;
      
      const teamMembers = participants.filter(p => p.team === teamName);
      if (teamMembers.length > 0) {
        initialHeroes[teamName] = teamMembers[0].id;
      }
    }

    const newState = {
      ...gameState,
      scores: initialScores,
      currentHeroId: initialHeroes,
      roundCount: initialRounds,
      questionIndices: initialIndices
    };
    setGameState(newState);
    syncAll(config, newState, participants);
  };

  const startGame = () => {
    const newState = { ...gameState, isStarted: true, startTime: Date.now() };
    setGameState(newState);
    bc.current?.postMessage({ type: 'START' });
    syncAll(roomConfig, newState, participants);
  };

  const stopGame = () => {
    const newState = { ...gameState, isFinished: true, isStarted: false };
    setGameState(newState);
    bc.current?.postMessage({ type: 'ADMIN_STOP' });
    syncAll(roomConfig, newState, participants);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
      {!currentUser ? (
        <WelcomeView onLogin={handleLogin} roomConfig={roomConfig} />
      ) : currentUser.role === UserRole.ADMIN ? (
        <AdminView 
          roomConfig={roomConfig} 
          gameState={gameState} 
          participants={participants}
          onCreateRoom={handleCreateRoom}
          onStart={startGame}
          onStop={stopGame}
        />
      ) : (
        <TraineeView 
          user={currentUser}
          roomConfig={roomConfig}
          gameState={gameState}
          participants={participants}
          onHeroAction={(answer) => {
             bc.current?.postMessage({ type: 'HERO_ANSWER', payload: { team: currentUser.team, answer } });
             setGameState(prev => ({
               ...prev,
               heroAnswer: { ...prev.heroAnswer, [currentUser.team]: answer }
             }));
          } }
          onTeamSync={(newState) => {
             bc.current?.postMessage({ type: 'NEXT_ROUND', payload: { newState } });
             setGameState(newState);
          }}
        />
      )}
    </div>
  );
};

export default App;
