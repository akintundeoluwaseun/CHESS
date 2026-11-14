import { ChessGame, isLegalPosition } from '@/chess/ChessGame';
import { LESSONS } from '@/content/lessons';
import { CHALLENGES } from '@/content/challenges';
import data from '@/content/puzzles.json';

type P = { id: string; fen: string; moves: string[]; rating: number; themes: string[] };
const PUZZLES = data as P[];

test('rejects positions where the side not to move is in check', () => {
  expect(isLegalPosition('k7/8/1K6/8/8/8/8/7Q w - - 0 1')).toBe(false);
  expect(isLegalPosition('k7/8/1K6/8/8/8/7Q/8 w - - 0 1')).toBe(true);
});

test('every puzzle is a legal position with a legal, solver-ending solution', () => {
  expect(PUZZLES.length).toBeGreaterThan(300);
  const ids = new Set<string>();
  for (const p of PUZZLES) {
    expect(isLegalPosition(p.fen)).toBe(true);
    expect(p.moves.length % 2).toBe(1);
    expect(() => new ChessGame(p.fen, p.moves)).not.toThrow();
    expect(ids.has(p.id)).toBe(false);
    ids.add(p.id);
  }
});

test('every lesson step is legal', () => {
  for (const l of LESSONS) for (const st of l.steps) {
    if (st.kind === 'info') { if (st.fen) expect(isLegalPosition(st.fen)).toBe(true); continue; }
    expect(isLegalPosition(st.fen)).toBe(true);
    if (st.kind === 'move') {
      const g = new ChessGame(st.fen);
      st.solution.forEach((ply) => {
        for (const alt of ply.split('|')) expect(new ChessGame(g.fen()).isLegal(alt)).toBe(true);
        g.moveUci(ply.split('|')[0]);
      });
    }
  }
});

test('every challenge position is legal', () => {
  for (const c of CHALLENGES) expect(isLegalPosition(c.fen)).toBe(true);
});
