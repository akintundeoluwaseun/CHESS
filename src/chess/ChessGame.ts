import { Chess, Move } from 'chess.js';
import {
  Color, GameResult, MoveRecord, PieceSymbol, PIECE_VALUE, Square, START_FEN, other,
} from './types';

/**
 * The single source of truth for chess rules. Wraps chess.js (a well-tested
 * rules library). Nothing else in the app decides legality — engine moves,
 * puzzle moves and user moves all pass through `move()`.
 */
export class ChessGame {
  private chess: Chess;
  readonly startFen: string;
  private records: MoveRecord[] = [];

  constructor(startFen: string = START_FEN, uciMoves: string[] = []) {
    this.startFen = startFen;
    this.chess = new Chess(startFen);
    for (const m of uciMoves) {
      if (!this.moveUci(m)) throw new Error(`Illegal move in history: ${m}`);
    }
  }

  /** Legal FEN *and* legal position (the side not to move may not be in check). */
  static isValidFen(fen: string): boolean {
    return isLegalPosition(fen);
  }

  fen(): string { return this.chess.fen(); }
  turn(): Color { return this.chess.turn(); }
  history(): MoveRecord[] { return this.records; }
  uciHistory(): string[] { return this.records.map((r) => r.uci); }
  lastMove(): MoveRecord | undefined { return this.records[this.records.length - 1]; }
  plyCount(): number { return this.records.length; }
  inCheck(): boolean { return this.chess.inCheck(); }

  board() { return this.chess.board(); }
  get(sq: Square) { return this.chess.get(sq); }

  legalTargets(from: Square): Square[] {
    return this.chess.moves({ square: from, verbose: true }).map((m) => m.to as Square);
  }
  legalMovesUci(): string[] {
    return this.chess.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
  }
  isPromotion(from: Square, to: Square): boolean {
    return this.chess
      .moves({ square: from, verbose: true })
      .some((m) => m.to === to && !!m.promotion);
  }
  isLegal(uci: string): boolean {
    return this.legalMovesUci().includes(uci);
  }

  kingSquare(color: Color): Square | null {
    const found = this.chess.findPiece({ type: 'k', color });
    return (found[0] as Square) ?? null;
  }

  /** Make a move given in UCI notation (e2e4, e7e8q). Returns null if illegal. */
  moveUci(uci: string, spentMs?: number): MoveRecord | null {
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promotion = (uci[4] as PieceSymbol | undefined) ?? undefined;
    return this.move(from, to, promotion, spentMs);
  }

  move(from: Square, to: Square, promotion?: PieceSymbol, spentMs?: number): MoveRecord | null {
    let m: Move;
    try {
      const needsPromo = this.isPromotion(from, to);
      if (needsPromo && !promotion) return null;
      m = this.chess.move({ from, to, promotion: needsPromo ? promotion : undefined });
    } catch {
      return null;
    }
    const rec: MoveRecord = {
      uci: m.from + m.to + (m.promotion ?? ''),
      san: m.san,
      from: m.from as Square,
      to: m.to as Square,
      color: m.color,
      piece: m.piece,
      captured: m.captured,
      promotion: m.promotion,
      flags: m.flags,
      fenBefore: m.before,
      fenAfter: m.after,
      spentMs,
    };
    this.records.push(rec);
    return rec;
  }

  undo(): MoveRecord | null {
    const m = this.chess.undo();
    if (!m) return null;
    return this.records.pop() ?? null;
  }

  /** Rule-based game end (checkmate, stalemate and all automatic draws). */
  status(): GameResult | null {
    const c = this.chess;
    if (c.isCheckmate()) return { winner: other(c.turn()), reason: 'checkmate' };
    if (c.isStalemate()) return { winner: null, reason: 'stalemate' };
    if (c.isInsufficientMaterial()) return { winner: null, reason: 'insufficient' };
    if (c.isThreefoldRepetition()) return { winner: null, reason: 'threefold' };
    if (c.isDrawByFiftyMoves()) return { winner: null, reason: 'fifty-move' };
    return null;
  }

  /** FIDE 6.9: flag fall is a draw if the opponent cannot possibly mate. */
  timeoutResult(flagged: Color): GameResult {
    const winner = other(flagged);
    if (!hasMatingMaterial(this.fen(), winner)) return { winner: null, reason: 'timeout-vs-insufficient' };
    return { winner, reason: 'timeout' };
  }

  pgn(headers: Record<string, string> = {}): string {
    const c = new Chess(this.startFen);
    if (this.startFen !== START_FEN) {
      c.setHeader('SetUp', '1');
      c.setHeader('FEN', this.startFen);
    }
    for (const [k, v] of Object.entries(headers)) c.setHeader(k, v);
    for (const r of this.records) c.move({ from: r.from, to: r.to, promotion: r.promotion });
    return c.pgn();
  }
}

/** Whether `color` has enough material to ever deliver mate (lenient FIDE reading). */
export function hasMatingMaterial(fen: string, color: Color): boolean {
  const all = new Chess(fen).board().flat().filter(Boolean) as { type: PieceSymbol; color: Color }[];
  const mine = all.filter((p) => p.color === color && p.type !== 'k').map((p) => p.type);
  const theirs = all.filter((p) => p.color !== color && p.type !== 'k');
  if (mine.length === 0) return false;
  if (mine.some((t) => t === 'p' || t === 'r' || t === 'q')) return true;
  if (mine.length >= 2) return true;
  // A lone minor piece can only mate if the opponent has pieces that can block their own king.
  return theirs.length > 0;
}

export interface MaterialInfo {
  /** Pieces captured BY white (i.e. black pieces missing), and vice versa. */
  capturedBy: Record<Color, PieceSymbol[]>;
  /** Positive: white is ahead. */
  diff: number;
}

const ORDER: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p'];

export function materialFromHistory(history: MoveRecord[]): MaterialInfo {
  const capturedBy: Record<Color, PieceSymbol[]> = { w: [], b: [] };
  let diff = 0;
  for (const m of history) {
    if (m.captured) {
      capturedBy[m.color].push(m.captured);
      diff += (m.color === 'w' ? 1 : -1) * PIECE_VALUE[m.captured];
    }
    if (m.promotion) diff += (m.color === 'w' ? 1 : -1) * (PIECE_VALUE[m.promotion] - 1);
  }
  for (const c of ['w', 'b'] as Color[]) {
    capturedBy[c].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  }
  return { capturedBy, diff };
}

/** Material balance computed directly from a FEN (positive = white ahead). */
export function materialBalance(fen: string): number {
  let s = 0;
  for (const row of new Chess(fen).board())
    for (const p of row) if (p) s += (p.color === 'w' ? 1 : -1) * PIECE_VALUE[p.type];
  return s;
}

/** chess.js accepts positions where the side NOT to move is in check; engines crash on those. */
export function isLegalPosition(fen: string): boolean {
  try {
    const c = new Chess(fen);
    const parts = fen.split(' ');
    parts[1] = parts[1] === 'w' ? 'b' : 'w';
    parts[3] = '-';
    const flipped = new Chess(parts.join(' '));
    if (flipped.inCheck()) return false;
    const kings = c.board().flat().filter((p) => p?.type === 'k');
    return kings.length === 2 && kings[0]!.color !== kings[1]!.color;
  } catch {
    return false;
  }
}
