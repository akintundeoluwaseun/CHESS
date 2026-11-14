import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage, STORE_KEYS } from './storage';
import type { GameConfig } from '@/modes/modes';

export interface SavedGame {
  config: GameConfig;
  uci: string[];
  clocks: { w: number; b: number };
  clockHistory: { w: number; b: number }[];
  usedUndo: boolean;
  hintsUsed: number;
  startedAt: number;
  minMaterial: number;
  savedAt: number;
}

interface ActiveStore {
  saved: SavedGame | null;
  hydrated: boolean;
  save: (g: SavedGame) => void;
  clear: () => void;
}

export const useActiveGame = create<ActiveStore>()(
  persist(
    (set) => ({
      saved: null,
      hydrated: false,
      save: (g) => set({ saved: g }),
      clear: () => set({ saved: null }),
    }),
    {
      name: STORE_KEYS.active,
      storage,
      version: 1,
      partialize: ({ saved }) => ({ saved }),
      onRehydrateStorage: () => () => useActiveGame.setState({ hydrated: true }),
    },
  ),
);
