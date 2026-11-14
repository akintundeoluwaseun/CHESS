import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage, STORE_KEYS } from './storage';
import type { GameRecord } from '@/progression/types';
import type { GameAnalysis } from '@/engine/analysis';

const MAX_GAMES = 300;
const MAX_ANALYSES = 60;

interface GamesStore {
  games: GameRecord[]; // newest first
  analyses: Record<string, GameAnalysis>;
  hydrated: boolean;
  add: (g: GameRecord) => void;
  saveAnalysis: (id: string, a: GameAnalysis) => void;
  clear: () => void;
}

export const useGames = create<GamesStore>()(
  persist(
    (set, get) => ({
      games: [],
      analyses: {},
      hydrated: false,
      add: (g) => set({ games: [g, ...get().games.filter((x) => x.id !== g.id)].slice(0, MAX_GAMES) }),
      saveAnalysis: (id, a) => {
        const entries = Object.entries({ ...get().analyses, [id]: a });
        // keep the most recent analyses only
        const keep = new Set(get().games.slice(0, MAX_ANALYSES).map((g) => g.id).concat(id));
        set({ analyses: Object.fromEntries(entries.filter(([k]) => keep.has(k))) });
      },
      clear: () => set({ games: [], analyses: {} }),
    }),
    {
      name: STORE_KEYS.games,
      storage,
      version: 1,
      partialize: ({ games, analyses }) => ({ games, analyses }),
      onRehydrateStorage: () => () => useGames.setState({ hydrated: true }),
    },
  ),
);
