import { START_FEN } from '@/chess/types';
import type { Color } from '@/chess/types';
import type { TimeControl } from '@/progression/types';

export interface ChallengeDef {
  id: string;
  tier: number; // 1..5
  title: string;
  description: string;
  fen: string;
  playerColor: Color;
  level: number;
  goal: { kind: 'win' | 'notLose'; maxMoves?: number };
  timeControl: TimeControl;
}

const untimed: TimeControl = { minutes: 0, increment: 0 };

/** Ordered ladder; each challenge unlocks the next. */
export const CHALLENGES: ChallengeDef[] = [
  { id: 'c01', tier: 1, title: 'First Steps', description: 'Beat the Beginner AI with the white pieces.',
    fen: START_FEN, playerColor: 'w', level: 1, goal: { kind: 'win' }, timeControl: untimed },
  { id: 'c02', tier: 1, title: 'Queen Power', description: 'Checkmate a lone king with king and queen within 15 moves. The engine defends perfectly.',
    fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', playerColor: 'w', level: 10, goal: { kind: 'win', maxMoves: 15 }, timeControl: untimed },
  { id: 'c03', tier: 1, title: 'Other Side', description: 'Beat the Easy AI playing Black.',
    fen: START_FEN, playerColor: 'b', level: 2, goal: { kind: 'win' }, timeControl: untimed },
  { id: 'c04', tier: 2, title: 'Rook Roller', description: 'Checkmate with king and rook within 25 moves against perfect defence.',
    fen: '8/8/8/3k4/8/8/8/R3K3 w - - 0 1', playerColor: 'w', level: 10, goal: { kind: 'win', maxMoves: 25 }, timeControl: untimed },
  { id: 'c05', tier: 2, title: 'Knight Odds', description: 'Black starts without a knight. Convert the extra piece against the Skilled AI.',
    fen: 'r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', playerColor: 'w', level: 5, goal: { kind: 'win' }, timeControl: untimed },
  { id: 'c06', tier: 2, title: 'Swift Victory', description: 'Beat the Casual AI in 40 moves or fewer.',
    fen: START_FEN, playerColor: 'w', level: 3, goal: { kind: 'win', maxMoves: 40 }, timeControl: untimed },
  { id: 'c07', tier: 3, title: 'Club Level', description: 'Beat the Intermediate AI.',
    fen: START_FEN, playerColor: 'w', level: 4, goal: { kind: 'win' }, timeControl: untimed },
  { id: 'c08', tier: 3, title: 'Queen Odds', description: 'Black has no queen — but the Expert AI is at the wheel. Win the game.',
    fen: 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', playerColor: 'w', level: 7, goal: { kind: 'win' }, timeControl: untimed },
  { id: 'c09', tier: 3, title: 'Iron Defence', description: 'Survive 40 moves as Black against the Expert AI without losing.',
    fen: START_FEN, playerColor: 'b', level: 7, goal: { kind: 'notLose', maxMoves: 40 }, timeControl: untimed },
  { id: 'c10', tier: 4, title: 'Bishop Pair', description: 'Mate with two bishops within 40 moves against perfect defence.',
    fen: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1', playerColor: 'w', level: 10, goal: { kind: 'win', maxMoves: 40 }, timeControl: untimed },
  { id: 'c11', tier: 4, title: 'Skilled Opponent', description: 'Beat the Skilled AI playing Black.',
    fen: START_FEN, playerColor: 'b', level: 5, goal: { kind: 'win' }, timeControl: untimed },
  { id: 'c12', tier: 4, title: 'Advanced Test', description: 'Beat the Advanced AI.',
    fen: START_FEN, playerColor: 'w', level: 6, goal: { kind: 'win' }, timeControl: untimed },
  { id: 'c13', tier: 5, title: 'Rook Odds Master', description: 'Black is missing a rook, but the Master AI is defending. Win.',
    fen: '1nbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w Kk - 0 1', playerColor: 'w', level: 8, goal: { kind: 'win' }, timeControl: untimed },
  { id: 'c14', tier: 5, title: 'Expert Slayer', description: 'Beat the Expert AI in a fair game.',
    fen: START_FEN, playerColor: 'w', level: 7, goal: { kind: 'win' }, timeControl: untimed },
  { id: 'c15', tier: 5, title: 'Grandmaster', description: 'Beat the Grandmaster AI. Few ever will.',
    fen: START_FEN, playerColor: 'w', level: 9, goal: { kind: 'win' }, timeControl: untimed },
];

export function challengeUnlocked(index: number, completed: Record<string, number>): boolean {
  return index === 0 || !!completed[CHALLENGES[index - 1].id];
}
