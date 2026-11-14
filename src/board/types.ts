import type { Color, Square } from '@/chess/types';
import type { TrackedPiece } from '@/chess/pieceIds';

export interface BoardMarker {
  square: Square;
  kind: 'good' | 'bad' | 'info';
}

/** Everything a board renderer (2D or 3D) needs. Both renderers share this contract. */
export interface BoardProps {
  pieces: TrackedPiece[];
  /** Piece captured by the last move (for capture animation). */
  captured?: TrackedPiece | null;
  orientation: Color;
  size: number;
  selected?: Square | null;
  targets?: Square[];
  lastMove?: { from: Square; to: Square } | null;
  checkSquare?: Square | null;
  hint?: { from: Square; to: Square } | null;
  markers?: BoardMarker[];
  highlights?: Square[];
  interactive?: boolean;
  /** Colour(s) the user may pick up (for drag). null = none. */
  movableColor?: Color | 'both' | null;
  onSquarePress?: (sq: Square) => void;
  onDrop?: (from: Square, to: Square) => void;
}
