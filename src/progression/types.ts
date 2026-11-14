import type { Color, GameResult } from '@/chess/types';

export type ModeId = 'ai' | 'quick' | 'ranked' | 'local' | 'challenge';

export interface TimeControl {
  /** Minutes; 0 = untimed */
  minutes: number;
  increment: number; // seconds
}

export interface GameRecord {
  id: string;
  mode: ModeId;
  startedAt: number;
  endedAt: number;
  startFen: string;
  uci: string[];
  san: string[];
  /** Human's colour; null in local two-player games. */
  playerColor: Color | null;
  aiLevel: number | null;
  result: GameResult;
  outcome: 'win' | 'loss' | 'draw' | null;
  ratingBefore?: number;
  ratingAfter?: number;
  xpEarned: number;
  timeControl: TimeControl;
  usedUndo: boolean;
  hintsUsed: number;
  renderMode: '2d' | '3d';
  challengeId?: string;
}

export interface MissionState {
  id: string;
  progress: number;
  done: boolean;
}

export interface ProgressState {
  username: string;
  avatar: number;
  createdAt: number;
  xp: number;
  rating: number;
  ratedGames: number;
  bestRating: number;
  ratingHistory: { t: number; r: number }[];
  puzzleRating: number;
  puzzleHistory: { t: number; r: number }[];
  streak: { current: number; best: number; lastDay: string | null };
  counters: {
    gamesPlayed: number;
    aiGames: number;
    wins: number;
    losses: number;
    draws: number;
    localGames: number;
    winStreak: number;
    bestWinStreak: number;
    highestLevelBeaten: number;
    puzzlesSolved: number;
    puzzlesAttempted: number;
    puzzleStreak: number;
    bestPuzzleStreak: number;
    lessonsCompleted: number;
    challengesCompleted: number;
    games3d: number;
    checkmatesDelivered: number;
    promotions: number;
  };
  solvedPuzzles: Record<string, number>;
  completedLessons: Record<string, number>;
  completedChallenges: Record<string, number>;
  achievements: Record<string, number>;
  missions: {
    day: string;
    daily: MissionState[];
    dailyBonusClaimed: boolean;
    week: string;
    weekly: MissionState[];
  };
}

export type ProgressEvent =
  | { type: 'game'; record: GameRecord; mateByPiece?: string | null; promoted: boolean; castled: boolean; minMaterial: number }
  | { type: 'puzzle'; id: string; rating: number; solved: boolean; daily: boolean; hintsUsed: number }
  | { type: 'lesson'; id: string }
  | { type: 'challenge'; id: string; tier: number };

export type Reward =
  | { kind: 'xp'; amount: number; label: string }
  | { kind: 'level'; level: number }
  | { kind: 'achievement'; id: string }
  | { kind: 'mission'; id: string; title: string }
  | { kind: 'unlock'; item: string; label: string }
  | { kind: 'rating'; before: number; after: number; label: string };
