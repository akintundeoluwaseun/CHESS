/**
 * Puzzle generator. Plays engine games with deliberately imperfect moves,
 * finds positions right after a mistake where the side to move has a single
 * clearly-winning continuation, verifies the full solution line at higher
 * depth, tags themes, and estimates difficulty.
 *
 *   npx tsx scripts/generate-puzzles.ts <count> <outfile> <seed>
 */
import { spawn } from 'child_process';
import fs from 'fs';
import { Chess } from 'chess.js';
import { parseSearch, scoreValue, SearchResult } from '../src/engine/uci';
import { describeMove, pvMaterialGain } from '../src/engine/explain';
import { materialBalance } from '../src/chess/ChessGame';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const enginePath: string = require('stockfish').findEngine('lite-single');

class Sf {
  private p = spawn(process.execPath, [enginePath], { stdio: 'pipe' });
  private buf = '';
  private lines: string[] = [];
  private waiter: ((l: string[]) => void) | null = null;
  private until: (l: string) => boolean = () => false;
  constructor() {
    this.p.stdout.on('data', (d: Buffer) => {
      this.buf += d.toString();
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const l = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        this.lines.push(l);
        if (this.waiter && this.until(l)) {
          const w = this.waiter; this.waiter = null;
          const out = this.lines; this.lines = [];
          w(out);
        }
      }
    });
  }
  cmd(c: string[], until: (l: string) => boolean): Promise<string[]> {
    return new Promise((r) => { this.lines = []; this.until = until; this.waiter = r; for (const x of c) this.p.stdin.write(x + '\n'); });
  }
  async init() { await this.cmd(['uci'], (l) => l === 'uciok'); await this.cmd(['setoption name Hash value 32', 'isready'], (l) => l === 'readyok'); }
  async search(fen: string, depth: number, multipv = 1): Promise<SearchResult> {
    const l = await this.cmd([`setoption name MultiPV value ${multipv}`, `position fen ${fen}`, `go depth ${depth}`], (x) => x.startsWith('bestmove'));
    return parseSearch(l);
  }
  kill() { this.p.kill(); }
}

let seed = Number(process.argv[4] ?? 1);
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

interface Puzzle { id: string; fen: string; moves: string[]; rating: number; themes: string[]; }

function play(c: Chess, u: string) { return c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); }

async function selfPlayGame(sf: Sf): Promise<string[]> {
  const c = new Chess();
  const fens: string[] = [];
  const weakness = 0.15 + rnd() * 0.35;
  for (let ply = 0; ply < 140 && !c.isGameOver(); ply++) {
    const depth = ply < 8 ? 6 : 3 + Math.floor(rnd() * 4);
    const r = await sf.search(c.fen(), depth, 4);
    const cands = r.lines.map((l) => ({ m: l.pv[0], s: scoreValue(l) })).filter((x) => x.m);
    let mv = cands[0]?.m ?? r.bestmove!;
    if (ply < 8) mv = cands[Math.floor(rnd() * Math.min(4, cands.length))].m;
    else if (rnd() < weakness && cands.length > 1) mv = cands[1 + Math.floor(rnd() * (cands.length - 1))].m;
    play(c, mv);
    fens.push(c.fen());
  }
  return fens;
}

function gap(r: SearchResult): number {
  if (r.lines.length < 2) return 99999;
  return scoreValue(r.lines[0]) - scoreValue(r.lines[1]);
}

async function tryPuzzle(sf: Sf, fen: string, prevFen: string | null): Promise<Puzzle | null> {
  const r = await sf.search(fen, 13, 2);
  const top = r.lines[0];
  if (!top || !r.bestmove) return null;
  const best = scoreValue(top);
  const isMate = top.mate !== undefined && top.mate > 0 && top.mate <= 4;
  if (!isMate && best < 220) return null;
  if (!isMate && best > 2500) return null;
  if (gap(r) < (isMate ? 300 : 260)) return null;
  // Must arise from a mistake: the solver was not already winning before the opponent's move.
  if (prevFen) {
    const pr = await sf.search(prevFen, 11, 1);
    if (!pr.lines[0]) return null;
    const before = -scoreValue(pr.lines[0]); // solver's perspective
    if (before > 150) return null;
  }
  const c = new Chess(fen);
  const solver = c.turn();
  const moves: string[] = [];
  let curFen = fen;
  for (let step = 0; step < 4; step++) {
    const rr = step === 0 ? r : await sf.search(curFen, 15, 2);
    if (!rr.bestmove) return null;
    if (step > 0) {
      const t = rr.lines[0];
      const mateNow = t?.mate !== undefined && t.mate > 0;
      if (gap(rr) < (mateNow ? 300 : 260)) {
        // ambiguous continuation: end the puzzle at the previous solver move (if it already stands on its own)
        break;
      }
    }
    play(c, rr.bestmove);
    moves.push(rr.bestmove);
    curFen = c.fen();
    if (c.isCheckmate()) break;
    if (c.isGameOver()) return null;
    // opponent's best reply
    const opp = await sf.search(curFen, 13, 1);
    if (!opp.bestmove) return null;
    // stop when the point has been made and is not just a capture that gets recaptured
    const gained = (materialBalance(new Chess(curFen).fen()) - materialBalance(fen)) * (solver === 'w' ? 1 : -1);
    const afterReply = new Chess(curFen);
    play(afterReply, opp.bestmove);
    const keep = (materialBalance(afterReply.fen()) - materialBalance(fen)) * (solver === 'w' ? 1 : -1);
    if (!isMate && gained >= 2 && keep >= 2 && step >= 0) {
      break;
    }
    if (step === 3) return null; // too long
    play(c, opp.bestmove);
    moves.push(opp.bestmove);
    curFen = c.fen();
  }
  if (moves.length % 2 === 0) return null; // must end on a solver move
  if (process.env.HARD && moves.length < 3) return null; // multi-move puzzles only
  const end = new Chess(fen);
  for (const m of moves) play(end, m);
  const mated = end.isCheckmate();
  if (isMate && !mated) return null;
  if (!mated) {
    const fin = await sf.search(end.fen(), 13, 1);
    const gainEnd = (materialBalance(end.fen()) - materialBalance(fen)) * (solver === 'w' ? 1 : -1)
      + pvMaterialGain(end.fen(), fin.lines[0]?.pv ?? [], 2) * -1;
    if (gainEnd < 2) return null;
    const evalEnd = fin.lines[0] ? -scoreValue(fin.lines[0]) : 0;
    if (evalEnd < 200) return null;
  }

  // Themes
  const themes = new Set<string>();
  const solverMoves = Math.ceil(moves.length / 2);
  if (mated) {
    themes.add('mate');
    themes.add(`mateIn${solverMoves}`);
    const last = new Chess(fen); moves.slice(0, -1).forEach((m) => play(last, m));
    const lm = play(last, moves[moves.length - 1]);
    const kingSq = last.findPiece({ type: 'k', color: last.turn() })[0];
    if ((lm.piece === 'r' || lm.piece === 'q') && kingSq && (kingSq[1] === '1' || kingSq[1] === '8') && lm.to[1] === kingSq[1]) themes.add('backRankMate');
    if (lm.piece === 'n') themes.add('smotheredOrKnightMate');
  } else themes.add(solverMoves === 1 ? 'oneMove' : solverMoves === 2 ? 'short' : 'long');
  const pos = new Chess(fen);
  moves.forEach((m, i) => {
    if (i % 2 === 0) {
      const d = describeMove(pos.fen(), m).join(' ');
      if (/fork/.test(d)) themes.add('fork');
      if (/pins/.test(d)) themes.add('pin');
      if (/skewers/.test(d)) themes.add('skewer');
      if (/promotes/.test(d)) themes.add('promotion');
    }
    play(pos, m);
  });
  const first = new Chess(fen);
  const fm = play(first, moves[0]);
  if (fm.captured) {
    const defenders = new Chess(fen).attackers(fm.to, first.turn());
    if (!defenders.length) themes.add('hangingPiece');
  }
  // sacrifice: the first move loses material after the opponent's reply
  if (moves.length >= 3) {
    const s2 = new Chess(fen); play(s2, moves[0]); play(s2, moves[1]);
    const delta = (materialBalance(s2.fen()) - materialBalance(fen)) * (solver === 'w' ? 1 : -1);
    if (delta <= -2) themes.add('sacrifice');
  }
  const pieceCount = fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
  if (pieceCount <= 10) themes.add('endgame');
  const quiet = !fm.captured && !first.inCheck();
  if (quiet) themes.add('quietMove');

  // Difficulty: shallowest depth at which the engine already finds the first move.
  let found = 14;
  for (const d of [1, 2, 3, 4, 6, 8, 10, 12]) {
    const t = await sf.search(fen, d, 1);
    if (t.bestmove === moves[0]) { found = d; break; }
  }
  let rating = mated ? 650 + 300 * (solverMoves - 1) : 900 + 260 * (solverMoves - 1);
  rating += found * 45;
  if (themes.has('sacrifice')) rating += 150;
  if (quiet) rating += 120;
  if (themes.has('hangingPiece') && solverMoves === 1) rating -= 150;
  rating = Math.max(500, Math.min(2400, Math.round(rating / 10) * 10));
  return { id: '', fen, moves, rating, themes: [...themes] };
}

async function main() {
  const target = Number(process.argv[2] ?? 50);
  const out = process.argv[3] ?? 'puzzles.json';
  const sf = new Sf();
  await sf.init();
  const puzzles: Puzzle[] = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : [];
  const seen = new Set(puzzles.map((p) => p.fen.split(' ').slice(0, 4).join(' ')));
  let games = 0;
  while (puzzles.length < target) {
    const fens = await selfPlayGame(sf);
    games++;
    let lastTaken = -10;
    const quick: SearchResult[] = [];
    for (const f of fens) quick.push(await sf.search(f, 8, 2));
    for (let i = 12; i < fens.length - 1; i++) {
      if (i - lastTaken < 6) continue;
      const key = fens[i].split(' ').slice(0, 4).join(' ');
      if (seen.has(key)) continue;
      const q = quick[i], qp = quick[i - 1];
      if (!q.lines[0] || !qp.lines[0]) continue;
      const qb = scoreValue(q.lines[0]);
      if (qb < 180 || gap(q) < 180) continue;
      if (-scoreValue(qp.lines[0]) > 150) continue;
      const p = await tryPuzzle(sf, fens[i], fens[i - 1]);
      if (p) {
        seen.add(key);
        lastTaken = i;
        p.id = 'p' + String(puzzles.length + 1).padStart(4, '0') + '-' + (seed % 9973);
        puzzles.push(p);
        fs.writeFileSync(out, JSON.stringify(puzzles));
        console.log(`[${puzzles.length}/${target}] games=${games} rating=${p.rating} ${p.themes.join(',')}`);
        if (puzzles.length >= target) break;
      }
    }
  }
  sf.kill();
}
main();
