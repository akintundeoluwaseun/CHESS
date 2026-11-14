import { applyEvent, initialProgress, ensureMissions, weekKey } from '@/progression/progress';
import { levelFromXp, updateRating } from '@/progression/levels';
import type { GameRecord } from '@/progression/types';

const rec = (over: Partial<GameRecord>): GameRecord => ({
  id: 'g', mode: 'ai', startedAt: 0, endedAt: 0, startFen: '', uci: new Array(30).fill('e2e4'), san: [],
  playerColor: 'w', aiLevel: 3, result: { winner: 'w', reason: 'checkmate' }, outcome: 'win', xpEarned: 0,
  timeControl: { minutes: 0, increment: 0 }, usedUndo: false, hintsUsed: 0, renderMode: '2d', ...over,
});

test('level curve', () => {
  expect(levelFromXp(0).level).toBe(1);
  expect(levelFromXp(100).level).toBe(2);
  expect(levelFromXp(239).level).toBe(2);
  expect(levelFromXp(240).level).toBe(3);
});

test('elo moves toward result', () => {
  expect(updateRating(800, 1000, 1, 0)).toBeGreaterThan(800);
  expect(updateRating(800, 400, 0, 0)).toBeLessThan(800);
});

test('win awards xp, counters, achievements', () => {
  const now = new Date(2026, 10, 12, 12).getTime();
  const { state, rewards } = applyEvent(initialProgress(now), { type: 'game', record: rec({}), promoted: false, castled: true, minMaterial: 0 }, now);
  expect(state.counters.wins).toBe(1);
  expect(state.achievements['first-win']).toBeTruthy();
  expect(state.xp).toBeGreaterThan(0);
  expect(rewards.some((r) => r.kind === 'achievement')).toBe(true);
  expect(state.streak.current).toBe(1);
});

test('instant resign earns nothing', () => {
  const s0 = initialProgress();
  const { state } = applyEvent(s0, { type: 'game', record: rec({ uci: ['e2e4'], outcome: 'loss', result: { winner: 'b', reason: 'resign' } }), promoted: false, castled: false, minMaterial: 0 });
  expect(state.xp).toBe(0);
});

test('ranked updates rating', () => {
  const { state } = applyEvent(initialProgress(), { type: 'game', record: rec({ mode: 'ranked', aiLevel: 3 }), promoted: false, castled: false, minMaterial: 0 });
  expect(state.rating).toBeGreaterThan(800);
  expect(state.ratingHistory.length).toBe(1);
});

test('missions roll over and are deterministic', () => {
  const t = new Date(2026, 10, 12).getTime();
  const a = ensureMissions(initialProgress(), t);
  const b = ensureMissions(initialProgress(), t);
  expect(a.missions.daily.map((m) => m.id)).toEqual(b.missions.daily.map((m) => m.id));
  expect(a.missions.daily.length).toBe(3);
  expect(weekKey(new Date(2026, 10, 12).getTime())).toBe(weekKey(new Date(2026, 10, 15).getTime()));
});

test('streak increments on consecutive days and resets after gap', () => {
  const d1 = new Date(2026, 10, 10, 10).getTime();
  const d2 = new Date(2026, 10, 11, 10).getTime();
  const d4 = new Date(2026, 10, 13, 10).getTime();
  let s = applyEvent(initialProgress(d1), { type: 'lesson', id: 'a' }, d1).state;
  s = applyEvent(s, { type: 'lesson', id: 'b' }, d2).state;
  expect(s.streak.current).toBe(2);
  s = applyEvent(s, { type: 'lesson', id: 'c' }, d4).state;
  expect(s.streak.current).toBe(1);
  expect(s.streak.best).toBe(2);
});
