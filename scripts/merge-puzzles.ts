/** Merges generator output, re-validates every puzzle and writes src/content/puzzles.json. */
import fs from 'fs';
import { Chess } from 'chess.js';
import { isLegalPosition } from '../src/chess/ChessGame';
const files = process.argv.slice(2);
const all: any[] = files.flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
const seen = new Set<string>();
const out: any[] = [];
for (const p of all) {
  const key = p.fen.split(' ').slice(0, 4).join(' ');
  if (seen.has(key) || !isLegalPosition(p.fen)) continue;
  const c = new Chess(p.fen);
  let ok = true;
  for (const m of p.moves) { try { c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }); } catch { ok = false; break; } }
  if (!ok || p.moves.length % 2 === 0) continue;
  seen.add(key);
  out.push(p);
}
out.sort((a, b) => a.rating - b.rating);
out.forEach((p, i) => { p.id = 'pz' + String(i + 1).padStart(3, '0'); });
fs.writeFileSync('src/content/puzzles.json', JSON.stringify(out));
const buckets: Record<string, number> = {}; const themes: Record<string, number> = {};
for (const p of out) { const b = Math.floor(p.rating / 200) * 200; buckets[b] = (buckets[b] || 0) + 1; for (const t of p.themes) themes[t] = (themes[t] || 0) + 1; }
console.log(out.length, 'puzzles'); console.log(buckets); console.log(themes);
