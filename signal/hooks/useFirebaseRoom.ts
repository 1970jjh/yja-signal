
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

  // 게임 액션
  setHeroAnswer: (team: string, answer: 'O' | 'X') => void;
  submitMemberAnswer: (odUserId: string, team: string, answer: 'O' | 'X') => void;
  changeQuestion: (team: string, direction: 'next' | 'prev' | number) => void;
  nextRound: (team: string) => void;

  refreshRoomList: () => Promise<void>;
}

const initialGameState: GameState = {
  isStarted: false,
  isFinished: false,
  startTime: null,
  currentHeroId: {},
  heroAnswer: {},
  currentQuestionIndex: {},
  questionHistory: {},
  heroHistory: {},
  individualScores: {},
  memberAnswers: {},
  roundCount: {}
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

        if (data.gameState) {
          setGameState({
            isStarted: data.gameState.isStarted ?? false,
            isFinished: data.gameState.isFinished ?? false,
            startTime: data.gameState.startTime ?? null,
            currentHeroId: data.gameState.currentHeroId ?? {},
            heroAnswer: data.gameState.heroAnswer ?? {},
            currentQuestionIndex: data.gameState.currentQuestionIndex ?? {},
            questionHistory: data.gameState.questionHistory ?? {},
            heroHistory: data.gameState.heroHistory ?? {},
            individualScores: data.gameState.individualScores ?? {},
            memberAnswers: data.gameState.memberAnswers ?? {},
            roundCount: data.gameState.roundCount ?? {}
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

  // 랜덤 질문 인덱스 4개 생성
  const generateQuestionHistory = useCallback((totalQuestions: number): number[] => {
    const indices: number[] = [];
    const used = new Set<number>();
    while (indices.length < 4 && indices.length < totalQuestions) {
      const idx = Math.floor(Math.random() * totalQuestions);
      if (!used.has(idx)) {
        used.add(idx);
        indices.push(idx);
      }
    }
    return indices;
  }, []);

  // 방 생성
  const createRoom = useCallback(async (config: RoomConfig): Promise<string> => {
    const roomId = 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const roomRef = ref(database, `rooms/${roomId}`);

    const newGameState: GameState = {
      isStarted: false,
      isFinished: false,
      startTime: null,
      currentHeroId: {},
      heroAnswer: {},
      currentQuestionIndex: {},
      questionHistory: {},
      heroHistory: {},
      individualScores: {},
      memberAnswers: {},
      roundCount: {}
    };

    try {
      await set(roomRef, {
        config,
        gameState: newGameState,
        participants: {},
        createdAt: Date.now()
      });

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

      const participantRef = ref(database, `rooms/${roomId}/participants/${newUser.id}`);
      await set(participantRef, newUser);

      // 개인 점수 초기화
      const scoreRef = ref(database, `rooms/${roomId}/gameState/individualScores/${newUser.id}`);
      await set(scoreRef, 0);

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

      if (currentRoomId === roomId) {
        setCurrentUser(null);
        setCurrentRoomId(null);
      }
    } catch (err) {
      console.error('Failed to delete room:', err);
      setError('방 삭제에 실패했습니다.');
    }
  }, [currentRoomId, refreshRoomList]);

  // 방 초기화
  const resetRoom = useCallback(async () => {
    if (currentRoomId) {
      await deleteRoom(currentRoomId);
    }
    setCurrentUser(null);
    setCurrentRoomId(null);
  }, [currentRoomId, deleteRoom]);

  // 게임 시작 - 각 팀별로 랜덤 주인공 선정
  const startGame = useCallback(async () => {
    if (!currentRoomId || !roomConfig) return;

    const roomRef = ref(database, `rooms/${currentRoomId}`);
    const snapshot = await get(roomRef);
    if (!snapshot.exists()) return;

    const data = snapshot.val();
    const allParticipants = data.participants ? Object.values(data.participants) as User[] : [];

    const newHeroIds: Record<string, string> = {};
    const newHeroHistory: Record<string, string[]> = {};
    const newQuestionHistory: Record<string, number[]> = {};
    const newCurrentQuestionIndex: Record<string, number> = {};
    const newMemberAnswers: Record<string, Record<string, null>> = {};

    for (let i = 1; i <= roomConfig.teamCount; i++) {
      const teamName = `팀 ${i}`;
      const teamMembers = allParticipants.filter((p: User) => p.team === teamName);

      if (teamMembers.length > 0) {
        // 랜덤으로 첫 주인공 선정
        const randomIdx = Math.floor(Math.random() * teamMembers.length);
        const firstHero = teamMembers[randomIdx];
        newHeroIds[teamName] = firstHero.id;
        newHeroHistory[teamName] = [firstHero.id];

        // 질문 4개 생성
        const questions = generateQuestionHistory(roomConfig.questions.length);
        newQuestionHistory[teamName] = questions;
        newCurrentQuestionIndex[teamName] = 0;

        // 팀원 답변 초기화
        newMemberAnswers[teamName] = {};
        teamMembers.forEach((m: User) => {
          newMemberAnswers[teamName][m.id] = null;
        });
      }
    }

    const gameStateRef = ref(database, `rooms/${currentRoomId}/gameState`);
    await update(gameStateRef, {
      isStarted: true,
      isFinished: false,
      startTime: Date.now(),
      currentHeroId: newHeroIds,
      heroAnswer: {},
      currentQuestionIndex: newCurrentQuestionIndex,
      questionHistory: newQuestionHistory,
      heroHistory: newHeroHistory,
      memberAnswers: newMemberAnswers,
      roundCount: {}
    });
  }, [currentRoomId, roomConfig, generateQuestionHistory]);

  // 게임 종료
  const stopGame = useCallback(() => {
    if (!currentRoomId) return;
    const gameStateRef = ref(database, `rooms/${currentRoomId}/gameState`);
    update(gameStateRef, {
      isStarted: false,
      isFinished: true
    });
  }, [currentRoomId]);

  // 주인공 답변 설정
  const setHeroAnswer = useCallback((team: string, answer: 'O' | 'X') => {
    if (!currentRoomId) return;
    const answerRef = ref(database, `rooms/${currentRoomId}/gameState/heroAnswer/${team}`);
    set(answerRef, answer);

    // 팀원 답변 초기화
    const memberAnswersRef = ref(database, `rooms/${currentRoomId}/gameState/memberAnswers/${team}`);
    get(ref(database, `rooms/${currentRoomId}/participants`)).then(snapshot => {
      if (snapshot.exists()) {
        const allParticipants = Object.values(snapshot.val()) as User[];
        const teamMembers = allParticipants.filter(p => p.team === team);
        const resetAnswers: Record<string, null> = {};
        teamMembers.forEach(m => {
          resetAnswers[m.id] = null;
        });
        set(memberAnswersRef, resetAnswers);
      }
    });
  }, [currentRoomId]);

  // 팀원 답변 제출 및 점수 계산
  const submitMemberAnswer = useCallback(async (odUserId: string, team: string, answer: 'O' | 'X') => {
    if (!currentRoomId) return;

    // 답변 저장
    const memberAnswerRef = ref(database, `rooms/${currentRoomId}/gameState/memberAnswers/${team}/${odUserId}`);
    await set(memberAnswerRef, answer);

    // 주인공 답변 확인
    const heroAnswerRef = ref(database, `rooms/${currentRoomId}/gameState/heroAnswer/${team}`);
    const heroSnapshot = await get(heroAnswerRef);
    const heroAnswer = heroSnapshot.val();

    // 정답이면 100점 추가
    if (heroAnswer && answer === heroAnswer) {
      const scoreRef = ref(database, `rooms/${currentRoomId}/gameState/individualScores/${odUserId}`);
      const scoreSnapshot = await get(scoreRef);
      const currentScore = scoreSnapshot.val() || 0;
      await set(scoreRef, currentScore + 100);
    }
  }, [currentRoomId]);

  // 질문 변경 (다른 질문보기)
  const changeQuestion = useCallback((team: string, direction: 'next' | 'prev' | number) => {
    if (!currentRoomId) return;

    const currentHistory = gameState.questionHistory[team] || [];
    const currentIdx = gameState.currentQuestionIndex[team] || 0;

    let newIdx: number;
    if (typeof direction === 'number') {
      newIdx = direction;
    } else if (direction === 'next') {
      newIdx = (currentIdx + 1) % currentHistory.length;
    } else {
      newIdx = (currentIdx - 1 + currentHistory.length) % currentHistory.length;
    }

    const questionIdxRef = ref(database, `rooms/${currentRoomId}/gameState/currentQuestionIndex/${team}`);
    set(questionIdxRef, newIdx);
  }, [currentRoomId, gameState]);

  // 다음 라운드 (새 주인공)
  const nextRound = useCallback(async (team: string) => {
    if (!currentRoomId || !roomConfig) return;

    const snapshot = await get(ref(database, `rooms/${currentRoomId}/participants`));
    if (!snapshot.exists()) return;

    const allParticipants = Object.values(snapshot.val()) as User[];
    const teamMembers = allParticipants.filter(p => p.team === team);
    if (teamMembers.length === 0) return;

    const heroHistory = gameState.heroHistory[team] || [];

    // 아직 주인공 안 한 사람 찾기
    let nextHero: User | undefined;
    const notYetHero = teamMembers.filter(m => !heroHistory.includes(m.id));

    if (notYetHero.length > 0) {
      // 아직 안 한 사람 중 랜덤
      const randomIdx = Math.floor(Math.random() * notYetHero.length);
      nextHero = notYetHero[randomIdx];
    } else {
      // 모두 했으면 다시 처음부터 (히스토리 리셋)
      const randomIdx = Math.floor(Math.random() * teamMembers.length);
      nextHero = teamMembers[randomIdx];
    }

    // 새 질문 4개 생성
    const newQuestions = generateQuestionHistory(roomConfig.questions.length);

    // 팀원 답변 초기화
    const resetAnswers: Record<string, null> = {};
    teamMembers.forEach(m => {
      resetAnswers[m.id] = null;
    });

    const updates: Record<string, any> = {};
    updates[`gameState/currentHeroId/${team}`] = nextHero?.id;
    updates[`gameState/heroAnswer/${team}`] = null;
    updates[`gameState/questionHistory/${team}`] = newQuestions;
    updates[`gameState/currentQuestionIndex/${team}`] = 0;
    updates[`gameState/memberAnswers/${team}`] = resetAnswers;
    updates[`gameState/roundCount/${team}`] = (gameState.roundCount[team] || 0) + 1;

    // 주인공 히스토리 업데이트
    if (notYetHero.length > 0) {
      updates[`gameState/heroHistory/${team}`] = [...heroHistory, nextHero?.id];
    } else {
      // 리셋
      updates[`gameState/heroHistory/${team}`] = [nextHero?.id];
    }

    const roomRef = ref(database, `rooms/${currentRoomId}`);
    await update(roomRef, updates);
  }, [currentRoomId, roomConfig, gameState, generateQuestionHistory]);

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
    setHeroAnswer,
    submitMemberAnswer,
    changeQuestion,
    nextRound,
    refreshRoomList
  };
};
