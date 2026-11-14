import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage, STORE_KEYS } from './storage';
import { applyEvent, ensureMissions, initialProgress } from '@/progression/progress';
import type { ProgressEvent, ProgressState, Reward } from '@/progression/types';

interface ProgressStore extends ProgressState {
  hydrated: boolean;
  /** Rewards waiting to be celebrated by the UI (level-ups, achievements). */
  celebrations: Reward[];
  dispatch: (e: ProgressEvent) => Reward[];
  refreshMissions: () => void;
  setProfile: (p: { username?: string; avatar?: number }) => void;
  popCelebration: () => void;
  resetProgress: () => void;
}

const pickState = (s: ProgressStore): ProgressState => {
  const { hydrated: _h, celebrations: _c, dispatch: _d, refreshMissions: _r, setProfile: _p, popCelebration: _pc, resetProgress: _rp, ...rest } = s;
  return rest;
};

export const useProgress = create<ProgressStore>()(
  persist(
    (set, get) => ({
      ...initialProgress(),
      hydrated: false,
      celebrations: [],
      dispatch: (e) => {
        const { state, rewards } = applyEvent(pickState(get()), e);
        const celebrate = rewards.filter((r) => r.kind === 'level' || r.kind === 'achievement');
        set({ ...state, celebrations: [...get().celebrations, ...celebrate] });
        return rewards;
      },
      refreshMissions: () => {
        const cur = pickState(get());
        const next = ensureMissions(cur);
        if (next !== cur) set({ missions: next.missions });
      },
      setProfile: (p) => set({
        ...(p.username !== undefined ? { username: p.username.trim().slice(0, 18) || 'Player' } : {}),
        ...(p.avatar !== undefined ? { avatar: p.avatar } : {}),
      }),
      popCelebration: () => set({ celebrations: get().celebrations.slice(1) }),
      resetProgress: () => set({ ...initialProgress(), celebrations: [] }),
    }),
    {
      name: STORE_KEYS.progress,
      storage,
      version: 1,
      partialize: (s) => pickState(s as ProgressStore),
      merge: (persisted, current) => {
        // Merge nested counters so new counters added in updates get defaults.
        const p = (persisted ?? {}) as Partial<ProgressState>;
        const base = initialProgress();
        return { ...current, ...p, counters: { ...base.counters, ...(p.counters ?? {}) } } as ProgressStore;
      },
      onRehydrateStorage: () => () => {
        useProgress.setState({ hydrated: true });
        useProgress.getState().refreshMissions();
      },
    },
  ),
);
