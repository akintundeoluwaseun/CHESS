import { startNodeEngine } from './nodeEngine';
import { chooseAiMove } from '@/engine/ai';
import { AI_LEVELS } from '@/engine/levels';
import { ChessGame } from '@/chess/ChessGame';
import { analyzeGame } from '@/engine/analysis';
import { Engine } from '@/engine/EngineService';
import { explainHint, describeMove, hangingPieces } from '@/engine/explain';
import { START_FEN } from '@/chess/types';

jest.setTimeout(120000);
let stop: () => void;
beforeAll(async () => { stop = await startNodeEngine(); });
afterAll(() => stop());

test('engine is ready', () => { expect(Engine.isReady).toBe(true); });

test('every level returns a legal move', async () => {
  const fens = [START_FEN, 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'];
  for (const lvl of AI_LEVELS) for (const fen of fens) {
    const mv = await chooseAiMove({ startFen: fen, moves: [], level: lvl });
    expect(new ChessGame(fen).isLegal(mv)).toBe(true);
  }
});

test('strong levels find mate in one', async () => {
  const mv = await chooseAiMove({ startFen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', moves: [], level: AI_LEVELS[4] });
  expect(mv).toBe('d1d8');
});

test('motif detection', () => {
  // Knight fork on c7 (king a8? use classic royal fork)
  expect(describeMove('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', 'b5c7').join(' ')).toMatch(/fork/);
  expect(describeMove('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'd1d8')[0]).toMatch(/checkmate/);
  expect(hangingPieces('8/8/4k3/3q4/8/8/8/3QK3 b - - 0 1', 'b').length).toBe(0);
  expect(hangingPieces('4k3/8/8/3n4/8/8/8/3QK3 b - - 0 1', 'b')[0]?.type).toBe('n');
});

test('analysis classifies a blunder', async () => {
  // 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6?? 4.Qxf7#
  const g = new ChessGame(undefined, ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6', 'h5f7']);
  const a = await analyzeGame(START_FEN, g.history(), undefined, 9);
  const nf6 = a.moves[5];
  expect(nf6.classification).toBe('blunder');
  expect(nf6.explanation).toMatch(/checkmate/);
  expect(a.moves[6].classification).toBe('best');
  const r = await Engine.search('analysis', { fen: g.history()[5].fenBefore, depth: 10 });
  expect(explainHint(g.history()[5].fenBefore, r.bestmove!, r.lines[0], r.lines[0].pv)).toMatch(/^Try /);
});
