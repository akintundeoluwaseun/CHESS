import { create } from 'zustand';
import { ChessGame, materialBalance } from '@/chess/ChessGame';
import type { Color, GameResult, MoveRecord, PieceSymbol, Square } from '@/chess/types';
import { other } from '@/chess/types';
import { chooseAiMove } from '@/engine/ai';
import { Engine } from '@/engine/EngineService';
import { getLevel, humanDelayMs } from '@/engine/levels';
import { Classification, describeMove, explainHint, explainMove } from '@/engine/explain';
import { evaluatePosition } from '@/engine/analysis';
import type { GameConfig } from '@/modes/modes';
import { useActiveGame, SavedGame } from '@/data/activeGame';
import { useGames } from '@/data/gamesStore';
import { useProgress } from '@/data/progressStore';
import { useSettings } from '@/data/settings';
import { CHALLENGES } from '@/content/challenges';
import type { GameRecord, Reward } from '@/progression/types';
import { moveSound, sfx } from '@/audio/sound';

export interface Hint { move: string; text: string }
export interface CoachNote { classification: Classification; text: string; ply: number }

interface SessionState {
  config: GameConfig | null;
  moves: MoveRecord[];
  fen: string;
  clocks: { w: number; b: number };
  clockHistory: { w: number; b: number }[];
  turnStartedAt: number | null;
  result: GameResult | null;
  aiThinking: boolean;
  engineError: string | null;
  hint: Hint | null;
  hintLoading: boolean;
  coach: CoachNote | null;
  drawOfferPending: boolean;
  notice: string | null;
  usedUndo: boolean;
  hintsUsed: number;
  startedAt: number;
  minMaterial: number;
  finished: { record: GameRecord; rewards: Reward[]; challengeSuccess?: boolean } | null;
  viewMode: '2d' | '3d' | null;
  setViewMode: (v: '2d' | '3d') => void;

  start: (config: GameConfig) => void;
  resume: (saved: SavedGame) => boolean;
  pause: () => void;
  unpause: () => void;
  userMove: (from: Square, to: Square, promotion?: PieceSymbol) => boolean;
  undo: () => void;
  resign: () => void;
  offerDraw: () => Promise<void>;
  requestHint: () => Promise<void>;
  retryEngine: () => void;
  checkFlag: () => void;
  dismissCoach: () => void;
  clear: () => void;
}

let game = new ChessGame();
let gen = 0; // generation token: bumps cancel any in-flight AI/coach work
let flagTimer: ReturnType<typeof setInterval> | null = null;

export function currentGame() { return game; }

export function remaining(s: Pick<SessionState, 'clocks' | 'turnStartedAt' | 'fen'>, color: Color, now = Date.now()) {
  const turn = s.fen.split(' ')[1] as Color;
  if (turn === color && s.turnStartedAt) return Math.max(0, s.clocks[color] - (now - s.turnStartedAt));
  return s.clocks[color];
}

const timed = (c: GameConfig | null) => !!c && c.timeControl.minutes > 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const useSession = create<SessionState>()((set, get) => {
  const persistActive = () => {
    const s = get();
    if (!s.config || s.result) return;
    const clocks = { w: remaining(s, 'w'), b: remaining(s, 'b') };
    useActiveGame.getState().save({
      config: s.config, uci: game.uciHistory(), clocks, clockHistory: s.clockHistory,
      usedUndo: s.usedUndo, hintsUsed: s.hintsUsed, startedAt: s.startedAt, minMaterial: s.minMaterial, savedAt: Date.now(),
    });
  };

  const startFlagTimer = () => {
    stopFlagTimer();
    if (timed(get().config)) flagTimer = setInterval(() => get().checkFlag(), 250);
  };
  const stopFlagTimer = () => {
    if (flagTimer) clearInterval(flagTimer);
    flagTimer = null;
  };

  const playerMoveCount = () => {
    const c = get().config;
    if (!c?.playerColor) return 0;
    return game.history().filter((m) => m.color === c.playerColor).length;
  };

  const afterMove = (rec: MoveRecord) => {
    const s = get();
    const now = Date.now();
    const clocks = { ...s.clocks };
    if (timed(s.config)) {
      clocks[rec.color] = remaining(s, rec.color, now) + s.config!.timeControl.increment * 1000;
    }
    const pc = s.config?.playerColor ?? 'w';
    const bal = materialBalance(rec.fenAfter) * (pc === 'w' ? 1 : -1);
    set({
      moves: [...game.history()],
      fen: game.fen(),
      clocks,
      clockHistory: [...s.clockHistory, clocks],
      turnStartedAt: timed(s.config) ? now : null,
      hint: null,
      drawOfferPending: false,
      notice: null,
      minMaterial: Math.min(s.minMaterial, bal),
    });
    moveSound(rec, game.inCheck());
    const status = game.status();
    if (status) {
      finish(status);
      return;
    }
    const cfg = get().config!;
    if (cfg.goal?.maxMoves && rec.color === cfg.playerColor && playerMoveCount() >= cfg.goal.maxMoves) {
      if (cfg.goal.kind === 'win') {
        finish({ winner: other(cfg.playerColor!), reason: 'challenge-limit' });
        return;
      }
      if (cfg.goal.kind === 'notLose') {
        finish({ winner: null, reason: 'challenge-limit' });
        return;
      }
    }
    persistActive();
    maybeAi();
  };

  const maybeAi = async () => {
    const s = get();
    const c = s.config;
    if (!c || s.result || c.aiLevel === null || c.playerColor === null) return;
    if (game.turn() === c.playerColor) return;
    const my = ++gen;
    set({ aiThinking: true, engineError: null });
    try {
      const level = getLevel(c.aiLevel);
      const startFen = game.startFen;
      const moves = game.uciHistory();
      const [mv] = await Promise.all([
        chooseAiMove({ startFen, moves, level }),
        sleep(humanDelayMs(level, moves.length)),
      ]);
      if (my !== gen || get().result) return;
      const tookMs = get().turnStartedAt ? Date.now() - get().turnStartedAt! : undefined;
      const rec = game.moveUci(mv, tookMs);
      set({ aiThinking: false });
      if (!rec) throw new Error('Engine move was rejected by the rules');
      afterMove(rec);
    } catch (e) {
      if (my !== gen) return;
      set({ aiThinking: false, engineError: (e as Error).message || 'Engine error' });
    }
  };

  const coachMove = async (rec: MoveRecord) => {
    const s = get();
    const c = s.config;
    if (!c || c.rated || !c.allowHints || c.aiLevel === null || !useSettings.getState().coachTips) return;
    if (!Engine.isReady) return;
    const my = gen;
    try {
      const before = await evaluatePosition(rec.fenBefore, 10);
      const after = await evaluatePosition(rec.fenAfter, 10);
      if (my !== gen && get().moves.length < game.plyCount()) return;
      if (get().config?.id !== c.id) return;
      if (after.score.mate === 0) return; // checkmate speaks for itself
      const ex = explainMove({
        fenBefore: rec.fenBefore, played: rec.uci, bestScore: before.score, bestMove: before.best, bestPv: before.pv,
        replyScore: after.score, replyPv: after.pv, legalCount: new ChessGame(rec.fenBefore).legalMovesUci().length,
      });
      const notable = ['inaccuracy', 'mistake', 'blunder'].includes(ex.classification)
        || (ex.classification === 'best' && /fork|pins|skewers|checkmate|captures the (queen|rook)/.test(describeMove(rec.fenBefore, rec.uci).join(' ')));
      // Only attach to the move if the game is still at or after it.
      if (notable && game.history().some((m) => m === rec || (m.fenBefore === rec.fenBefore && m.uci === rec.uci))) {
        set({ coach: { classification: ex.classification, text: ex.text, ply: game.history().indexOf(rec) + 1 } });
      }
    } catch {
      /* coaching is best-effort */
    }
  };

  const finish = (result: GameResult) => {
    gen++;
    stopFlagTimer();
    Engine.stop('play');
    const s = get();
    const c = s.config!;
    const pc = c.playerColor;
    const outcome: GameRecord['outcome'] = pc === null ? null : result.winner === null ? 'draw' : result.winner === pc ? 'win' : 'loss';
    const now = Date.now();
    const finalClocks = { w: remaining(s, 'w', now), b: remaining(s, 'b', now) };
    const history = game.history();
    const record: GameRecord = {
      id: c.id, mode: c.mode, startedAt: s.startedAt, endedAt: now, startFen: game.startFen,
      uci: history.map((m) => m.uci), san: history.map((m) => m.san), playerColor: pc, aiLevel: c.aiLevel,
      result, outcome, xpEarned: 0, timeControl: c.timeControl, usedUndo: s.usedUndo, hintsUsed: s.hintsUsed,
      renderMode: get().viewMode ?? useSettings.getState().renderMode, challengeId: c.challengeId,
    };
    const progress = useProgress.getState();
    const ratingBefore = progress.rating;
    const last = history[history.length - 1];
    const mine = history.filter((m) => m.color === pc);
    let rewards = progress.dispatch({
      type: 'game', record,
      mateByPiece: result.reason === 'checkmate' && last ? last.piece : null,
      promoted: mine.some((m) => !!m.promotion),
      castled: mine.some((m) => m.flags.includes('k') || m.flags.includes('q')),
      minMaterial: s.minMaterial,
    });
    let challengeSuccess: boolean | undefined;
    if (c.challengeId) {
      challengeSuccess = c.goal?.kind === 'notLose' ? outcome !== 'loss' : outcome === 'win';
      if (challengeSuccess) {
        const ch = CHALLENGES.find((x) => x.id === c.challengeId);
        rewards = [...rewards, ...useProgress.getState().dispatch({ type: 'challenge', id: c.challengeId, tier: ch?.tier ?? 1 })];
      }
    }
    record.xpEarned = rewards.reduce((a, r) => a + (r.kind === 'xp' ? r.amount : 0), 0);
    if (c.rated) {
      record.ratingBefore = ratingBefore;
      record.ratingAfter = useProgress.getState().rating;
    }
    useGames.getState().add(record);
    useActiveGame.getState().clear();
    set({ result, aiThinking: false, clocks: finalClocks, turnStartedAt: null, hint: null, finished: { record, rewards, challengeSuccess } });
    const good = challengeSuccess ?? (outcome === 'win' || (outcome === null && result.winner !== null));
    setTimeout(() => sfx(outcome === 'draw' || (outcome === null && result.winner === null) ? 'draw' : good ? 'win' : 'lose'), 250);
  };

  const fresh = (config: GameConfig) => {
    const ms = config.timeControl.minutes * 60000;
    return {
      config, moves: [], fen: game.fen(), clocks: { w: ms, b: ms }, clockHistory: [], turnStartedAt: timed(config) ? Date.now() : null,
      result: null, aiThinking: false, engineError: null, hint: null, hintLoading: false, coach: null, drawOfferPending: false, notice: null,
      usedUndo: false, hintsUsed: 0, startedAt: Date.now(), minMaterial: 0, finished: null, viewMode: config.view ?? null,
    };
  };

  return {
    config: null, moves: [], fen: game.fen(), clocks: { w: 0, b: 0 }, clockHistory: [], turnStartedAt: null, result: null,
    aiThinking: false, engineError: null, hint: null, hintLoading: false, coach: null, drawOfferPending: false, notice: null,
    usedUndo: false, hintsUsed: 0, startedAt: 0, minMaterial: 0, finished: null, viewMode: null,
    setViewMode: (v) => set({ viewMode: v }),

    start: (config) => {
      gen++;
      Engine.stop('play');
      game = new ChessGame(config.startFen);
      set(fresh(config));
      Engine.newGame('play').catch(() => {});
      sfx('start');
      persistActive();
      startFlagTimer();
      maybeAi();
    },

    resume: (saved) => {
      try {
        game = new ChessGame(saved.config.startFen, saved.uci);
      } catch {
        useActiveGame.getState().clear();
        return false;
      }
      gen++;
      set({
        ...fresh(saved.config),
        moves: [...game.history()], fen: game.fen(), clocks: saved.clocks, clockHistory: saved.clockHistory ?? [],
        usedUndo: saved.usedUndo, hintsUsed: saved.hintsUsed, startedAt: saved.startedAt, minMaterial: saved.minMaterial,
        turnStartedAt: timed(saved.config) ? Date.now() : null,
      });
      const st = game.status();
      if (st) { finish(st); return true; }
      startFlagTimer();
      maybeAi();
      return true;
    },

    pause: () => {
      const s = get();
      if (!s.config || s.result) return;
      persistActive();
      gen++;
      Engine.stop('play');
      stopFlagTimer();
      set({ clocks: { w: remaining(s, 'w'), b: remaining(s, 'b') }, turnStartedAt: null, aiThinking: false });
    },

    unpause: () => {
      const s = get();
      if (!s.config || s.result) return;
      if (!s.turnStartedAt) set({ turnStartedAt: timed(s.config) ? Date.now() : null });
      startFlagTimer();
      if (!s.aiThinking) maybeAi();
    },

    userMove: (from, to, promotion) => {
      const s = get();
      const c = s.config;
      if (!c || s.result || s.aiThinking) return false;
      if (c.playerColor !== null && game.turn() !== c.playerColor) return false;
      const spent = s.turnStartedAt ? Date.now() - s.turnStartedAt : undefined;
      const rec = game.move(from, to, promotion, spent);
      if (!rec) return false;
      set({ coach: null });
      afterMove(rec);
      if (!get().result) coachMove(rec);
      return true;
    },

    undo: () => {
      const s = get();
      const c = s.config;
      if (!c || !c.allowUndo || s.result || game.plyCount() === 0) return;
      gen++;
      Engine.stop('play');
      let plies = 1;
      if (c.playerColor !== null) {
        // Return to the player's turn: undo the AI reply as well (if there is one).
        plies = game.turn() === c.playerColor ? 2 : 1;
        if (game.plyCount() < plies) plies = game.plyCount();
        // If the AI moved first and only its move exists, nothing to undo for the player.
        const hist = game.history();
        if (plies === 1 && hist[hist.length - 1].color !== c.playerColor) return;
      }
      const history = [...s.clockHistory];
      for (let i = 0; i < plies; i++) { game.undo(); history.pop(); }
      const ms = c.timeControl.minutes * 60000;
      const clocks = history.length ? history[history.length - 1] : { w: ms, b: ms };
      set({
        moves: [...game.history()], fen: game.fen(), clocks, clockHistory: history, aiThinking: false,
        turnStartedAt: timed(c) ? Date.now() : null, hint: null, coach: null, usedUndo: true, engineError: null,
      });
      sfx('tap');
      persistActive();
      maybeAi();
    },

    resign: () => {
      const s = get();
      if (!s.config || s.result) return;
      const loser = s.config.playerColor ?? game.turn();
      finish({ winner: other(loser), reason: 'resign' });
    },

    offerDraw: async () => {
      const s = get();
      const c = s.config;
      if (!c || s.result) return;
      if (c.playerColor === null) { finish({ winner: null, reason: 'agreement' }); return; }
      if (game.plyCount() < 30) { set({ notice: 'The AI declines: it is too early for a draw.' }); return; }
      set({ drawOfferPending: true, notice: null });
      try {
        const ev = await evaluatePosition(game.fen(), 12);
        if (get().config?.id !== c.id || get().result) return;
        // Score from the side to move; convert to the AI's perspective.
        const aiToMove = game.turn() !== c.playerColor;
        const cp = ev.score.mate !== undefined ? (ev.score.mate > 0 ? 9999 : -9999) : ev.score.cp ?? 0;
        const aiScore = aiToMove ? cp : -cp;
        if (aiScore <= 25) finish({ winner: null, reason: 'agreement' });
        else set({ drawOfferPending: false, notice: 'The AI declines your draw offer.' });
      } catch {
        set({ drawOfferPending: false, notice: 'The engine is unavailable right now.' });
      }
    },

    requestHint: async () => {
      const s = get();
      const c = s.config;
      if (!c || !c.allowHints || s.result || s.hintLoading) return;
      if (c.playerColor !== null && game.turn() !== c.playerColor) return;
      const fen = game.fen();
      set({ hintLoading: true });
      try {
        const r = await Engine.search('analysis', { fen, depth: 14, movetime: 1500 });
        if (game.fen() !== fen || !r.bestmove || !game.isLegal(r.bestmove)) { set({ hintLoading: false }); return; }
        const l = r.lines[0] ?? { cp: 0, pv: [r.bestmove] };
        set({ hint: { move: r.bestmove, text: explainHint(fen, r.bestmove, l, l.pv) }, hintLoading: false, hintsUsed: get().hintsUsed + 1 });
        persistActive();
      } catch (e) {
        set({ hintLoading: false, notice: (e as Error).message });
      }
    },

    retryEngine: () => { set({ engineError: null }); maybeAi(); },

    checkFlag: () => {
      const s = get();
      if (!s.config || s.result || !s.turnStartedAt) return;
      const turn = game.turn();
      if (remaining(s, turn) <= 0) finish(game.timeoutResult(turn));
    },

    dismissCoach: () => set({ coach: null }),

    clear: () => {
      gen++;
      stopFlagTimer();
      set({ config: null, finished: null, result: null });
    },
  };
});
