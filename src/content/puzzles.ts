import data from './puzzles.json';
import { dayKey, seededRandom } from '@/progression/progress';

export interface Puzzle {
  id: string;
  fen: string;
  /** First move is the solver's; then alternating opponent/solver. */
  moves: string[];
  rating: number;
  themes: string[];
}

export const PUZZLES: Puzzle[] = data as Puzzle[];

export const THEME_LABELS: Record<string, string> = {
  mate: 'Checkmate', mateIn1: 'Mate in 1', mateIn2: 'Mate in 2', mateIn3: 'Mate in 3', backRankMate: 'Back-rank mate',
  smotheredOrKnightMate: 'Knight mate', fork: 'Fork', pin: 'Pin', skewer: 'Skewer', hangingPiece: 'Free piece',
  promotion: 'Promotion', sacrifice: 'Sacrifice', endgame: 'Endgame', quietMove: 'Quiet move', oneMove: 'One move',
  short: 'Short', long: 'Long',
};

export const THEME_FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'Mixed' },
  { id: 'mate', label: 'Checkmate' },
  { id: 'fork', label: 'Forks' },
  { id: 'pin', label: 'Pins' },
  { id: 'hangingPiece', label: 'Free pieces' },
  { id: 'sacrifice', label: 'Sacrifices' },
  { id: 'endgame', label: 'Endgame' },
];

/** Daily puzzle: same for everyone on a given date, moderate difficulty. */
export function dailyPuzzle(now = Date.now()): Puzzle {
  const pool = PUZZLES.filter((p) => p.rating >= 850 && p.rating <= 1600 && p.moves.length >= 1);
  const r = seededRandom('puzzle-' + dayKey(now));
  return pool[Math.floor(r() * pool.length)];
}

/** Next puzzle near the player's puzzle rating, preferring unsolved ones. */
export function nextPuzzle(rating: number, solved: Record<string, number>, theme: string, exclude: string[] = []): Puzzle {
  const pool = PUZZLES.filter((p) => (theme === 'all' || p.themes.includes(theme)) && !exclude.includes(p.id));
  const unsolved = pool.filter((p) => !solved[p.id]);
  const src = unsolved.length ? unsolved : pool.length ? pool : PUZZLES;
  const scored = src.map((p) => ({ p, d: Math.abs(p.rating - rating) + Math.random() * 180 }));
  scored.sort((a, b) => a.d - b.d);
  return scored[0].p;
}
