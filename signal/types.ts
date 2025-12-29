
export enum UserRole {
  ADMIN = 'ADMIN',
  TRAINEE = 'TRAINEE'
}

export interface User {
  id: string;
  name: string;
  team: string;
  role: UserRole;
  score: number;
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
  currentHeroId: Record<string, string>; // team: userId
  heroAnswer: Record<string, 'O' | 'X' | null>; // team: answer
  scores: Record<string, number>; // team: score
  roundCount: Record<string, number>; // team: round
  questionIndices: Record<string, number>; // team: index
}

export interface BroadcastMessage {
  type: 'SYNC' | 'START' | 'FINISH' | 'HERO_ANSWER' | 'NEXT_ROUND' | 'ADMIN_STOP';
  payload?: any;
}
