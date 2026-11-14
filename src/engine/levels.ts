/**
 * Ten calibrated AI levels. Each level differs in *how* the engine plays,
 * not just how often it errs:
 *
 *  1–3  Human-like weak play: a shallow Stockfish search returns several
 *       candidate moves, and we pick among them with a temperature that
 *       favours good moves but allows realistic mistakes. Every candidate is a
 *       real engine-evaluated legal move — never a random one.
 *  4–9  Stockfish's own strength limiter (UCI_LimitStrength + UCI_Elo), with
 *       growing think time.
 *  10   Full strength with a generous time budget.
 */
export interface AiLevel {
  id: number;
  name: string;
  elo: number; // approximate playing strength, used for ranked rating
  blurb: string;
  // engine configuration
  mode: 'sample' | 'limit' | 'full';
  depth?: number;
  movetime?: number;
  multipv?: number;
  /** Max centipawn loss vs best considered by the sampler. */
  tolerance?: number;
  /** Sampler temperature in centipawns; larger = more mistakes. */
  temperature?: number;
  /** Probability of choosing among the worst considered candidates (simulated oversight). */
  oversight?: number;
  /** UCI_Elo actually sent to Stockfish (its scale differs from human ratings at the low end). */
  engineElo?: number;
}

export const AI_LEVELS: AiLevel[] = [
  { id: 1, name: 'Beginner', elo: 400, mode: 'sample', depth: 1, multipv: 8, tolerance: 600, temperature: 220, oversight: 0.3,
    blurb: 'Just learning. Often misses threats and leaves pieces hanging.' },
  { id: 2, name: 'Easy', elo: 700, mode: 'sample', depth: 2, multipv: 6, tolerance: 400, temperature: 140, oversight: 0.18,
    blurb: 'Knows the basics but makes frequent tactical mistakes.' },
  { id: 3, name: 'Casual', elo: 1000, mode: 'sample', depth: 3, multipv: 5, tolerance: 320, temperature: 130, oversight: 0.15,
    blurb: 'Plays sensible moves, punishes obvious blunders.' },
  { id: 4, name: 'Intermediate', elo: 1350, mode: 'limit', movetime: 250, engineElo: 1500,
    blurb: 'Solid club beginner. Sees simple tactics.' },
  { id: 5, name: 'Skilled', elo: 1600, mode: 'limit', movetime: 350, engineElo: 1720,
    blurb: 'Good tactical awareness and reasonable plans.' },
  { id: 6, name: 'Advanced', elo: 1850, mode: 'limit', movetime: 500, engineElo: 1950,
    blurb: 'Strong club player. Few outright mistakes.' },
  { id: 7, name: 'Expert', elo: 2100, mode: 'limit', movetime: 700, engineElo: 2200,
    blurb: 'Expert-level positional and tactical play.' },
  { id: 8, name: 'Master', elo: 2350, mode: 'limit', movetime: 900, engineElo: 2450,
    blurb: 'Master strength. Converts small advantages.' },
  { id: 9, name: 'Grandmaster', elo: 2650, mode: 'limit', movetime: 1200, engineElo: 2750,
    blurb: 'Grandmaster strength. Extremely precise.' },
  { id: 10, name: 'Elite', elo: 3000, mode: 'full', movetime: 1600,
    blurb: 'Full engine strength. Beyond any human.' },
];

export function getLevel(id: number): AiLevel {
  return AI_LEVELS[Math.max(1, Math.min(10, id)) - 1];
}

/** Level whose strength is closest to a rating (used by Quick and Ranked). */
export function levelForRating(rating: number): AiLevel {
  let best = AI_LEVELS[0];
  for (const l of AI_LEVELS) if (Math.abs(l.elo - rating) < Math.abs(best.elo - rating)) best = l;
  return best;
}

export interface Candidate {
  move: string;
  score: number; // centipawns, side-to-move perspective
}

/**
 * Picks a move among engine candidates. `rand` is injectable for tests.
 * Deterministic given the same random stream.
 */
export function sampleMove(cands: Candidate[], level: AiLevel, rand: () => number = Math.random): string {
  if (cands.length === 0) throw new Error('no candidates');
  const best = cands[0].score;
  // From level 2 up, never miss a mate-in-1 the search has found.
  if (level.id >= 2 && best > 99000 && cands[0].score >= 99900) return cands[0].move;
  const pool = cands.filter((c) => best - c.score <= (level.tolerance ?? 200));
  if (pool.length === 1) return pool[0].move;
  const T = level.temperature ?? 100;
  if (rand() < (level.oversight ?? 0)) {
    // Oversight: choose from the weaker half of the pool (still a sensible-looking engine move).
    const weak = pool.slice(Math.ceil(pool.length / 2));
    if (weak.length) return weak[Math.floor(rand() * weak.length)].move;
  }
  const weights = pool.map((c) => Math.exp(-(best - Math.min(c.score, best + 1)) / T));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i].move;
  }
  return pool[pool.length - 1].move;
}

/** Natural-feeling pause so instant replies don't feel robotic. */
export function humanDelayMs(level: AiLevel, ply: number): number {
  const base = ply < 6 ? 350 : 600;
  return base + Math.min(900, level.id * 60);
}
