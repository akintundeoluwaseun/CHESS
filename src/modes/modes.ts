import type { Color } from '@/chess/types';
import { START_FEN } from '@/chess/types';
import type { ModeId, TimeControl } from '@/progression/types';
import { levelForRating } from '@/engine/levels';
import { uid } from '@/data/storage';

/**
 * Game modes are plain data. Adding a mode = adding an entry here plus (if it
 * needs one) a setup screen; the game screen reads only these flags.
 */
export interface ModeDef {
  id: ModeId | 'puzzles' | 'training' | 'challenges';
  title: string;
  subtitle: string;
  icon: string;
  route: string;
}

export const MODES: ModeDef[] = [
  { id: 'quick', title: 'Quick Game', subtitle: 'Jump straight in at your level', icon: 'flash-outline', route: '/quick' },
  { id: 'ai', title: 'Play vs AI', subtitle: '10 levels, from Beginner to Elite', icon: 'hardware-chip-outline', route: '/setup' },
  { id: 'ranked', title: 'Ranked', subtitle: 'Climb the rating ladder', icon: 'podium-outline', route: '/ranked' },
  { id: 'puzzles', title: 'Puzzles', subtitle: 'Tactics, forks, pins and mates', icon: 'extension-puzzle-outline', route: '/puzzles' },
  { id: 'training', title: 'Training', subtitle: 'Guided lessons', icon: 'school-outline', route: '/learn' },
  { id: 'challenges', title: 'Challenges', subtitle: 'A ladder of tough missions', icon: 'shield-checkmark-outline', route: '/challenges' },
  { id: 'local', title: 'Two Players', subtitle: 'Pass and play on one phone', icon: 'people-outline', route: '/setup?mode=local' },
];

export interface GameConfig {
  id: string;
  mode: ModeId;
  title: string;
  startFen: string;
  /** Human colour; null for local two-player. */
  playerColor: Color | null;
  aiLevel: number | null;
  timeControl: TimeControl;
  allowUndo: boolean;
  allowHints: boolean;
  rated: boolean;
  challengeId?: string;
  /** Challenge goal. */
  goal?: { kind: 'win' | 'notLose'; maxMoves?: number };
  /** Board view this game opens with (two-player games open in 3D). */
  view?: '2d' | '3d';
}

export function aiGameConfig(level: number, color: Color | 'random', tc: TimeControl): GameConfig {
  const playerColor: Color = color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color;
  return {
    id: uid('g'), mode: 'ai', title: 'vs AI', startFen: START_FEN, playerColor, aiLevel: level,
    timeControl: tc, allowUndo: true, allowHints: true, rated: false,
  };
}

export function quickGameConfig(rating: number): GameConfig {
  return {
    ...aiGameConfig(levelForRating(rating).id, 'random', { minutes: 10, increment: 0 }),
    mode: 'quick', title: 'Quick Game',
  };
}

export function rankedGameConfig(rating: number, tc: TimeControl): GameConfig {
  return {
    id: uid('g'), mode: 'ranked', title: 'Ranked', startFen: START_FEN,
    playerColor: Math.random() < 0.5 ? 'w' : 'b', aiLevel: levelForRating(rating).id,
    timeControl: tc, allowUndo: false, allowHints: false, rated: true,
  };
}

export function localGameConfig(tc: TimeControl): GameConfig {
  return {
    id: uid('g'), mode: 'local', title: 'Two Players', startFen: START_FEN, playerColor: null, aiLevel: null,
    timeControl: tc, allowUndo: true, allowHints: false, rated: false, view: '3d',
  };
}
