
import { useState, useEffect, useCallback } from 'react';
import { database, ref, set, get, onValue, update, remove } from '../firebase';
import { User, UserRole, RoomConfig, GameState } from '../types';

// 방 정보 타입
export interface RoomInfo {
  id: string;
  roomName: string;
  teamCount: number;
  createdAt: number;
  participantCount: number;
  isStarted: boolean;
}

interface UseFirebaseRoomReturn {
  // 상태
  roomConfig: RoomConfig | null;
  gameState: GameState;
  participants: User[];
  currentUser: User | null;
  isConnected: boolean;
  error: string | null;
  roomExists: boolean;
  currentRoomId: string | null;
  roomList: RoomInfo[];

  // 액션
  createRoom: (config: RoomConfig) => Promise<string>;
  joinRoom: (roomId: string, user: Omit<User, 'id' | 'score'>) => Promise<boolean>;
  joinRoomAsAdmin: (roomId: string) => Promise<boolean>;
  leaveRoom: () => void;
  deleteRoom: (roomId: string) => Promise<void>;
  startGame: () => void;
  stopGame: () => void;
  resetRoom: () => void;
  updateGameState: (newState: Partial<GameState>) => void;
  setHeroAnswer: (team: string, answer: 'O' | 'X') => void;
  nextRound: (team: string, nextHeroId: string, nextQuestionIdx: number) => void;
  refreshRoomList: () => Promise<void>;
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
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [roomList, setRoomList] = useState<RoomInfo[]>([]);

  // 방 목록 가져오기
  const refreshRoomList = useCallback(async () => {
    try {
      const roomsRef = ref(database, 'rooms');
      const snapshot = await get(roomsRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        const rooms: RoomInfo[] = Object.entries(data).map(([id, roomData]: [string, any]) => ({
          id,
          roomName: roomData.config?.roomName || '이름 없음',
          teamCount: roomData.config?.teamCount || 0,
          createdAt: roomData.createdAt || 0,
          participantCount: roomData.participants ? Object.keys(roomData.participants).length : 0,
          isStarted: roomData.gameState?.isStarted || false
        }));

        // 최신순 정렬
        rooms.sort((a, b) => b.createdAt - a.createdAt);
        setRoomList(rooms);
      } else {
        setRoomList([]);
      }
    } catch (err) {
      console.error('Failed to fetch room list:', err);
    }
  }, []);

  // 초기 방 목록 로드
  useEffect(() => {
    refreshRoomList();
  }, [refreshRoomList]);

  // 현재 방 데이터 실시간 구독
  useEffect(() => {
    if (!currentRoomId) {
      setRoomExists(false);
      setRoomConfig(null);
      setGameState(initialGameState);
      setParticipants([]);
      return;
    }

    const roomRef = ref(database, `rooms/${currentRoomId}`);

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
        // 방이 삭제됨
        setRoomExists(false);
        setRoomConfig(null);
        setGameState(initialGameState);
        setParticipants([]);
        setCurrentRoomId(null);
        setCurrentUser(null);
      }
    }, (err) => {
      console.error('Firebase error:', err);
      setError('연결 오류가 발생했습니다.');
      setIsConnected(false);
    });

    return () => unsubscribe();
  }, [currentRoomId]);

  // 방 생성 (새로운 고유 ID 생성)
  const createRoom = useCallback(async (config: RoomConfig): Promise<string> => {
    const roomId = 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const roomRef = ref(database, `rooms/${roomId}`);

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

      setCurrentRoomId(roomId);
      setCurrentUser(adminUser);
      setError(null);

      // 방 목록 갱신
      await refreshRoomList();

      return roomId;
    } catch (err) {
      console.error('Failed to create room:', err);
      setError('방 생성에 실패했습니다.');
      throw err;
    }
  }, [refreshRoomList]);

  // 기존 방에 관리자로 입장
  const joinRoomAsAdmin = useCallback(async (roomId: string): Promise<boolean> => {
    const roomRef = ref(database, `rooms/${roomId}`);

    try {
      const snapshot = await get(roomRef);
      if (!snapshot.exists()) {
        setError('방이 존재하지 않습니다.');
        return false;
      }

      const adminUser: User = {
        id: 'admin_' + Date.now(),
        name: '관리자',
        team: 'Admin',
        role: UserRole.ADMIN,
        score: 0
      };

      setCurrentRoomId(roomId);
      setCurrentUser(adminUser);
      setError(null);

      return true;
    } catch (err) {
      console.error('Failed to join room as admin:', err);
      setError('방 입장에 실패했습니다.');
      return false;
    }
  }, []);

  // 방 참가 (참가자)
  const joinRoom = useCallback(async (roomId: string, userData: Omit<User, 'id' | 'score'>): Promise<boolean> => {
    const roomRef = ref(database, `rooms/${roomId}`);

    try {
      const snapshot = await get(roomRef);
      if (!snapshot.exists()) {
        setError('방이 존재하지 않습니다.');
        return false;
      }

      const newUser: User = {
        ...userData,
        id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        score: 0
      };

      // 참가자 추가
      const participantRef = ref(database, `rooms/${roomId}/participants/${newUser.id}`);
      await set(participantRef, newUser);

      // 팀의 첫 번째 멤버면 히어로로 설정
      const roomData = snapshot.val();
      const existingParticipants = roomData.participants ? Object.values(roomData.participants) as User[] : [];
      const teamMembers = existingParticipants.filter((p: User) => p.team === newUser.team);

      if (teamMembers.length === 0 && userData.role === UserRole.TRAINEE) {
        const heroRef = ref(database, `rooms/${roomId}/gameState/currentHeroId/${newUser.team}`);
        await set(heroRef, newUser.id);
      }

      setCurrentRoomId(roomId);
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
    if (currentUser && currentRoomId) {
      const participantRef = ref(database, `rooms/${currentRoomId}/participants/${currentUser.id}`);
      remove(participantRef);
    }
    setCurrentUser(null);
    setCurrentRoomId(null);
  }, [currentUser, currentRoomId]);

  // 방 삭제
  const deleteRoom = useCallback(async (roomId: string) => {
    try {
      const roomRef = ref(database, `rooms/${roomId}`);
      await remove(roomRef);
      await refreshRoomList();

      // 현재 입장한 방이 삭제되면 나가기
      if (currentRoomId === roomId) {
        setCurrentUser(null);
        setCurrentRoomId(null);
      }
    } catch (err) {
      console.error('Failed to delete room:', err);
      setError('방 삭제에 실패했습니다.');
    }
  }, [currentRoomId, refreshRoomList]);

  // 방 초기화 (현재 방 삭제)
  const resetRoom = useCallback(async () => {
    if (currentRoomId) {
      await deleteRoom(currentRoomId);
    }
    setCurrentUser(null);
    setCurrentRoomId(null);
  }, [currentRoomId, deleteRoom]);

  // 게임 시작
  const startGame = useCallback(() => {
    if (!currentRoomId) return;
    const gameStateRef = ref(database, `rooms/${currentRoomId}/gameState`);
    update(gameStateRef, {
      isStarted: true,
      isFinished: false,
      startTime: Date.now()
    });
  }, [currentRoomId]);

  // 게임 종료
  const stopGame = useCallback(() => {
    if (!currentRoomId) return;
    const gameStateRef = ref(database, `rooms/${currentRoomId}/gameState`);
    update(gameStateRef, {
      isStarted: false,
      isFinished: true
    });
  }, [currentRoomId]);

  // 게임 상태 업데이트
  const updateGameState = useCallback((newState: Partial<GameState>) => {
    if (!currentRoomId) return;
    const gameStateRef = ref(database, `rooms/${currentRoomId}/gameState`);
    update(gameStateRef, newState);
  }, [currentRoomId]);

  // 히어로 답변 설정
  const setHeroAnswer = useCallback((team: string, answer: 'O' | 'X') => {
    if (!currentRoomId) return;
    const answerRef = ref(database, `rooms/${currentRoomId}/gameState/heroAnswer/${team}`);
    set(answerRef, answer);
  }, [currentRoomId]);

  // 다음 라운드로 이동
  const nextRound = useCallback((team: string, nextHeroId: string, nextQuestionIdx: number) => {
    if (!currentRoomId) return;

    const currentScores = gameState.scores || {};
    const currentRoundCount = gameState.roundCount || {};

    const updates: Record<string, any> = {};
    updates[`gameState/scores/${team}`] = (currentScores[team] || 0) + 100;
    updates[`gameState/currentHeroId/${team}`] = nextHeroId;
    updates[`gameState/heroAnswer/${team}`] = null;
    updates[`gameState/questionIndices/${team}`] = nextQuestionIdx;
    updates[`gameState/roundCount/${team}`] = (currentRoundCount[team] || 0) + 1;

    const roomRef = ref(database, `rooms/${currentRoomId}`);
    update(roomRef, updates);
  }, [currentRoomId, gameState]);

  return {
    roomConfig,
    gameState,
    participants,
    currentUser,
    isConnected,
    error,
    roomExists,
    currentRoomId,
    roomList,
    createRoom,
    joinRoom,
    joinRoomAsAdmin,
    leaveRoom,
    deleteRoom,
    startGame,
    stopGame,
    resetRoom,
    updateGameState,
    setHeroAnswer,
    nextRound,
    refreshRoomList
  };
};
