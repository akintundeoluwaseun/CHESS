/** XP curve: each level needs a little more than the last, without ever becoming a grind wall. */
export function xpForNext(level: number): number {
  return 100 + 40 * (level - 1);
}

export function levelFromXp(totalXp: number): { level: number; into: number; needed: number; progress: number } {
  let level = 1;
  let rest = Math.max(0, Math.floor(totalXp));
  while (rest >= xpForNext(level)) {
    rest -= xpForNext(level);
    level++;
  }
  const needed = xpForNext(level);
  return { level, into: rest, needed, progress: rest / needed };
}

export function rankTitle(level: number): string {
  if (level >= 40) return 'Legend';
  if (level >= 30) return 'Grandmaster';
  if (level >= 22) return 'Master';
  if (level >= 15) return 'Expert';
  if (level >= 10) return 'Strategist';
  if (level >= 6) return 'Tactician';
  if (level >= 3) return 'Apprentice';
  return 'Novice';
}

/** Elo update vs an AI of known strength. Provisional players move faster. */
export function updateRating(rating: number, opponent: number, score: 0 | 0.5 | 1, gamesPlayed: number): number {
  const expected = 1 / (1 + Math.pow(10, (opponent - rating) / 400));
  const k = gamesPlayed < 15 ? 40 : gamesPlayed < 50 ? 28 : 20;
  return Math.max(100, Math.round(rating + k * (score - expected)));
}
