import { ChessGame, hasMatingMaterial, materialFromHistory } from '@/chess/ChessGame';
import { trackPieces } from '@/chess/pieceIds';

describe('ChessGame rules', () => {
  test('castling both sides', () => {
    const g = new ChessGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(g.isLegal('e1g1')).toBe(true);
    expect(g.isLegal('e1c1')).toBe(true);
    g.moveUci('e1g1');
    expect(g.get('f1')?.type).toBe('r');
    g.moveUci('e8c8');
    expect(g.get('d8')?.type).toBe('r');
  });
  test('castling blocked through check', () => {
    const g = new ChessGame('4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1');
    expect(g.isLegal('e1g1')).toBe(false);
  });
  test('en passant', () => {
    const g = new ChessGame(undefined, ['e2e4', 'a7a6', 'e4e5', 'd7d5']);
    expect(g.isLegal('e5d6')).toBe(true);
    const r = g.moveUci('e5d6')!;
    expect(r.flags).toContain('e');
    expect(g.get('d5')).toBeFalsy();
  });
  test('promotion requires a piece choice', () => {
    const g = new ChessGame('8/P7/8/8/8/8/k7/4K3 w - - 0 1');
    expect(g.isPromotion('a7', 'a8')).toBe(true);
    expect(g.move('a7', 'a8')).toBeNull();
    expect(g.move('a7', 'a8', 'n')?.promotion).toBe('n');
  });
  test('checkmate, stalemate, insufficient', () => {
    const fool = new ChessGame(undefined, ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    expect(fool.status()).toEqual({ winner: 'b', reason: 'checkmate' });
    const stale = new ChessGame('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(stale.status()?.reason).toBe('stalemate');
    expect(new ChessGame('8/8/8/4k3/8/8/2B5/4K3 w - - 0 1').status()?.reason).toBe('insufficient');
  });
  test('threefold repetition', () => {
    const g = new ChessGame(undefined, ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']);
    expect(g.status()?.reason).toBe('threefold');
  });
  test('illegal moves rejected, undo works', () => {
    const g = new ChessGame();
    expect(g.moveUci('e2e5')).toBeNull();
    g.moveUci('e2e4');
    expect(g.undo()?.uci).toBe('e2e4');
    expect(g.plyCount()).toBe(0);
  });
  test('timeout vs insufficient material is a draw', () => {
    const g = new ChessGame('8/8/8/4k3/8/8/8/R3K3 b - - 0 1');
    expect(g.timeoutResult('w').winner).toBeNull();
    expect(g.timeoutResult('b').winner).toBe('w');
    expect(hasMatingMaterial('8/8/8/4k3/8/8/2N5/4K3 w - - 0 1', 'w')).toBe(false);
  });
  test('material and piece tracking', () => {
    const g = new ChessGame(undefined, ['e2e4', 'd7d5', 'e4d5', 'd8d5']);
    const m = materialFromHistory(g.history());
    expect(m.diff).toBe(0);
    expect(m.capturedBy.w).toEqual(['p']);
    const t = trackPieces(g.startFen, g.history());
    expect(t.pieces.length).toBe(30);
    expect(t.lastCaptured?.type).toBe('p');
    const castle = new ChessGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', ['e1g1']);
    const tp = trackPieces(castle.startFen, castle.history()).pieces;
    expect(tp.find((p) => p.square === 'f1')?.type).toBe('r');
  });
});
