import { parseSearch, SearchResult } from './uci';

/**
 * Two independent Stockfish instances:
 *  - 'play':     makes the AI opponent's moves (often strength-limited)
 *  - 'analysis': always full strength; hints, coaching and post-game review
 * Keeping them separate means analysis never leaks a strength setting into
 * play and vice versa.
 */
export type WorkerId = 'play' | 'analysis';

export interface EngineTransport {
  send(worker: WorkerId, cmd: string): void;
}

export interface SearchParams {
  fen: string;
  /** Optional: start fen + moves gives the engine repetition history. */
  startFen?: string;
  moves?: string[];
  depth?: number;
  movetime?: number;
  multipv?: number;
  /** Set to limit strength (UCI_Elo); undefined = full strength. */
  elo?: number;
}

interface Job {
  cmds: string[];
  done: (line: string) => boolean;
  lines: string[];
  resolve: (lines: string[]) => void;
  reject: (e: Error) => void;
  started: boolean;
  timer?: ReturnType<typeof setTimeout>;
  timeoutMs: number;
}

type Listener = (ready: boolean, error?: string) => void;

class EngineServiceImpl {
  private transport: EngineTransport | null = null;
  private queues: Record<WorkerId, Job[]> = { play: [], analysis: [] };
  private options: Record<WorkerId, Record<string, string>> = { play: {}, analysis: {} };
  private readyFlag = false;
  private error: string | undefined;
  private listeners = new Set<Listener>();
  private readyWaiters: (() => void)[] = [];

  attach(t: EngineTransport) {
    this.transport = t;
  }
  detach() {
    this.transport = null;
    this.readyFlag = false;
    for (const id of ['play', 'analysis'] as WorkerId[]) {
      for (const j of this.queues[id]) j.reject(new Error('Engine detached'));
      this.queues[id] = [];
      this.options[id] = {};
    }
    this.emit();
  }

  get isReady() { return this.readyFlag; }
  get lastError() { return this.error; }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  }
  private emit() { for (const l of this.listeners) l(this.readyFlag, this.error); }

  /** Called by the host when both workers have been created. */
  async handshake() {
    try {
      await Promise.all((['play', 'analysis'] as WorkerId[]).map(async (w) => {
        await this.run(w, ['uci'], (l) => l === 'uciok', 20000);
        await this.run(w, ['setoption name Hash value 16', 'isready'], (l) => l === 'readyok', 20000);
      }));
      this.readyFlag = true;
      this.error = undefined;
      this.readyWaiters.splice(0).forEach((r) => r());
    } catch (e) {
      this.error = (e as Error).message;
    }
    this.emit();
  }
  /** A worker crashed and was recreated by the host: fail its jobs and re-initialise it. */
  async onCrash(worker: WorkerId) {
    const jobs = this.queues[worker];
    this.queues[worker] = [];
    this.options[worker] = {};
    for (const j of jobs) {
      if (j.timer) clearTimeout(j.timer);
      j.reject(new Error('The engine restarted. Please try again.'));
    }
    try {
      await this.run(worker, ['uci'], (l) => l === 'uciok', 20000);
      await this.run(worker, ['setoption name Hash value 16', 'isready'], (l) => l === 'readyok', 20000);
    } catch (e) {
      this.fail((e as Error).message);
    }
  }

  fail(message: string) {
    this.error = message;
    this.readyFlag = false;
    this.emit();
  }

  whenReady(timeoutMs = 30000): Promise<void> {
    if (this.readyFlag) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('The chess engine did not start. Please restart the app.')), timeoutMs);
      this.readyWaiters.push(() => { clearTimeout(t); resolve(); });
    });
  }

  /** Host → service: one line of engine output. */
  onLine(worker: WorkerId, line: string) {
    const job = this.queues[worker][0];
    if (!job || !job.started) return;
    job.lines.push(line);
    if (job.done(line)) {
      if (job.timer) clearTimeout(job.timer);
      this.queues[worker].shift();
      job.resolve(job.lines);
      this.pump(worker);
    }
  }

  private run(worker: WorkerId, cmds: string[], done: (l: string) => boolean, timeoutMs = 60000): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.queues[worker].push({ cmds, done, lines: [], resolve, reject, started: false, timeoutMs });
      if (this.queues[worker].length === 1) this.pump(worker);
    });
  }

  private pump(worker: WorkerId) {
    const job = this.queues[worker][0];
    if (!job || job.started) return;
    if (!this.transport) {
      this.queues[worker].shift();
      job.reject(new Error('Engine not available'));
      this.pump(worker);
      return;
    }
    job.started = true;
    job.timer = setTimeout(() => {
      // Safety net: ask the engine to stop; if it still never answers, fail the job.
      this.transport?.send(worker, 'stop');
      job.timer = setTimeout(() => {
        if (this.queues[worker][0] === job) {
          this.queues[worker].shift();
          job.reject(new Error('Engine timed out'));
          this.pump(worker);
        }
      }, 3000);
    }, job.timeoutMs);
    for (const c of job.cmds) this.transport.send(worker, c);
  }

  private optionCmds(worker: WorkerId, wanted: Record<string, string>): string[] {
    const cmds: string[] = [];
    for (const [k, v] of Object.entries(wanted)) {
      if (this.options[worker][k] !== v) {
        cmds.push(`setoption name ${k} value ${v}`);
        this.options[worker][k] = v;
      }
    }
    return cmds;
  }

  newGame(worker: WorkerId) {
    if (!this.readyFlag) return Promise.resolve([] as string[]);
    return this.run(worker, ['ucinewgame', 'isready'], (l) => l === 'readyok');
  }

  /** Interrupt the current search on a worker; its promise still resolves with a bestmove. */
  stop(worker: WorkerId) {
    const job = this.queues[worker][0];
    if (job?.started) this.transport?.send(worker, 'stop');
    // Drop pending (not yet started) searches.
    const rest = this.queues[worker].slice(1);
    this.queues[worker] = job ? [job] : [];
    for (const j of rest) j.reject(new Error('cancelled'));
  }

  async search(worker: WorkerId, p: SearchParams): Promise<SearchResult> {
    await this.whenReady();
    const opts: Record<string, string> = {
      MultiPV: String(p.multipv ?? 1),
      UCI_LimitStrength: p.elo ? 'true' : 'false',
    };
    if (p.elo) opts.UCI_Elo = String(Math.max(1320, Math.min(3190, Math.round(p.elo))));
    const position = p.moves && p.moves.length && p.startFen
      ? `position fen ${p.startFen} moves ${p.moves.join(' ')}`
      : `position fen ${p.fen}`;
    const go = p.depth !== undefined
      ? `go depth ${p.depth}${p.movetime ? ` movetime ${p.movetime}` : ''}`
      : `go movetime ${p.movetime ?? 500}`;
    const budget = (p.movetime ?? 0) + (p.depth ? p.depth * 1500 : 0) + 15000;
    const lines = await this.run(worker, [...this.optionCmds(worker, opts), position, go], (l) => l.startsWith('bestmove'), budget);
    return parseSearch(lines);
  }
}

export const Engine = new EngineServiceImpl();
export type EngineService = EngineServiceImpl;
