import { Chess, Square as CSquare } from 'chess.js';
import { materialBalance } from '@/chess/ChessGame';
import { Color, PIECE_NAME, PIECE_VALUE, PieceSymbol, Square, other } from '@/chess/types';
import { Eval, scoreValue, winChance } from './uci';

/**
 * Turns engine numbers into plain-language coaching. The engine supplies the
 * evaluation and best lines; this module inspects positions with the rules
 * library to *name* what is happening (captures, forks, pins, hanging pieces,
 * mate threats) so the explanation is grounded in the actual position.
 */

export type Classification = 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'book' | 'forced';

export const CLASS_LABEL: Record<Classification, string> = {
  best: 'Best move', excellent: 'Excellent', good: 'Good', inaccuracy: 'Inaccuracy',
  mistake: 'Mistake', blunder: 'Blunder', book: 'Opening', forced: 'Only move',
};
export const CLASS_SYMBOL: Record<Classification, string> = {
  best: '★', excellent: '!', good: '✓', inaccuracy: '?!', mistake: '?', blunder: '??', book: '◆', forced: '□',
};

export function uciToSan(fen: string, uci: string): string {
  try {
    const c = new Chess(fen);
    return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return uci;
  }
}

/** Win chance (0..1) for the mover, from a side-to-move score. */
export function moverWin(score: Eval): number {
  if (score.mate !== undefined) return score.mate > 0 ? 1 : 0;
  return winChance(score.cp ?? 0);
}

export function classify(winBefore: number, winAfter: number, playedIsBest: boolean, legalCount: number): Classification {
  if (legalCount === 1) return 'forced';
  const drop = winBefore - winAfter;
  if (playedIsBest || drop <= 0.01) return 'best';
  if (drop < 0.03) return 'excellent';
  if (drop < 0.06) return 'good';
  if (drop < 0.12) return 'inaccuracy';
  if (drop < 0.22) return 'mistake';
  return 'blunder';
}

function pieceAt(c: Chess, sq: string) {
  return c.get(sq as CSquare) ?? null;
}

/** Enemy pieces attacked by the piece standing on `sq`. */
function attackedTargets(c: Chess, sq: Square, color: Color): { sq: Square; type: PieceSymbol }[] {
  const out: { sq: Square; type: PieceSymbol }[] = [];
  for (const row of c.board())
    for (const p of row)
      if (p && p.color !== color && c.attackers(p.square, color).includes(sq as CSquare))
        out.push({ sq: p.square as Square, type: p.type });
  return out;
}

/** Own pieces that can be captured for profit (undefended, or attacked by a cheaper piece). */
export function hangingPieces(fen: string, color: Color): { sq: Square; type: PieceSymbol }[] {
  const c = new Chess(fen);
  const out: { sq: Square; type: PieceSymbol }[] = [];
  for (const row of c.board())
    for (const p of row) {
      if (!p || p.color !== color || p.type === 'k') continue;
      const attackers = c.attackers(p.square, other(color));
      if (!attackers.length) continue;
      const defenders = c.attackers(p.square, color);
      const cheapest = Math.min(...attackers.map((a) => PIECE_VALUE[pieceAt(c, a)!.type] || 100));
      if (!defenders.length || cheapest < PIECE_VALUE[p.type]) out.push({ sq: p.square as Square, type: p.type });
    }
  return out.sort((a, b) => PIECE_VALUE[b.type] - PIECE_VALUE[a.type]);
}

const DIRS: Record<string, [number, number][]> = {
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
};

/** Pins / skewers created by a sliding piece on `sq`. */
function lineTactics(c: Chess, sq: Square, color: Color): { kind: 'pin' | 'skewer'; front: PieceSymbol; back: PieceSymbol } | null {
  const p = pieceAt(c, sq);
  if (!p || !DIRS[p.type]) return null;
  const f0 = sq.charCodeAt(0) - 97;
  const r0 = Number(sq[1]) - 1;
  for (const [df, dr] of DIRS[p.type]) {
    const hits: { type: PieceSymbol; color: Color }[] = [];
    let f = f0 + df, r = r0 + dr;
    while (f >= 0 && f < 8 && r >= 0 && r < 8 && hits.length < 2) {
      const q = pieceAt(c, String.fromCharCode(97 + f) + (r + 1));
      if (q) hits.push({ type: q.type, color: q.color });
      f += df; r += dr;
    }
    if (hits.length === 2 && hits[0].color !== color && hits[1].color !== color) {
      const [a, b] = hits;
      const va = a.type === 'k' ? 100 : PIECE_VALUE[a.type];
      const vb = b.type === 'k' ? 100 : PIECE_VALUE[b.type];
      if (vb > va && vb >= PIECE_VALUE[p.type]) return { kind: 'pin', front: a.type, back: b.type };
      if (va > vb && va > PIECE_VALUE[p.type] && b.type !== 'p') return { kind: 'skewer', front: a.type, back: b.type };
    }
  }
  return null;
}

const CENTER = new Set(['d4', 'e4', 'd5', 'e5']);

/** Plain-language description of what a move does in a position. */
export function describeMove(fen: string, uci: string): string[] {
  const c = new Chess(fen);
  const color = c.turn();
  let m;
  try {
    m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return [];
  }
  const out: string[] = [];
  const to = m.to as Square;
  if (c.isCheckmate()) return ['delivers checkmate — the king is attacked and has no escape'];
  if (m.flags.includes('k') || m.flags.includes('q')) out.push('castles, moving the king to safety and connecting the rooks');
  if (m.promotion) out.push(`promotes the pawn to a ${PIECE_NAME[m.promotion]}`);
  if (m.captured) out.push(`captures the ${PIECE_NAME[m.captured]}${m.flags.includes('e') ? ' en passant' : ` on ${to}`}`);

  const targets = attackedTargets(c, to, color).filter((t) => t.type === 'k' || PIECE_VALUE[t.type] >= Math.max(3, PIECE_VALUE[m.piece]) || !c.attackers(t.sq as CSquare, other(color)).length);
  if (targets.length >= 2 && m.piece !== 'k') {
    const names = targets.slice(0, 2).map((t) => PIECE_NAME[t.type]);
    out.push(`forks the ${names[0]} and ${names[1]} — one piece attacking two at once`);
  } else if (c.inCheck()) {
    out.push('gives check');
  }
  const line = lineTactics(c, to, color);
  if (line?.kind === 'pin')
    out.push(`pins the ${PIECE_NAME[line.front]} to the ${PIECE_NAME[line.back]} — it can't move without exposing a more valuable piece`);
  else if (line?.kind === 'skewer')
    out.push(`skewers the ${PIECE_NAME[line.front]}; when it moves, the ${PIECE_NAME[line.back]} behind it falls`);

  if (!out.length) {
    const moveNo = Number(fen.split(' ')[5] || 1);
    const backRank = color === 'w' ? '1' : '8';
    const threats = attackedTargets(c, to, color).filter((t) => t.type !== 'k' && t.type !== 'p'
      && (PIECE_VALUE[t.type] > PIECE_VALUE[m.piece] || !c.attackers(t.sq as CSquare, other(color)).length));
    if (threats.length) out.push(`attacks the ${PIECE_NAME[threats[0].type]} on ${threats[0].sq}`);
    else if ((m.piece === 'n' || m.piece === 'b') && m.from[1] === backRank && moveNo <= 15)
      out.push(`develops the ${PIECE_NAME[m.piece]}, bringing a new piece into the game`);
    else if (m.piece === 'p' && CENTER.has(to)) out.push('claims space in the centre');
    else if (m.piece === 'p' && Math.abs(Number(m.to[1]) - Number(m.from[1])) >= 1 && (to[1] === (color === 'w' ? '7' : '2')))
      out.push('pushes the pawn one step from promotion');
    else {
      const threats = attackedTargets(c, to, color).filter((t) => t.type !== 'p' && t.type !== 'k');
      if (threats.length) out.push(`attacks the ${PIECE_NAME[threats[0].type]} on ${threats[0].sq}`);
    }
  }
  return out;
}

/** Material the side to move gains along a principal variation (in pawns). */
export function pvMaterialGain(fen: string, pv: string[], plies = 6): number {
  const c = new Chess(fen);
  const color = c.turn();
  const start = materialBalance(fen);
  let last = start;
  for (const u of pv.slice(0, plies)) {
    try {
      c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    } catch {
      break;
    }
    last = materialBalance(c.fen());
  }
  return (last - start) * (color === 'w' ? 1 : -1);
}

function materialPhrase(gain: number): string {
  if (gain >= 8) return 'winning the queen';
  if (gain >= 5) return 'winning a rook';
  if (gain >= 3) return 'winning a piece';
  if (gain >= 2) return 'winning two pawns';
  if (gain >= 1) return 'winning a pawn';
  return '';
}

function joinPhrases(p: string[]): string {
  if (p.length <= 1) return p[0] ?? '';
  return p.slice(0, -1).join(', ') + ' and ' + p[p.length - 1];
}

export interface MoveExplanationInput {
  fenBefore: string;
  played: string;
  /** Engine score of fenBefore (side to move = mover). */
  bestScore: Eval;
  bestMove: string | null;
  bestPv: string[];
  /** Engine score of the position after the move (side to move = opponent). */
  replyScore: Eval;
  replyPv: string[];
  legalCount: number;
}

export interface MoveExplanation {
  classification: Classification;
  text: string;
  bestSan?: string;
  winBefore: number;
  winAfter: number;
}

export function explainMove(i: MoveExplanationInput): MoveExplanation {
  const winBefore = moverWin(i.bestScore);
  const after: Eval = i.replyScore.mate !== undefined ? { mate: -i.replyScore.mate } : { cp: -(i.replyScore.cp ?? 0) };
  const winAfter = moverWin(after);
  const playedIsBest = i.bestMove === i.played;
  const cls = classify(winBefore, winAfter, playedIsBest, i.legalCount);
  const san = uciToSan(i.fenBefore, i.played);
  const what = describeMove(i.fenBefore, i.played);
  const parts: string[] = [];

  if (cls === 'best' || cls === 'excellent' || cls === 'good' || cls === 'forced') {
    const lead = cls === 'forced' ? `${san} was the only legal move.` : cls === 'best' ? `${san} is the best move.` : `${san} is a ${cls === 'excellent' ? 'strong' : 'solid'} move.`;
    parts.push(lead);
    if (what.length && cls !== 'forced') parts.push(`It ${joinPhrases(what)}.`);
    if (after.mate !== undefined && after.mate > 0) parts.push(`It leads to a forced checkmate in ${after.mate}.`);
    const bestSan = !playedIsBest && i.bestMove && cls !== 'best' ? uciToSan(i.fenBefore, i.bestMove) : undefined;
    if (bestSan && cls === 'good') parts.push(`${bestSan} was slightly more precise.`);
    return { classification: cls, text: parts.join(' '), bestSan, winBefore, winAfter };
  }

  // Inaccuracy / mistake / blunder: explain *why* using the opponent's best reply.
  const fenAfter = (() => {
    const c = new Chess(i.fenBefore);
    c.move({ from: i.played.slice(0, 2), to: i.played.slice(2, 4), promotion: i.played[4] });
    return c.fen();
  })();
  const mover = new Chess(i.fenBefore).turn();
  parts.push(`${san} is ${cls === 'inaccuracy' ? 'an inaccuracy' : `a ${cls}`}.`);

  const refute = i.replyPv[0];
  if (i.replyScore.mate !== undefined && i.replyScore.mate > 0) {
    const rs = refute ? uciToSan(fenAfter, refute) : '';
    parts.push(`It allows a forced checkmate in ${i.replyScore.mate}${rs ? `, starting with ${rs}` : ''}.`);
  } else {
    const gain = pvMaterialGain(fenAfter, i.replyPv);
    const hanging = hangingPieces(fenAfter, mover)[0];
    if (refute && gain >= 1) {
      parts.push(`Your opponent can reply ${uciToSan(fenAfter, refute)}, ${materialPhrase(gain)}.`);
    } else if (hanging) {
      parts.push(`It leaves your ${PIECE_NAME[hanging.type]} on ${hanging.sq} unprotected.`);
    } else if (refute) {
      const rw = describeMove(fenAfter, refute);
      parts.push(`It gives your opponent ${rw.length ? `${uciToSan(fenAfter, refute)}, which ${rw[0]}` : `a better position after ${uciToSan(fenAfter, refute)}`}.`);
    }
  }

  let bestSan: string | undefined;
  if (i.bestMove) {
    bestSan = uciToSan(i.fenBefore, i.bestMove);
    const bw = describeMove(i.fenBefore, i.bestMove);
    const bGain = pvMaterialGain(i.fenBefore, i.bestPv);
    let s = `Better was ${bestSan}`;
    if (i.bestScore.mate !== undefined && i.bestScore.mate > 0) s += `, with checkmate in ${i.bestScore.mate}`;
    else if (bw.length) s += `, which ${bw[0]}`;
    if (bGain >= 1 && !(i.bestScore.mate && i.bestScore.mate > 0)) s += `${bw.length ? ',' : ','} ${materialPhrase(bGain)}`;
    parts.push(s + '.');
  }
  return { classification: cls, text: parts.join(' '), bestSan, winBefore, winAfter };
}

/** Hint text for the side to move. */
export function explainHint(fen: string, best: string, score: Eval, pv: string[]): string {
  const san = uciToSan(fen, best);
  const what = describeMove(fen, best);
  const gain = pvMaterialGain(fen, pv);
  let s = `Try ${san}.`;
  if (score.mate !== undefined && score.mate > 0) return `${s} It forces checkmate in ${score.mate}.`;
  if (what.length) s += ` It ${joinPhrases(what.slice(0, 2))}.`;
  if (gain >= 1) s += ` The main line ends up ${materialPhrase(gain)}.`;
  const v = scoreValue(score);
  if (!what.length && gain < 1) s += v > 50 ? ' It keeps your advantage.' : v < -50 ? ' It is the most resilient defence.' : ' It keeps the position balanced.';
  return s;
}

/** Lichess accuracy formula: per-move accuracy from win% drop. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const drop = Math.max(0, (winBefore - winAfter) * 100);
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669));
}
