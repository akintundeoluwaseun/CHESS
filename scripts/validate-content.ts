/**
 * Validates all hand-written training content:
 *  - every FEN is legal, every scripted move is legal
 *  - learner moves (unless verify:false) are confirmed by Stockfish to be the
 *    best move or within a small margin of it
 *  - goal positions are actually winning, challenges are legal
 *   npx tsx scripts/validate-content.ts
 */
import { spawn } from 'child_process';
import { Chess } from 'chess.js';
import { LESSONS } from '../src/content/lessons';
import { CHALLENGES } from '../src/content/challenges';
import { parseSearch, scoreValue } from '../src/engine/uci';
import { isLegalPosition } from '../src/chess/ChessGame';

const enginePath: string = require('stockfish').findEngine('lite-single');
const p = spawn(process.execPath, [enginePath], { stdio: 'pipe' });
let buf = ''; let lines: string[] = []; let waiter: ((l: string[]) => void) | null = null; let until: (l: string) => boolean = () => false;
p.stdout.on('data', (d: Buffer) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); lines.push(l); if (waiter && until(l)) { const w = waiter; waiter = null; const o = lines; lines = []; w(o); } } });
const cmd = (c: string[], u: (l: string) => boolean) => new Promise<string[]>((r) => { lines = []; until = u; waiter = r; c.forEach((x) => p.stdin.write(x + '\n')); });
const search = async (fen: string, depth: number, extra = '') => parseSearch(await cmd([`position fen ${fen}${extra}`, `go depth ${depth}`], (l) => l.startsWith('bestmove')));

let errors = 0;
const err = (m: string) => { errors++; console.log('  ✗ ' + m); };

async function main() {
  await cmd(['uci'], (l) => l === 'uciok');
  await cmd(['setoption name MultiPV value 1', 'isready'], (l) => l === 'readyok');
  for (const L of LESSONS) {
    console.log(`Lesson ${L.id}`);
    for (const [si, st] of L.steps.entries()) {
      if (st.kind === 'info') { if (st.fen && !isLegalPosition(st.fen)) err(`${si} bad fen`); continue; }
      let c: Chess;
      try { c = new Chess(st.fen); } catch (e) { err(`${si} bad fen ${st.fen}: ${(e as Error).message}`); continue; }
      if (!isLegalPosition(st.fen)) { err(`${si} illegal position ${st.fen}`); continue; }
      if (c.isGameOver()) err(`${si} position already over`);
      if (st.kind === 'goal') {
        const r = await search(st.fen, 22);
        const v = scoreValue(r.lines[0]);
        console.log(`  goal ${st.title}: eval ${r.lines[0].mate !== undefined ? 'M' + r.lines[0].mate : v}`);
        if (v < 500) err(`${si} goal not clearly winning`);
        continue;
      }
      for (const [pi, ply] of st.solution.entries()) {
        const alts = ply.split('|');
        for (const a of alts) {
          const t = new Chess(c.fen());
          try { t.move({ from: a.slice(0, 2), to: a.slice(2, 4), promotion: a[4] }); } catch { err(`${si} ply ${pi} illegal ${a}`); }
        }
        if (pi % 2 === 0 && st.verify !== false) {
          const best = await search(c.fen(), 18);
          const bv = scoreValue(best.lines[0]);
          for (const a of alts) {
            const t = new Chess(c.fen());
            t.move({ from: a.slice(0, 2), to: a.slice(2, 4), promotion: a[4] });
            let av: number;
            if (t.isCheckmate()) av = 100000;
            else if (t.isDraw()) av = 0;
            else { const r = await search(t.fen(), 16); av = -scoreValue(r.lines[0]); }
            const ok = bv > 90000 ? av > 90000 : av >= bv - 70;
            console.log(`  ${si}.${pi} ${a}: ${av} (best ${best.bestmove} ${bv}) ${ok ? '✓' : ''}`);
            if (!ok) err(`${si} ${a} is not good enough (best ${best.bestmove})`);
          }
        }
        const first = alts[0];
        c.move({ from: first.slice(0, 2), to: first.slice(2, 4), promotion: first[4] });
      }
    }
  }
  console.log('Challenges');
  for (const ch of CHALLENGES) {
    if (!isLegalPosition(ch.fen)) { err(`${ch.id} illegal position`); continue; }
    if (ch.level === 10) {
      const r = await search(ch.fen, 20);
      console.log(`  ${ch.id} eval ${r.lines[0].mate !== undefined ? 'M' + r.lines[0].mate : scoreValue(r.lines[0])}`);
    }
  }
  console.log(errors ? `\n${errors} problem(s)` : '\nAll content valid');
  p.kill();
  process.exit(errors ? 1 : 0);
}
main();
