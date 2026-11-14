import { spawn, ChildProcess } from 'child_process';
import { Engine, WorkerId } from '@/engine/EngineService';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const enginePath: string = require('stockfish').findEngine('lite-single');

/** Test transport: the same Stockfish build the app embeds, run as a Node child process. */
export async function startNodeEngine() {
  const procs = {} as Record<WorkerId, ChildProcess>;
  for (const id of ['play', 'analysis'] as WorkerId[]) {
    const p = spawn(process.execPath, [enginePath], { stdio: 'pipe' });
    let buf = '';
    p.stdout!.on('data', (d: Buffer) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line) Engine.onLine(id, line);
      }
    });
    procs[id] = p;
  }
  Engine.attach({ send: (w, cmd) => procs[w].stdin!.write(cmd + '\n') });
  await Engine.handshake();
  return () => { for (const id of ['play', 'analysis'] as WorkerId[]) procs[id].kill(); Engine.detach(); };
}
