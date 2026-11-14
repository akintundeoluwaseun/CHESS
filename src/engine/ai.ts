import { ChessGame } from '@/chess/ChessGame';
import { Engine } from './EngineService';
import { AiLevel, Candidate, sampleMove } from './levels';
import { scoreValue, SearchResult } from './uci';

export interface AiMoveRequest {
  startFen: string;
  moves: string[];
  level: AiLevel;
}

/**
 * Asks the 'play' engine for a move at the requested strength. The returned
 * move is ALWAYS re-validated against the rules library; the engine is never
 * trusted to decide legality.
 */
export async function chooseAiMove(req: AiMoveRequest, rand: () => number = Math.random): Promise<string> {
  const game = new ChessGame(req.startFen, req.moves);
  const legal = game.legalMovesUci();
  if (legal.length === 0) throw new Error('No legal moves');
  if (legal.length === 1) return legal[0];
  const { level } = req;
  const base = { fen: game.fen(), startFen: req.startFen, moves: req.moves };

  let move: string | null = null;
  if (level.mode === 'sample') {
    const res = await Engine.search('play', { ...base, depth: level.depth, multipv: level.multipv });
    const cands = candidatesFrom(res).filter((c) => legal.includes(c.move));
    if (cands.length) move = sampleMove(cands, level, rand);
  } else {
    const res = await Engine.search('play', {
      ...base,
      movetime: level.movetime,
      elo: level.mode === 'limit' ? level.engineElo ?? level.elo : undefined,
    });
    move = res.bestmove;
  }
  if (move && legal.includes(move)) return move;
  // Fallback: a plain full-strength search. If that is still not legal something is
  // badly wrong, so surface it rather than playing a guess.
  const retry = await Engine.search('play', { ...base, depth: 8 });
  if (retry.bestmove && legal.includes(retry.bestmove)) return retry.bestmove;
  throw new Error('Engine returned an illegal move');
}

export function candidatesFrom(res: SearchResult): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const l of res.lines) {
    const m = l.pv[0];
    if (!m || seen.has(m)) continue;
    seen.add(m);
    out.push({ move: m, score: scoreValue(l) });
  }
  return out.sort((a, b) => b.score - a.score);
}
