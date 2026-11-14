/** Parsing helpers for the UCI protocol spoken by Stockfish. */

export interface PvLine {
  multipv: number;
  depth: number;
  /** Centipawns from the side-to-move's perspective. */
  cp?: number;
  /** Mate in N (positive: side to move mates). */
  mate?: number;
  pv: string[];
}

export interface SearchResult {
  bestmove: string | null;
  ponder?: string;
  lines: PvLine[]; // sorted by multipv
  depth: number;
}

export function parseInfo(line: string): PvLine | null {
  if (!line.startsWith('info ') || !line.includes(' pv ')) return null;
  if (line.includes(' upperbound') || line.includes(' lowerbound')) return null;
  const tok = line.split(/\s+/);
  const out: PvLine = { multipv: 1, depth: 0, pv: [] };
  for (let i = 1; i < tok.length; i++) {
    const t = tok[i];
    if (t === 'depth') out.depth = Number(tok[++i]);
    else if (t === 'multipv') out.multipv = Number(tok[++i]);
    else if (t === 'score') {
      const kind = tok[++i];
      const v = Number(tok[++i]);
      if (kind === 'cp') out.cp = v;
      else if (kind === 'mate') out.mate = v;
    } else if (t === 'pv') {
      out.pv = tok.slice(i + 1);
      break;
    }
  }
  return out;
}

export function parseSearch(lines: string[]): SearchResult {
  const byPv = new Map<number, PvLine>();
  let bestmove: string | null = null;
  let ponder: string | undefined;
  for (const l of lines) {
    const info = parseInfo(l);
    if (info) {
      const prev = byPv.get(info.multipv);
      if (!prev || info.depth >= prev.depth) byPv.set(info.multipv, info);
    } else if (l.startsWith('bestmove')) {
      const t = l.split(/\s+/);
      bestmove = t[1] && t[1] !== '(none)' ? t[1] : null;
      if (t[2] === 'ponder') ponder = t[3];
    }
  }
  const sorted = [...byPv.values()].sort((a, b) => a.multipv - b.multipv);
  // Keep only lines from the deepest completed iteration to avoid mixing depths.
  const depth = sorted.length ? Math.max(...sorted.map((l) => l.depth)) : 0;
  const deep = sorted.filter((l) => l.depth >= depth - 1);
  return { bestmove, ponder, lines: deep.length ? deep : sorted, depth };
}

/** Unified score in centipawns, mates mapped to large values. */
export function scoreValue(l: { cp?: number; mate?: number }): number {
  if (l.mate !== undefined) return l.mate > 0 ? 100000 - l.mate * 100 : -100000 - l.mate * 100;
  return l.cp ?? 0;
}

/** Lichess-style win probability (0..1) from a centipawn score. */
export function winChance(cp: number): number {
  const c = Math.max(-1000, Math.min(1000, cp));
  return 1 / (1 + Math.exp(-0.00368208 * c));
}

export interface Eval {
  cp?: number;
  mate?: number;
}
/** Clamp mates to +/-1000 cp for graphs and win-probability. */
export function evalToCp(e: Eval): number {
  if (e.mate !== undefined) return e.mate > 0 ? 1000 : e.mate < 0 ? -1000 : 0;
  return Math.max(-1000, Math.min(1000, e.cp ?? 0));
}
export function formatEval(e: Eval): string {
  if (e.mate !== undefined) return e.mate === 0 ? '#' : `${e.mate > 0 ? '' : '-'}M${Math.abs(e.mate)}`;
  const v = (e.cp ?? 0) / 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
}
