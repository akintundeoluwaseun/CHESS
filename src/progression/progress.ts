import {
  ACHIEVEMENTS, DAILY_ALL_BONUS, DAILY_COUNT, DAILY_POOL, MissionDef, UNLOCKS, WEEKLY_COUNT, WEEKLY_POOL,
} from './catalog';
import { levelFromXp, updateRating } from './levels';
import type { MissionState, ProgressEvent, ProgressState, Reward } from './types';
import { getLevel } from '@/engine/levels';

export const START_RATING = 800;
export const START_PUZZLE_RATING = 1000;

export function initialProgress(now = Date.now()): ProgressState {
  return {
    username: 'Player',
    avatar: 0,
    createdAt: now,
    xp: 0,
    rating: START_RATING,
    ratedGames: 0,
    bestRating: START_RATING,
    ratingHistory: [],
    puzzleRating: START_PUZZLE_RATING,
    puzzleHistory: [],
    streak: { current: 0, best: 0, lastDay: null },
    counters: {
      gamesPlayed: 0, aiGames: 0, wins: 0, losses: 0, draws: 0, localGames: 0, winStreak: 0, bestWinStreak: 0,
      highestLevelBeaten: 0, puzzlesSolved: 0, puzzlesAttempted: 0, puzzleStreak: 0, bestPuzzleStreak: 0,
      lessonsCompleted: 0, challengesCompleted: 0, games3d: 0, checkmatesDelivered: 0, promotions: 0,
    },
    solvedPuzzles: {},
    completedLessons: {},
    completedChallenges: {},
    achievements: {},
    missions: { day: '', daily: [], dailyBonusClaimed: false, week: '', weekly: [] },
  };
}

/* ------------------------------ date keys ------------------------------- */

export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function weekKey(t: number): string {
  const d = new Date(t);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return 'W' + dayKey(monday.getTime());
}
function prevDayKey(t: number): string {
  const d = new Date(t);
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1).getTime());
}

export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(pool: MissionDef[], n: number, seed: string): MissionState[] {
  const r = seededRandom(seed);
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n).map((m) => ({ id: m.id, progress: 0, done: false }));
}

/** Rolls daily / weekly missions over when the day or week changes. */
export function ensureMissions(s: ProgressState, now = Date.now()): ProgressState {
  const day = dayKey(now);
  const week = weekKey(now);
  if (s.missions.day === day && s.missions.week === week) return s;
  const missions = { ...s.missions };
  if (missions.day !== day) {
    missions.day = day;
    missions.daily = pick(DAILY_POOL, DAILY_COUNT, 'daily-' + day);
    missions.dailyBonusClaimed = false;
  }
  if (missions.week !== week) {
    missions.week = week;
    missions.weekly = pick(WEEKLY_POOL, WEEKLY_COUNT, 'weekly-' + week);
  }
  return { ...s, missions };
}

export function missionDef(id: string): MissionDef | undefined {
  return [...DAILY_POOL, ...WEEKLY_POOL].find((m) => m.id === id);
}

/* ------------------------------ main reducer ---------------------------- */

export function applyEvent(prev: ProgressState, e: ProgressEvent, now = Date.now()): { state: ProgressState; rewards: Reward[] } {
  let s: ProgressState = ensureMissions(structuredCloneSafe(prev), now);
  const rewards: Reward[] = [];
  const levelBefore = levelFromXp(s.xp).level;
  const addXp = (amount: number, label: string) => {
    if (amount <= 0) return;
    s.xp += amount;
    rewards.push({ kind: 'xp', amount, label });
  };
  const k = s.counters;

  // Activity streak (any meaningful activity counts).
  const meaningful = e.type !== 'game' || e.record.uci.length >= 2;
  if (meaningful) {
    const today = dayKey(now);
    if (s.streak.lastDay !== today) {
      s.streak.current = s.streak.lastDay === prevDayKey(now) ? s.streak.current + 1 : 1;
      s.streak.lastDay = today;
      s.streak.best = Math.max(s.streak.best, s.streak.current);
    }
  }

  if (e.type === 'game') {
    const r = e.record;
    const counts = r.uci.length >= 10; // anti-farming: instant resignations earn nothing
    if (r.uci.length >= 2) {
      k.gamesPlayed++;
      if (r.renderMode === '3d') k.games3d++;
      if (r.result.reason === 'checkmate' && r.outcome === 'win') k.checkmatesDelivered++;
      if (e.promoted) k.promotions++;
    }
    if (r.mode === 'local') {
      if (r.uci.length >= 2) k.localGames++;
      if (counts) addXp(10, 'Local game played');
    } else if (r.outcome) {
      if (r.uci.length >= 2) {
        k.aiGames++;
        if (r.outcome === 'win') {
          k.wins++;
          k.winStreak++;
          k.bestWinStreak = Math.max(k.bestWinStreak, k.winStreak);
          if (r.aiLevel) k.highestLevelBeaten = Math.max(k.highestLevelBeaten, r.aiLevel);
        } else if (r.outcome === 'loss') {
          k.losses++;
          k.winStreak = 0;
        } else {
          k.draws++;
        }
      }
      if (counts) {
        const lvl = r.aiLevel ?? 1;
        addXp(r.mode === 'challenge' ? 10 : 15, 'Game completed');
        if (r.mode !== 'challenge') {
          const hintPenalty = Math.min(1, r.hintsUsed * 0.2);
          if (r.outcome === 'win') addXp(Math.round((10 + 5 * lvl) * (1 - hintPenalty)), `Victory vs ${getLevel(lvl).name}`);
          if (r.outcome === 'draw') addXp(Math.round((5 + 2 * lvl) * (1 - hintPenalty)), 'Hard-fought draw');
        }
      }
      if (r.mode === 'ranked' && r.aiLevel && r.uci.length >= 2) {
        const score = r.outcome === 'win' ? 1 : r.outcome === 'draw' ? 0.5 : 0;
        const before = s.rating;
        const after = updateRating(before, getLevel(r.aiLevel).elo, score as 0 | 0.5 | 1, s.ratedGames);
        s.rating = after;
        s.ratedGames++;
        s.bestRating = Math.max(s.bestRating, after);
        s.ratingHistory = [...s.ratingHistory, { t: now, r: after }].slice(-200);
        rewards.push({ kind: 'rating', before, after, label: 'Ranked rating' });
      }
    }
  } else if (e.type === 'puzzle') {
    k.puzzlesAttempted++;
    const first = !s.solvedPuzzles[e.id];
    if (e.solved) {
      k.puzzleStreak = e.hintsUsed ? 0 : k.puzzleStreak + 1;
      k.bestPuzzleStreak = Math.max(k.bestPuzzleStreak, k.puzzleStreak);
      if (first) {
        k.puzzlesSolved++;
        s.solvedPuzzles = { ...s.solvedPuzzles, [e.id]: now };
        const base = 10 + Math.max(0, Math.min(10, Math.round((e.rating - 800) / 120)));
        addXp(e.hintsUsed ? Math.ceil(base / 2) : base, e.daily ? 'Daily puzzle solved' : 'Puzzle solved');
      } else addXp(2, 'Puzzle replayed');
    } else {
      k.puzzleStreak = 0;
    }
    if (first && !e.hintsUsed) {
      // Puzzle rating: Elo against the puzzle's own rating (first attempt only).
      const before = s.puzzleRating;
      const after = updateRating(before, e.rating, e.solved ? 1 : 0, k.puzzlesAttempted);
      s.puzzleRating = after;
      s.puzzleHistory = [...s.puzzleHistory, { t: now, r: after }].slice(-200);
    }
  } else if (e.type === 'lesson') {
    const first = !s.completedLessons[e.id];
    if (first) {
      k.lessonsCompleted++;
      s.completedLessons = { ...s.completedLessons, [e.id]: now };
      addXp(40, 'Lesson completed');
    } else addXp(5, 'Lesson reviewed');
  } else if (e.type === 'challenge') {
    const first = !s.completedChallenges[e.id];
    if (first) {
      k.challengesCompleted++;
      s.completedChallenges = { ...s.completedChallenges, [e.id]: now };
      addXp(30 + 15 * e.tier, 'Challenge completed');
    }
  }

  // Missions
  const advance = (list: MissionState[]) =>
    list.map((m) => {
      if (m.done) return m;
      const def = missionDef(m.id);
      if (!def) return m;
      const progress = Math.min(def.target, m.progress + def.inc(e));
      const done = progress >= def.target;
      if (done) {
        rewards.push({ kind: 'mission', id: def.id, title: def.title });
        addXp(def.xp, `Mission: ${def.title}`);
      }
      return { ...m, progress, done };
    });
  s.missions = { ...s.missions, daily: advance(s.missions.daily), weekly: advance(s.missions.weekly) };
  if (!s.missions.dailyBonusClaimed && s.missions.daily.length && s.missions.daily.every((m) => m.done)) {
    s.missions.dailyBonusClaimed = true;
    addXp(DAILY_ALL_BONUS, 'All daily missions complete');
  }

  // Achievements
  for (const a of ACHIEVEMENTS) {
    if (s.achievements[a.id]) continue;
    if (a.check(s, e)) {
      s.achievements = { ...s.achievements, [a.id]: now };
      rewards.push({ kind: 'achievement', id: a.id });
      addXp(50, `Achievement: ${a.title}`);
    }
  }

  // Level-ups and unlocks
  const levelAfter = levelFromXp(s.xp).level;
  if (levelAfter > levelBefore) {
    rewards.push({ kind: 'level', level: levelAfter });
    for (const u of UNLOCKS) if (u.level > levelBefore && u.level <= levelAfter) rewards.push({ kind: 'unlock', item: u.id, label: u.label });
  }
  return { state: s, rewards };
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
