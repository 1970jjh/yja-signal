
import { useState, useEffect, useCallback } from 'react';
import { database, ref, set, get, onValue, update, remove } from '../firebase';
import { User, UserRole, RoomConfig, GameState } from '../types';

// 6자리 방 코드 생성
export const generateRoomCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

interface UseFirebaseRoomReturn {
  // 상태
  roomCode: string | null;
  roomConfig: RoomConfig | null;
  gameState: GameState;
  participants: User[];
  currentUser: User | null;
  isConnected: boolean;
  error: string | null;

  // 액션
  createRoom: (config: RoomConfig) => Promise<string>;
  joinRoom: (code: string, user: Omit<User, 'id' | 'score'>) => Promise<boolean>;
  leaveRoom: () => void;
  startGame: () => void;
  stopGame: () => void;
  updateGameState: (newState: Partial<GameState>) => void;
  setHeroAnswer: (team: string, answer: 'O' | 'X') => void;
  nextRound: (team: string, nextHeroId: string, nextQuestionIdx: number) => void;
}

const initialGameState: GameState = {
  isStarted: false,
  isFinished: false,
  startTime: null,
  currentHeroId: {},
  heroAnswer: {},
  scores: {},
  roundCount: {},
  questionIndices: {}
};

export const useFirebaseRoom = (): UseFirebaseRoomReturn => {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomConfig, setRoomConfig] = useState<RoomConfig | null>(null);
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [participants, setParticipants] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 방 데이터 실시간 구독
  useEffect(() => {
    if (!roomCode) return;

    const roomRef = ref(database, `rooms/${roomCode}`);

    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setIsConnected(true);
        if (data.config) setRoomConfig(data.config);
        if (data.gameState) setGameState(data.gameState);
        if (data.participants) {
          const participantsList = Object.values(data.participants) as User[];
          setParticipants(participantsList);
        } else {
          setParticipants([]);
        }
      } else {
        // 방이 삭제됨
        setIsConnected(false);
        setError('방이 종료되었습니다.');
      }
    }, (err) => {
      console.error('Firebase error:', err);
      setError('연결 오류가 발생했습니다.');
      setIsConnected(false);
    });

    return () => unsubscribe();
  }, [roomCode]);

  // 방 생성
  const createRoom = useCallback(async (config: RoomConfig): Promise<string> => {
    const code = generateRoomCode();
    const roomRef = ref(database, `rooms/${code}`);

    const initialScores: Record<string, number> = {};
    const initialHeroes: Record<string, string> = {};
    const initialRounds: Record<string, number> = {};
    const initialIndices: Record<string, number> = {};

    for (let i = 1; i <= config.teamCount; i++) {
      const teamName = `Team ${i}`;
      initialScores[teamName] = 0;
      initialRounds[teamName] = 0;
      initialIndices[teamName] = 0;
    }

    const newGameState: GameState = {
      ...initialGameState,
      scores: initialScores,
      currentHeroId: initialHeroes,
      roundCount: initialRounds,
      questionIndices: initialIndices
    };

    try {
      await set(roomRef, {
        config,
        gameState: newGameState,
        participants: {},
        createdAt: Date.now()
      });

      setRoomCode(code);
      setRoomConfig(config);
      setGameState(newGameState);
      setError(null);

      // 관리자로 로그인
      const adminUser: User = {
        id: 'admin_' + Date.now(),
        name: '관리자',
        team: 'Admin',
        role: UserRole.ADMIN,
        score: 0
      };
      setCurrentUser(adminUser);

      return code;
    } catch (err) {
      console.error('Failed to create room:', err);
      setError('방 생성에 실패했습니다.');
      throw err;
    }
  }, []);

  // 방 참가
  const joinRoom = useCallback(async (code: string, userData: Omit<User, 'id' | 'score'>): Promise<boolean> => {
    const upperCode = code.toUpperCase();
    const roomRef = ref(database, `rooms/${upperCode}`);

    try {
      const snapshot = await get(roomRef);
      if (!snapshot.exists()) {
        setError('존재하지 않는 방 코드입니다.');
        return false;
      }

      const newUser: User = {
        ...userData,
        id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        score: 0
      };

      // 참가자 추가
      const participantRef = ref(database, `rooms/${upperCode}/participants/${newUser.id}`);
      await set(participantRef, newUser);

      // 팀의 첫 번째 멤버면 히어로로 설정
      const roomData = snapshot.val();
      const existingParticipants = roomData.participants ? Object.values(roomData.participants) as User[] : [];
      const teamMembers = existingParticipants.filter(p => p.team === newUser.team);

      if (teamMembers.length === 0 && userData.role === UserRole.TRAINEE) {
        // 첫 번째 팀원이 히어로가 됨
        const heroRef = ref(database, `rooms/${upperCode}/gameState/currentHeroId/${newUser.team}`);
        await set(heroRef, newUser.id);
      }

      setRoomCode(upperCode);
      setCurrentUser(newUser);
      setError(null);

      return true;
    } catch (err) {
      console.error('Failed to join room:', err);
      setError('방 참가에 실패했습니다.');
      return false;
    }
  }, []);

  // 방 나가기
  const leaveRoom = useCallback(() => {
    if (roomCode && currentUser) {
      const participantRef = ref(database, `rooms/${roomCode}/participants/${currentUser.id}`);
      remove(participantRef);
    }
    setRoomCode(null);
    setCurrentUser(null);
    setRoomConfig(null);
    setGameState(initialGameState);
    setParticipants([]);
    setIsConnected(false);
  }, [roomCode, currentUser]);

  // 게임 시작
  const startGame = useCallback(() => {
    if (!roomCode) return;

    const gameStateRef = ref(database, `rooms/${roomCode}/gameState`);
    update(gameStateRef, {
      isStarted: true,
      isFinished: false,
      startTime: Date.now()
    });
  }, [roomCode]);

  // 게임 종료
  const stopGame = useCallback(() => {
    if (!roomCode) return;

    const gameStateRef = ref(database, `rooms/${roomCode}/gameState`);
    update(gameStateRef, {
      isStarted: false,
      isFinished: true
    });
  }, [roomCode]);

  // 게임 상태 업데이트
  const updateGameState = useCallback((newState: Partial<GameState>) => {
    if (!roomCode) return;

    const gameStateRef = ref(database, `rooms/${roomCode}/gameState`);
    update(gameStateRef, newState);
  }, [roomCode]);

  // 히어로 답변 설정
  const setHeroAnswer = useCallback((team: string, answer: 'O' | 'X') => {
    if (!roomCode) return;

    const answerRef = ref(database, `rooms/${roomCode}/gameState/heroAnswer/${team}`);
    set(answerRef, answer);
  }, [roomCode]);

  // 다음 라운드로 이동
  const nextRound = useCallback((team: string, nextHeroId: string, nextQuestionIdx: number) => {
    if (!roomCode) return;

    const updates: Record<string, any> = {};
    updates[`gameState/scores/${team}`] = (gameState.scores[team] || 0) + 100;
    updates[`gameState/currentHeroId/${team}`] = nextHeroId;
    updates[`gameState/heroAnswer/${team}`] = null;
    updates[`gameState/questionIndices/${team}`] = nextQuestionIdx;
    updates[`gameState/roundCount/${team}`] = (gameState.roundCount[team] || 0) + 1;

    const roomRef = ref(database, `rooms/${roomCode}`);
    update(roomRef, updates);
  }, [roomCode, gameState]);

  return {
    roomCode,
    roomConfig,
    gameState,
    participants,
    currentUser,
    isConnected,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    stopGame,
    updateGameState,
    setHeroAnswer,
    nextRound
  };
};
