import type { ProgressEvent, ProgressState } from './types';

/* ----------------------------- Achievements ----------------------------- */

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string; // Ionicons name
  check: (s: ProgressState, e: ProgressEvent) => boolean;
}

const c = (s: ProgressState) => s.counters;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-game', title: 'First Moves', description: 'Finish your first game.', icon: 'flag-outline',
    check: (_s, e) => e.type === 'game' && e.record.uci.length >= 10 },
  { id: 'first-win', title: 'First Victory', description: 'Win a game against the AI.', icon: 'trophy-outline',
    check: (s) => c(s).wins >= 1 },
  { id: 'checkmate-artist', title: 'Checkmate Artist', description: 'Deliver checkmate 10 times.', icon: 'skull-outline',
    check: (s) => c(s).checkmatesDelivered >= 10 },
  { id: 'knight-mate', title: 'Horse Whisperer', description: 'Deliver checkmate with a knight.', icon: 'sparkles-outline',
    check: (_s, e) => e.type === 'game' && e.mateByPiece === 'n' && e.record.outcome === 'win' },
  { id: 'pawn-mate', title: 'Humble Hero', description: 'Deliver checkmate with a pawn.', icon: 'sparkles-outline',
    check: (_s, e) => e.type === 'game' && e.mateByPiece === 'p' && e.record.outcome === 'win' },
  { id: 'promotion', title: 'Promotion', description: 'Promote a pawn in a game you win.', icon: 'arrow-up-circle-outline',
    check: (_s, e) => e.type === 'game' && e.promoted && e.record.outcome === 'win' },
  { id: 'comeback', title: 'Comeback', description: 'Win a game after being down at least a rook in material.', icon: 'trending-up-outline',
    check: (_s, e) => e.type === 'game' && e.record.outcome === 'win' && e.minMaterial <= -5 },
  { id: 'beat-casual', title: 'Club Player', description: 'Beat the Casual AI (level 3).', icon: 'ribbon-outline',
    check: (s) => c(s).highestLevelBeaten >= 3 },
  { id: 'beat-skilled', title: 'Sharp Mind', description: 'Beat the Skilled AI (level 5).', icon: 'ribbon-outline',
    check: (s) => c(s).highestLevelBeaten >= 5 },
  { id: 'beat-expert', title: 'Giant Slayer', description: 'Beat the Expert AI (level 7).', icon: 'medal-outline',
    check: (s) => c(s).highestLevelBeaten >= 7 },
  { id: 'beat-gm', title: 'Grandmaster Slayer', description: 'Beat the Grandmaster AI (level 9).', icon: 'diamond-outline',
    check: (s) => c(s).highestLevelBeaten >= 9 },
  { id: 'win-streak-3', title: 'On a Roll', description: 'Win 3 games in a row.', icon: 'flame-outline',
    check: (s) => c(s).bestWinStreak >= 3 },
  { id: 'games-25', title: 'Regular', description: 'Play 25 games.', icon: 'albums-outline',
    check: (s) => c(s).gamesPlayed >= 25 },
  { id: 'games-100', title: 'Devoted', description: 'Play 100 games.', icon: 'albums-outline',
    check: (s) => c(s).gamesPlayed >= 100 },
  { id: 'rating-1200', title: 'Rising Star', description: 'Reach a 1200 ranked rating.', icon: 'star-outline',
    check: (s) => s.bestRating >= 1200 },
  { id: 'rating-1600', title: 'Contender', description: 'Reach a 1600 ranked rating.', icon: 'star-half-outline',
    check: (s) => s.bestRating >= 1600 },
  { id: 'rating-2000', title: 'Elite Mind', description: 'Reach a 2000 ranked rating.', icon: 'star',
    check: (s) => s.bestRating >= 2000 },
  { id: 'puzzle-10', title: 'Puzzle Solver', description: 'Solve 10 puzzles.', icon: 'extension-puzzle-outline',
    check: (s) => c(s).puzzlesSolved >= 10 },
  { id: 'puzzle-100', title: 'Puzzle Master', description: 'Solve 100 puzzles.', icon: 'extension-puzzle',
    check: (s) => c(s).puzzlesSolved >= 100 },
  { id: 'puzzle-streak-5', title: 'Clear Sight', description: 'Solve 5 puzzles in a row without a mistake.', icon: 'eye-outline',
    check: (s) => c(s).bestPuzzleStreak >= 5 },
  { id: 'first-lesson', title: 'Student', description: 'Complete your first lesson.', icon: 'school-outline',
    check: (s) => c(s).lessonsCompleted >= 1 },
  { id: 'all-lessons', title: 'Scholar', description: 'Complete every lesson.', icon: 'library-outline',
    check: (s) => c(s).lessonsCompleted >= LESSON_COUNT_REF.value && LESSON_COUNT_REF.value > 0 },
  { id: 'challenge-5', title: 'Challenger', description: 'Complete 5 challenges.', icon: 'shield-outline',
    check: (s) => c(s).challengesCompleted >= 5 },
  { id: 'streak-3', title: 'Habit', description: 'Play on 3 days in a row.', icon: 'calendar-outline',
    check: (s) => s.streak.best >= 3 },
  { id: 'streak-7', title: 'Dedicated', description: 'Play on 7 days in a row.', icon: 'calendar',
    check: (s) => s.streak.best >= 7 },
  { id: 'three-d', title: 'New Dimension', description: 'Finish a game on the 3D board.', icon: 'cube-outline',
    check: (s) => c(s).games3d >= 1 },
];

/** Set at startup from the lesson catalogue (avoids a circular import). */
export const LESSON_COUNT_REF = { value: 0 };

/* ------------------------------- Missions ------------------------------- */

export interface MissionDef {
  id: string;
  title: string;
  target: number;
  xp: number;
  /** How much an event advances this mission. */
  inc: (e: ProgressEvent) => number;
}

const isFinishedGame = (e: ProgressEvent) => e.type === 'game' && e.record.uci.length >= 10;

export const DAILY_POOL: MissionDef[] = [
  { id: 'd-play-2', title: 'Play 2 games', target: 2, xp: 30, inc: (e) => (isFinishedGame(e) ? 1 : 0) },
  { id: 'd-win-1', title: 'Win a game vs AI', target: 1, xp: 35,
    inc: (e) => (e.type === 'game' && e.record.outcome === 'win' && e.record.uci.length >= 10 ? 1 : 0) },
  { id: 'd-puzzles-3', title: 'Solve 3 puzzles', target: 3, xp: 30, inc: (e) => (e.type === 'puzzle' && e.solved ? 1 : 0) },
  { id: 'd-lesson-1', title: 'Complete a lesson', target: 1, xp: 30, inc: (e) => (e.type === 'lesson' ? 1 : 0) },
  { id: 'd-daily-puzzle', title: 'Solve the daily puzzle', target: 1, xp: 25, inc: (e) => (e.type === 'puzzle' && e.solved && e.daily ? 1 : 0) },
  { id: 'd-no-undo', title: 'Finish a game vs AI without undo', target: 1, xp: 30,
    inc: (e) => (e.type === 'game' && e.record.aiLevel !== null && !e.record.usedUndo && e.record.uci.length >= 20 ? 1 : 0) },
  { id: 'd-ranked-1', title: 'Play a ranked game', target: 1, xp: 30, inc: (e) => (e.type === 'game' && e.record.mode === 'ranked' && e.record.uci.length >= 10 ? 1 : 0) },
  { id: 'd-challenge-1', title: 'Complete a challenge', target: 1, xp: 35, inc: (e) => (e.type === 'challenge' ? 1 : 0) },
];

export const WEEKLY_POOL: MissionDef[] = [
  { id: 'w-win-5', title: 'Win 5 games', target: 5, xp: 150,
    inc: (e) => (e.type === 'game' && e.record.outcome === 'win' && e.record.uci.length >= 10 ? 1 : 0) },
  { id: 'w-play-10', title: 'Play 10 games', target: 10, xp: 140, inc: (e) => (isFinishedGame(e) ? 1 : 0) },
  { id: 'w-puzzles-20', title: 'Solve 20 puzzles', target: 20, xp: 150, inc: (e) => (e.type === 'puzzle' && e.solved ? 1 : 0) },
  { id: 'w-lessons-3', title: 'Complete 3 lessons', target: 3, xp: 120, inc: (e) => (e.type === 'lesson' ? 1 : 0) },
  { id: 'w-ranked-wins-3', title: 'Win 3 ranked games', target: 3, xp: 160,
    inc: (e) => (e.type === 'game' && e.record.mode === 'ranked' && e.record.outcome === 'win' ? 1 : 0) },
];

export const DAILY_COUNT = 3;
export const WEEKLY_COUNT = 2;
export const DAILY_ALL_BONUS = 40;

/* ------------------------------- Unlocks -------------------------------- */

export interface Unlockable {
  id: string;
  kind: 'board' | 'pieces';
  label: string;
  level: number;
}

export const UNLOCKS: Unlockable[] = [
  { id: 'walnut', kind: 'board', label: 'Walnut board', level: 1 },
  { id: 'tournament', kind: 'board', label: 'Tournament board', level: 1 },
  { id: 'midnight', kind: 'board', label: 'Midnight board', level: 1 },
  { id: 'marble', kind: 'board', label: 'Carrara Marble board', level: 3 },
  { id: 'obsidian', kind: 'board', label: 'Obsidian Stone board', level: 6 },
  { id: 'brass', kind: 'board', label: 'Ebony & Brass board', level: 10 },
  { id: 'staunton', kind: 'pieces', label: 'Staunton pieces', level: 1 },
  { id: 'regal', kind: 'pieces', label: 'Regal pieces', level: 4 },
  { id: 'modern', kind: 'pieces', label: 'Modern pieces', level: 8 },
];

export function isUnlocked(id: string, level: number): boolean {
  const u = UNLOCKS.find((x) => x.id === id);
  return !u || level >= u.level;
}
