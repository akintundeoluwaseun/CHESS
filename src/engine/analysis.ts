import { Chess } from 'chess.js';
import type { MoveRecord } from '@/chess/types';
import { Engine } from './EngineService';
import { Classification, explainMove, moveAccuracy } from './explain';
import { Eval, evalToCp } from './uci';

export interface AnalyzedMove {
  ply: number;
  san: string;
  uci: string;
  color: 'w' | 'b';
  /** White-perspective evaluation after this move (clamped cp). */
  evalAfterWhite: number;
  evalAfter: Eval; // white perspective, unclamped
  classification: Classification;
  explanation: string;
  bestSan?: string;
  accuracy: number;
}

export interface GameAnalysis {
  version: 1;
  depth: number;
  startEvalWhite: number;
  moves: AnalyzedMove[];
  accuracy: { w: number; b: number };
  counts: Record<'w' | 'b', Partial<Record<Classification, number>>>;
}

interface PosEval {
  score: Eval; // side-to-move perspective
  best: string | null;
  pv: string[];
}

function terminalEval(fen: string): PosEval | null {
  const c = new Chess(fen);
  if (c.isCheckmate()) return { score: { mate: 0 }, best: null, pv: [] };
  if (c.isDraw() || c.isStalemate()) return { score: { cp: 0 }, best: null, pv: [] };
  return null;
}

export async function evaluatePosition(fen: string, depth: number): Promise<PosEval> {
  const t = terminalEval(fen);
  if (t) return t; // mate: 0 marks "side to move is checkmated"
  const r = await Engine.search('analysis', { fen, depth });
  const l = r.lines[0];
  return { score: l ? { cp: l.cp, mate: l.mate } : { cp: 0 }, best: r.bestmove, pv: l?.pv ?? [] };
}

function toWhite(fen: string, e: Eval): Eval {
  const flip = fen.split(' ')[1] === 'b';
  if (e.mate !== undefined) {
    // mate 0 → side to move is checkmated
    if (e.mate === 0) return { mate: flip ? 1 : -1 };
    return { mate: flip ? -e.mate : e.mate };
  }
  return { cp: flip ? -(e.cp ?? 0) : (e.cp ?? 0) };
}

/** Full post-game review. Progress callback receives 0..1. */
export async function analyzeGame(
  startFen: string,
  moves: MoveRecord[],
  onProgress?: (p: number) => void,
  depth = 11,
  isCancelled?: () => boolean,
): Promise<GameAnalysis> {
  const fens = [startFen, ...moves.map((m) => m.fenAfter)];
  const evals: PosEval[] = [];
  for (let i = 0; i < fens.length; i++) {
    if (isCancelled?.()) throw new Error('cancelled');
    evals.push(await evaluatePosition(fens[i], depth));
    onProgress?.((i + 1) / fens.length);
  }
  const out: AnalyzedMove[] = [];
  const counts: GameAnalysis['counts'] = { w: {}, b: {} };
  const accs: Record<'w' | 'b', number[]> = { w: [], b: [] };
  moves.forEach((m, i) => {
    const before = evals[i];
    const after = evals[i + 1];
    // after.score.mate === 0 means the opponent (side to move) is checkmated.
    const replyScore: Eval = after.score.mate === 0 ? { mate: -1 } : after.score;
    const legalCount = new Chess(m.fenBefore).moves().length;
    const ex = explainMove({
      fenBefore: m.fenBefore,
      played: m.uci,
      bestScore: before.score,
      bestMove: before.best,
      bestPv: before.pv,
      replyScore,
      replyPv: after.pv,
      legalCount,
    });
    // Delivering checkmate is always best.
    const cls = after.score.mate === 0 ? 'best' : ex.classification;
    const text = after.score.mate === 0 ? `${m.san} delivers checkmate!` : ex.text;
    const acc = cls === 'best' || cls === 'forced' ? 100 : moveAccuracy(ex.winBefore, ex.winAfter);
    accs[m.color].push(acc);
    counts[m.color][cls] = (counts[m.color][cls] ?? 0) + 1;
    const ew = toWhite(m.fenAfter, after.score);
    out.push({
      ply: i + 1, san: m.san, uci: m.uci, color: m.color,
      evalAfter: ew, evalAfterWhite: evalToCp(ew),
      classification: cls, explanation: text, bestSan: cls === 'best' ? undefined : ex.bestSan, accuracy: acc,
    });
  });
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  return {
    version: 1, depth,
    startEvalWhite: evalToCp(toWhite(startFen, evals[0].score)),
    moves: out,
    accuracy: { w: avg(accs.w), b: avg(accs.b) },
    counts,
  };
}
