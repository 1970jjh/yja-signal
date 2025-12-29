
export enum UserRole {
  ADMIN = 'ADMIN',
  TRAINEE = 'TRAINEE'
}

export interface User {
  id: string;
  name: string;
  team: string;
  role: UserRole;
  score: number; // 개인 점수
}

export interface RoomConfig {
  roomName: string;
  teamCount: number;
  durationMinutes: number;
  questions: string[];
}

export interface GameState {
  isStarted: boolean;
  isFinished: boolean;
  startTime: number | null;

  // 팀별 현재 주인공 ID
  currentHeroId: Record<string, string>;

  // 팀별 주인공이 선택한 답변
  heroAnswer: Record<string, 'O' | 'X' | null>;

  // 팀별 현재 질문 인덱스
  currentQuestionIndex: Record<string, number>;

  // 팀별 질문 히스토리 (최대 4개, 주인공이 선택 가능한 질문들)
  questionHistory: Record<string, number[]>;

  // 팀별 주인공 했던 사람 목록
  heroHistory: Record<string, string[]>;

  // 개인별 점수 (odUserId: score)
  individualScores: Record<string, number>;

  // 팀별 팀원 답변 상태 (odUserId: answer)
  memberAnswers: Record<string, Record<string, 'O' | 'X' | null>>;

  // 라운드 카운트 (팀별)
  roundCount: Record<string, number>;
}

export interface BroadcastMessage {
  type: 'SYNC' | 'START' | 'FINISH' | 'HERO_ANSWER' | 'NEXT_ROUND' | 'ADMIN_STOP';
  payload?: any;
}
