
import { useState, useEffect, useCallback } from 'react';
import { database, ref, set, get, onValue, update, remove } from '../firebase';
import { User, UserRole, RoomConfig, GameState } from '../types';

// 고정된 방 ID 사용 (방 코드 불필요)
const FIXED_ROOM_ID = 'main_room';

interface UseFirebaseRoomReturn {
  // 상태
  roomConfig: RoomConfig | null;
  gameState: GameState;
  participants: User[];
  currentUser: User | null;
  isConnected: boolean;
  error: string | null;
  roomExists: boolean;

  // 액션
  createRoom: (config: RoomConfig) => Promise<void>;
  joinRoom: (user: Omit<User, 'id' | 'score'>) => Promise<boolean>;
  leaveRoom: () => void;
  startGame: () => void;
  stopGame: () => void;
  resetRoom: () => void;
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
  const [roomConfig, setRoomConfig] = useState<RoomConfig | null>(null);
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [participants, setParticipants] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomExists, setRoomExists] = useState(false);

  // 방 데이터 실시간 구독
  useEffect(() => {
    const roomRef = ref(database, `rooms/${FIXED_ROOM_ID}`);

    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setIsConnected(true);
        setRoomExists(true);
        if (data.config) setRoomConfig(data.config);

        // gameState를 기본값과 병합하여 안전하게 설정
        if (data.gameState) {
          setGameState({
            isStarted: data.gameState.isStarted ?? false,
            isFinished: data.gameState.isFinished ?? false,
            startTime: data.gameState.startTime ?? null,
            currentHeroId: data.gameState.currentHeroId ?? {},
            heroAnswer: data.gameState.heroAnswer ?? {},
            scores: data.gameState.scores ?? {},
            roundCount: data.gameState.roundCount ?? {},
            questionIndices: data.gameState.questionIndices ?? {}
          });
        } else {
          setGameState(initialGameState);
        }

        if (data.participants) {
          const participantsList = Object.values(data.participants) as User[];
          setParticipants(participantsList);
        } else {
          setParticipants([]);
        }
      } else {
        setRoomExists(false);
        setRoomConfig(null);
        setGameState(initialGameState);
        setParticipants([]);
      }
    }, (err) => {
      console.error('Firebase error:', err);
      setError('연결 오류가 발생했습니다.');
      setIsConnected(false);
    });

    return () => unsubscribe();
  }, []);

  // 방 생성
  const createRoom = useCallback(async (config: RoomConfig): Promise<void> => {
    const roomRef = ref(database, `rooms/${FIXED_ROOM_ID}`);

    const initialScores: Record<string, number> = {};
    const initialHeroes: Record<string, string> = {};
    const initialRounds: Record<string, number> = {};
    const initialIndices: Record<string, number> = {};
    const initialHeroAnswers: Record<string, null> = {};

    for (let i = 1; i <= config.teamCount; i++) {
      const teamName = `Team ${i}`;
      initialScores[teamName] = 0;
      initialRounds[teamName] = 0;
      initialIndices[teamName] = 0;
      initialHeroAnswers[teamName] = null;
    }

    const newGameState: GameState = {
      isStarted: false,
      isFinished: false,
      startTime: null,
      scores: initialScores,
      currentHeroId: initialHeroes,
      heroAnswer: initialHeroAnswers,
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

      // 관리자로 로그인
      const adminUser: User = {
        id: 'admin_' + Date.now(),
        name: '관리자',
        team: 'Admin',
        role: UserRole.ADMIN,
        score: 0
      };
      setCurrentUser(adminUser);
      setError(null);
    } catch (err) {
      console.error('Failed to create room:', err);
      setError('방 생성에 실패했습니다.');
      throw err;
    }
  }, []);

  // 방 참가
  const joinRoom = useCallback(async (userData: Omit<User, 'id' | 'score'>): Promise<boolean> => {
    const roomRef = ref(database, `rooms/${FIXED_ROOM_ID}`);

    try {
      const snapshot = await get(roomRef);
      if (!snapshot.exists()) {
        setError('아직 방이 생성되지 않았습니다. 관리자가 먼저 방을 만들어야 합니다.');
        return false;
      }

      const newUser: User = {
        ...userData,
        id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        score: 0
      };

      // 참가자 추가
      const participantRef = ref(database, `rooms/${FIXED_ROOM_ID}/participants/${newUser.id}`);
      await set(participantRef, newUser);

      // 팀의 첫 번째 멤버면 히어로로 설정
      const roomData = snapshot.val();
      const existingParticipants = roomData.participants ? Object.values(roomData.participants) as User[] : [];
      const teamMembers = existingParticipants.filter((p: User) => p.team === newUser.team);

      if (teamMembers.length === 0 && userData.role === UserRole.TRAINEE) {
        const heroRef = ref(database, `rooms/${FIXED_ROOM_ID}/gameState/currentHeroId/${newUser.team}`);
        await set(heroRef, newUser.id);
      }

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
    if (currentUser) {
      const participantRef = ref(database, `rooms/${FIXED_ROOM_ID}/participants/${currentUser.id}`);
      remove(participantRef);
    }
    setCurrentUser(null);
  }, [currentUser]);

  // 방 초기화 (관리자용)
  const resetRoom = useCallback(async () => {
    const roomRef = ref(database, `rooms/${FIXED_ROOM_ID}`);
    await remove(roomRef);
    setCurrentUser(null);
  }, []);

  // 게임 시작
  const startGame = useCallback(() => {
    const gameStateRef = ref(database, `rooms/${FIXED_ROOM_ID}/gameState`);
    update(gameStateRef, {
      isStarted: true,
      isFinished: false,
      startTime: Date.now()
    });
  }, []);

  // 게임 종료
  const stopGame = useCallback(() => {
    const gameStateRef = ref(database, `rooms/${FIXED_ROOM_ID}/gameState`);
    update(gameStateRef, {
      isStarted: false,
      isFinished: true
    });
  }, []);

  // 게임 상태 업데이트
  const updateGameState = useCallback((newState: Partial<GameState>) => {
    const gameStateRef = ref(database, `rooms/${FIXED_ROOM_ID}/gameState`);
    update(gameStateRef, newState);
  }, []);

  // 히어로 답변 설정
  const setHeroAnswer = useCallback((team: string, answer: 'O' | 'X') => {
    const answerRef = ref(database, `rooms/${FIXED_ROOM_ID}/gameState/heroAnswer/${team}`);
    set(answerRef, answer);
  }, []);

  // 다음 라운드로 이동
  const nextRound = useCallback((team: string, nextHeroId: string, nextQuestionIdx: number) => {
    const currentScores = gameState.scores || {};
    const currentRoundCount = gameState.roundCount || {};

    const updates: Record<string, any> = {};
    updates[`gameState/scores/${team}`] = (currentScores[team] || 0) + 100;
    updates[`gameState/currentHeroId/${team}`] = nextHeroId;
    updates[`gameState/heroAnswer/${team}`] = null;
    updates[`gameState/questionIndices/${team}`] = nextQuestionIdx;
    updates[`gameState/roundCount/${team}`] = (currentRoundCount[team] || 0) + 1;

    const roomRef = ref(database, `rooms/${FIXED_ROOM_ID}`);
    update(roomRef, updates);
  }, [gameState]);

  return {
    roomConfig,
    gameState,
    participants,
    currentUser,
    isConnected,
    error,
    roomExists,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    stopGame,
    resetRoom,
    updateGameState,
    setHeroAnswer,
    nextRound
  };
};
