
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
  revealResult: (team: string) => void;
  nextRound: (team: string) => void;
  skipToNextHero: (team: string) => void; // 관리자용 순서넘기기

  refreshRoomList: () => Promise<void>;
  restoreSession: () => Promise<boolean>; // 세션 복원
  clearSession: () => void; // 세션 삭제
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
  roundCount: {},
  resultRevealed: {},
  resultRevealedAt: {}
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
            roundCount: data.gameState.roundCount ?? {},
            resultRevealed: data.gameState.resultRevealed ?? {},
            resultRevealedAt: data.gameState.resultRevealedAt ?? {}
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

  // 주인공 이탈 감지 및 자동 교체
  useEffect(() => {
    if (!currentRoomId || !roomConfig || !gameState.isStarted || gameState.isFinished) return;

    const checkAndReplaceHero = async () => {
      const currentHeroIds = gameState.currentHeroId || {};

      for (const teamName of Object.keys(currentHeroIds)) {
        const heroId = currentHeroIds[teamName];
        const teamMembers = participants.filter(p => p.team === teamName);

        // 주인공이 팀원 목록에 없으면 자동 교체
        if (heroId && teamMembers.length > 0 && !teamMembers.find(m => m.id === heroId)) {
          console.log(`주인공 이탈 감지: ${teamName}, 자동 교체 실행`);

          const heroHistory = gameState.heroHistory[teamName] || [];
          const heroCountMap: Record<string, number> = {};
          teamMembers.forEach(m => {
            heroCountMap[m.id] = heroHistory.filter(id => id === m.id).length;
          });

          // 가장 적게 주인공 한 사람 선택
          const minCount = Math.min(...teamMembers.map(m => heroCountMap[m.id] || 0));
          const candidates = teamMembers.filter(m => (heroCountMap[m.id] || 0) === minCount);
          const randomIdx = Math.floor(Math.random() * candidates.length);
          const nextHero = candidates[randomIdx];

          if (nextHero) {
            // 새 질문 생성
            const indices: number[] = [];
            const used = new Set<number>();
            while (indices.length < 4 && indices.length < roomConfig.questions.length) {
              const idx = Math.floor(Math.random() * roomConfig.questions.length);
              if (!used.has(idx)) {
                used.add(idx);
                indices.push(idx);
              }
            }

            // 팀원 답변 초기화
            const resetAnswers: Record<string, null> = {};
            teamMembers.forEach(m => {
              resetAnswers[m.id] = null;
            });

            const updates: Record<string, any> = {};
            updates[`gameState/currentHeroId/${teamName}`] = nextHero.id;
            updates[`gameState/heroAnswer/${teamName}`] = null;
            updates[`gameState/questionHistory/${teamName}`] = indices;
            updates[`gameState/currentQuestionIndex/${teamName}`] = 0;
            updates[`gameState/memberAnswers/${teamName}`] = resetAnswers;
            updates[`gameState/resultRevealed/${teamName}`] = false;
            updates[`gameState/resultRevealedAt/${teamName}`] = null;

            const roomRef = ref(database, `rooms/${currentRoomId}`);
            await update(roomRef, updates);
          }
        }
      }
    };

    // 약간의 딜레이 후 체크 (동시 접속 안정화)
    const timeoutId = setTimeout(checkAndReplaceHero, 1000);
    return () => clearTimeout(timeoutId);
  }, [currentRoomId, roomConfig, gameState.isStarted, gameState.isFinished, gameState.currentHeroId, participants]);

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
      roundCount: {},
      resultRevealed: {},
      resultRevealedAt: {}
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

  // 방 참가 (참가자) - 동명이인 처리 및 게임 진행 중 참여 지원
  const joinRoom = useCallback(async (roomId: string, userData: Omit<User, 'id' | 'score'>): Promise<boolean> => {
    const roomRef = ref(database, `rooms/${roomId}`);

    try {
      const snapshot = await get(roomRef);
      if (!snapshot.exists()) {
        setError('방이 존재하지 않습니다.');
        return false;
      }

      const roomData = snapshot.val();
      const existingParticipants = roomData.participants ? Object.values(roomData.participants) as User[] : [];

      // 같은 팀에 같은 이름이 있으면 기존 사람 삭제 (동명이인 처리)
      const duplicateUser = existingParticipants.find(
        p => p.team === userData.team && p.name === userData.name
      );

      if (duplicateUser) {
        // 기존 사용자 삭제
        const duplicateRef = ref(database, `rooms/${roomId}/participants/${duplicateUser.id}`);
        await remove(duplicateRef);
        // 기존 사용자의 memberAnswers도 삭제
        const duplicateAnswerRef = ref(database, `rooms/${roomId}/gameState/memberAnswers/${userData.team}/${duplicateUser.id}`);
        await remove(duplicateAnswerRef);
      }

      const newUser: User = {
        ...userData,
        id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        score: duplicateUser ? (roomData.gameState?.individualScores?.[duplicateUser.id] || 0) : 0 // 기존 점수 유지
      };

      const participantRef = ref(database, `rooms/${roomId}/participants/${newUser.id}`);
      await set(participantRef, newUser);

      // 개인 점수 초기화 (동명이인이면 기존 점수 이전)
      const scoreRef = ref(database, `rooms/${roomId}/gameState/individualScores/${newUser.id}`);
      await set(scoreRef, newUser.score);

      // 게임이 진행 중이면 memberAnswers에 추가
      if (roomData.gameState?.isStarted && !roomData.gameState?.isFinished) {
        const memberAnswerRef = ref(database, `rooms/${roomId}/gameState/memberAnswers/${userData.team}/${newUser.id}`);
        await set(memberAnswerRef, null);
      }

      // 세션 저장
      saveSession(roomId, newUser);

      setCurrentRoomId(roomId);
      setCurrentUser(newUser);
      setError(null);

      return true;
    } catch (err) {
      console.error('Failed to join room:', err);
      setError('방 참가에 실패했습니다.');
      return false;
    }
  }, [saveSession]);

  // 방 나가기
  const leaveRoom = useCallback(() => {
    if (currentUser && currentRoomId) {
      const participantRef = ref(database, `rooms/${currentRoomId}/participants/${currentUser.id}`);
      remove(participantRef);
    }
    clearSession();
    setCurrentUser(null);
    setCurrentRoomId(null);
  }, [currentUser, currentRoomId, clearSession]);

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

  // 팀원 답변 제출 (점수는 결과공개 시 계산)
  const submitMemberAnswer = useCallback(async (odUserId: string, team: string, answer: 'O' | 'X') => {
    if (!currentRoomId) return;

    // 답변만 저장 (점수는 결과공개 시 계산)
    const memberAnswerRef = ref(database, `rooms/${currentRoomId}/gameState/memberAnswers/${team}/${odUserId}`);
    await set(memberAnswerRef, answer);
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

  // 결과 공개 (주인공이 버튼 클릭) - 이때 점수 계산
  const revealResult = useCallback(async (team: string) => {
    if (!currentRoomId) return;

    // 주인공 답변 가져오기
    const heroAnswerRef = ref(database, `rooms/${currentRoomId}/gameState/heroAnswer/${team}`);
    const heroSnapshot = await get(heroAnswerRef);
    const heroAnswer = heroSnapshot.val();

    if (!heroAnswer) return;

    // 팀원 답변 가져오기
    const memberAnswersRef = ref(database, `rooms/${currentRoomId}/gameState/memberAnswers/${team}`);
    const answersSnapshot = await get(memberAnswersRef);
    const memberAnswers = answersSnapshot.val() || {};

    // 정답 맞춘 팀원들에게 점수 부여
    const scoreUpdates: Record<string, any> = {};
    for (const [userId, answer] of Object.entries(memberAnswers)) {
      if (answer === heroAnswer) {
        const scoreRef = ref(database, `rooms/${currentRoomId}/gameState/individualScores/${userId}`);
        const scoreSnapshot = await get(scoreRef);
        const currentScore = scoreSnapshot.val() || 0;
        scoreUpdates[`gameState/individualScores/${userId}`] = currentScore + 100;
      }
    }

    // 결과 공개 상태 업데이트 + 점수 업데이트
    const roomRef = ref(database, `rooms/${currentRoomId}`);
    await update(roomRef, {
      ...scoreUpdates,
      [`gameState/resultRevealed/${team}`]: true,
      [`gameState/resultRevealedAt/${team}`]: Date.now()
    });
  }, [currentRoomId]);

  // 다음 라운드 (새 주인공)
  const nextRound = useCallback(async (team: string) => {
    if (!currentRoomId || !roomConfig) return;

    const snapshot = await get(ref(database, `rooms/${currentRoomId}/participants`));
    if (!snapshot.exists()) return;

    const allParticipants = Object.values(snapshot.val()) as User[];
    const teamMembers = allParticipants.filter(p => p.team === team);
    if (teamMembers.length === 0) return;

    const heroHistory = gameState.heroHistory[team] || [];

    // 각 멤버별 주인공 횟수 계산
    const heroCountMap: Record<string, number> = {};
    teamMembers.forEach(m => {
      heroCountMap[m.id] = heroHistory.filter(id => id === m.id).length;
    });

    // 3회 미만인 사람들 중 가장 적게 한 사람 찾기
    const eligibleMembers = teamMembers.filter(m => heroCountMap[m.id] < 3);

    let nextHero: User | undefined;
    if (eligibleMembers.length > 0) {
      // 가장 적게 주인공 한 횟수 찾기
      const minCount = Math.min(...eligibleMembers.map(m => heroCountMap[m.id]));
      // 그 횟수와 같은 사람들 중 랜덤 선택
      const candidates = eligibleMembers.filter(m => heroCountMap[m.id] === minCount);
      const randomIdx = Math.floor(Math.random() * candidates.length);
      nextHero = candidates[randomIdx];
    } else {
      // 모두 3회 완료 - 게임 계속하려면 가장 적은 사람 선택
      const minCount = Math.min(...teamMembers.map(m => heroCountMap[m.id]));
      const candidates = teamMembers.filter(m => heroCountMap[m.id] === minCount);
      const randomIdx = Math.floor(Math.random() * candidates.length);
      nextHero = candidates[randomIdx];
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
    updates[`gameState/resultRevealed/${team}`] = false;
    updates[`gameState/resultRevealedAt/${team}`] = null;

    // 주인공 히스토리 - 항상 누적 (리셋하지 않음)
    updates[`gameState/heroHistory/${team}`] = [...heroHistory, nextHero?.id];

    const roomRef = ref(database, `rooms/${currentRoomId}`);
    await update(roomRef, updates);
  }, [currentRoomId, roomConfig, gameState, generateQuestionHistory]);

  // 관리자용 순서넘기기 (현재 주인공 스킵)
  const skipToNextHero = useCallback(async (team: string) => {
    if (!currentRoomId || !roomConfig) return;

    const snapshot = await get(ref(database, `rooms/${currentRoomId}/participants`));
    if (!snapshot.exists()) return;

    const allParticipants = Object.values(snapshot.val()) as User[];
    const teamMembers = allParticipants.filter(p => p.team === team);
    if (teamMembers.length === 0) return;

    const heroHistory = gameState.heroHistory[team] || [];
    const currentHeroId = gameState.currentHeroId[team];

    // 각 멤버별 주인공 횟수 계산
    const heroCountMap: Record<string, number> = {};
    teamMembers.forEach(m => {
      heroCountMap[m.id] = heroHistory.filter(id => id === m.id).length;
    });

    // 현재 주인공 제외하고 선택
    const otherMembers = teamMembers.filter(m => m.id !== currentHeroId);
    if (otherMembers.length === 0) {
      // 혼자라면 그대로 유지
      return;
    }

    // 3회 미만인 사람들 중 가장 적게 한 사람
    const eligibleMembers = otherMembers.filter(m => heroCountMap[m.id] < 3);

    let nextHero: User | undefined;
    if (eligibleMembers.length > 0) {
      const minCount = Math.min(...eligibleMembers.map(m => heroCountMap[m.id]));
      const candidates = eligibleMembers.filter(m => heroCountMap[m.id] === minCount);
      const randomIdx = Math.floor(Math.random() * candidates.length);
      nextHero = candidates[randomIdx];
    } else {
      const minCount = Math.min(...otherMembers.map(m => heroCountMap[m.id]));
      const candidates = otherMembers.filter(m => heroCountMap[m.id] === minCount);
      const randomIdx = Math.floor(Math.random() * candidates.length);
      nextHero = candidates[randomIdx];
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
    updates[`gameState/resultRevealed/${team}`] = false;
    updates[`gameState/resultRevealedAt/${team}`] = null;
    updates[`gameState/heroHistory/${team}`] = [...heroHistory, nextHero?.id];

    const roomRef = ref(database, `rooms/${currentRoomId}`);
    await update(roomRef, updates);
  }, [currentRoomId, roomConfig, gameState, generateQuestionHistory]);

  // 세션 저장
  const saveSession = useCallback((roomId: string, user: User) => {
    try {
      localStorage.setItem('yja-signal-session', JSON.stringify({ roomId, user, timestamp: Date.now() }));
    } catch (e) {
      console.error('Failed to save session:', e);
    }
  }, []);

  // 세션 복원
  const restoreSession = useCallback(async (): Promise<boolean> => {
    try {
      const saved = localStorage.getItem('yja-signal-session');
      if (!saved) return false;

      const { roomId, user, timestamp } = JSON.parse(saved);

      // 24시간 이상 지난 세션은 무시
      if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('yja-signal-session');
        return false;
      }

      // 방이 존재하는지 확인
      const roomRef = ref(database, `rooms/${roomId}`);
      const snapshot = await get(roomRef);
      if (!snapshot.exists()) {
        localStorage.removeItem('yja-signal-session');
        return false;
      }

      // 관리자인 경우
      if (user.role === UserRole.ADMIN) {
        setCurrentRoomId(roomId);
        setCurrentUser(user);
        return true;
      }

      // 참가자인 경우 - 기존 사용자가 있는지 확인 후 복원
      const participantRef = ref(database, `rooms/${roomId}/participants/${user.id}`);
      const participantSnapshot = await get(participantRef);

      if (participantSnapshot.exists()) {
        // 기존 참가자 정보가 있으면 그대로 복원
        setCurrentRoomId(roomId);
        setCurrentUser(user);
        return true;
      } else {
        // 참가자 정보가 없으면 다시 등록
        await set(participantRef, user);
        const scoreRef = ref(database, `rooms/${roomId}/gameState/individualScores/${user.id}`);
        const scoreSnapshot = await get(scoreRef);
        if (!scoreSnapshot.exists()) {
          await set(scoreRef, 0);
        }
        setCurrentRoomId(roomId);
        setCurrentUser(user);
        return true;
      }
    } catch (e) {
      console.error('Failed to restore session:', e);
      localStorage.removeItem('yja-signal-session');
      return false;
    }
  }, []);

  // 세션 삭제
  const clearSession = useCallback(() => {
    localStorage.removeItem('yja-signal-session');
  }, []);

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
    revealResult,
    nextRound,
    skipToNextHero,
    refreshRoomList,
    restoreSession,
    clearSession
  };
};
