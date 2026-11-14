/** Plays AI levels against each other to confirm each level is genuinely stronger.
 *   npx tsx scripts/calibrate.ts */
import { startNodeEngine } from '../src/__tests__/nodeEngine';
import { chooseAiMove } from '../src/engine/ai';
import { getLevel } from '../src/engine/levels';
import { ChessGame } from '../src/chess/ChessGame';

async function play(white: number, black: number): Promise<number> {
  const g = new ChessGame();
  while (!g.status() && g.plyCount() < 240) {
    const lvl = getLevel(g.turn() === 'w' ? white : black);
    const mv = await chooseAiMove({ startFen: g.startFen, moves: g.uciHistory(), level: lvl });
    if (!g.moveUci(mv)) throw new Error('illegal ' + mv);
  }
  const st = g.status();
  if (!st || st.winner === null) return 0.5;
  return st.winner === 'w' ? 1 : 0;
}

async function main() {
  const stop = await startNodeEngine();
  const pairs: [number, number, number][] = process.argv[2] ? JSON.parse(process.argv[2]) : [[1, 2, 6], [2, 3, 6], [3, 4, 6], [4, 5, 6], [5, 7, 4]];
  for (const [a, b, n] of pairs) {
    let scoreB = 0;
    for (let i = 0; i < n; i++) {
      const bWhite = i % 2 === 0;
      const r = bWhite ? await play(b, a) : await play(a, b);
      scoreB += bWhite ? r : 1 - r;
    }
    console.log(`Level ${b} vs Level ${a}: ${scoreB}/${n}`);
  }
  stop();
  process.exit(0);
}
main();
