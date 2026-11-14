import { Chess } from 'chess.js';
import type { Color, MoveRecord, PieceSymbol, Square } from './types';

export interface TrackedPiece {
  id: string;
  type: PieceSymbol;
  color: Color;
  square: Square;
}

/**
 * Assigns stable identities to pieces so renderers can animate a piece from
 * its old square to its new one (including castling rooks, en passant and
 * promotions). Returns the live pieces plus the piece captured on the last move.
 */
export function trackPieces(
  startFen: string,
  moves: MoveRecord[],
): { pieces: TrackedPiece[]; lastCaptured: TrackedPiece | null } {
  const bySquare = new Map<string, TrackedPiece>();
  const board = new Chess(startFen).board();
  let n = 0;
  for (const row of board)
    for (const p of row)
      if (p) {
        const piece = { id: `${p.color}${p.type}${n++}`, type: p.type, color: p.color, square: p.square as Square };
        bySquare.set(p.square, piece);
      }

  let lastCaptured: TrackedPiece | null = null;
  moves.forEach((m, i) => {
    const isLast = i === moves.length - 1;
    const mover = bySquare.get(m.from);
    if (!mover) return;
    let capSq: string | null = null;
    if (m.flags.includes('e')) capSq = m.to[0] + m.from[1];
    else if (m.captured) capSq = m.to;
    if (capSq) {
      const cap = bySquare.get(capSq) ?? null;
      bySquare.delete(capSq);
      if (isLast) lastCaptured = cap;
    } else if (isLast) lastCaptured = null;
    bySquare.delete(m.from);
    mover.square = m.to;
    if (m.promotion) mover.type = m.promotion;
    bySquare.set(m.to, mover);
    if (m.flags.includes('k') || m.flags.includes('q')) {
      const rank = m.color === 'w' ? '1' : '8';
      const [rf, rt] = m.flags.includes('k') ? ['h', 'f'] : ['a', 'd'];
      const rook = bySquare.get(rf + rank);
      if (rook) {
        bySquare.delete(rf + rank);
        rook.square = (rt + rank) as Square;
        bySquare.set(rt + rank, rook);
      }
    }
  });
  return { pieces: [...bySquare.values()].map((p) => ({ ...p })), lastCaptured };
}
