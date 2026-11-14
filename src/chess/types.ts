import type { Square, PieceSymbol, Color } from 'chess.js';

export type { Square, PieceSymbol, Color };

export interface MoveRecord {
  uci: string;
  san: string;
  from: Square;
  to: Square;
  color: Color;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  flags: string;
  fenBefore: string;
  fenAfter: string;
  /** Milliseconds the mover spent on this move (if timed). */
  spentMs?: number;
}

export type ResultReason =
  | 'checkmate'
  | 'stalemate'
  | 'threefold'
  | 'fifty-move'
  | 'insufficient'
  | 'resign'
  | 'timeout'
  | 'timeout-vs-insufficient'
  | 'agreement'
  | 'challenge-limit';

export interface GameResult {
  /** null means draw */
  winner: Color | null;
  reason: ResultReason;
}

export const RESULT_TEXT: Record<ResultReason, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  threefold: 'Threefold repetition',
  'fifty-move': '50-move rule',
  insufficient: 'Insufficient material',
  resign: 'Resignation',
  timeout: 'Time ran out',
  'timeout-vs-insufficient': 'Time ran out — opponent cannot mate',
  agreement: 'Draw agreed',
  'challenge-limit': 'Move limit reached',
};

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const PIECE_NAME: Record<PieceSymbol, string> = {
  p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king',
};

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

export function squareToCoords(sq: Square): { file: number; rank: number } {
  return { file: sq.charCodeAt(0) - 97, rank: Number(sq[1]) - 1 };
}
export function coordsToSquare(file: number, rank: number): Square {
  return (FILES[file] + String(rank + 1)) as Square;
}
export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
