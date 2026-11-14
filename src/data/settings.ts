import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage, STORE_KEYS } from './storage';
import type { TimeControl } from '@/progression/types';

export type ThemeMode = 'dark' | 'light' | 'system';
export type RenderMode = '2d' | '3d';
export type Quality = 'low' | 'balanced' | 'high';
export type CameraView = 'player' | 'top' | 'low';
export type AnimLevel = 'off' | 'reduced' | 'full';

export interface Settings {
  themeMode: ThemeMode;
  boardTheme: string;
  pieceSet: string;
  renderMode: RenderMode;
  quality: Quality;
  camera: CameraView;
  sound: boolean;
  music: boolean;
  haptics: boolean;
  animations: AnimLevel;
  showLegal: boolean;
  showLastMove: boolean;
  showCoords: boolean;
  autoFlipLocal: boolean;
  coachTips: boolean;
  confirmMoves: boolean;
  defaultTime: TimeControl;
  defaultLevel: number;
  hydrated: boolean;
  set: (patch: Partial<Omit<Settings, 'set' | 'hydrated'>>) => void;
  reset: () => void;
}

export const DEFAULT_SETTINGS = {
  themeMode: 'dark' as ThemeMode,
  boardTheme: 'walnut',
  pieceSet: 'staunton',
  renderMode: '2d' as RenderMode,
  quality: 'balanced' as Quality,
  camera: 'player' as CameraView,
  sound: true,
  music: false,
  haptics: true,
  animations: 'full' as AnimLevel,
  showLegal: true,
  showLastMove: true,
  showCoords: true,
  autoFlipLocal: true,
  coachTips: true,
  confirmMoves: false,
  defaultTime: { minutes: 10, increment: 0 },
  defaultLevel: 3,
};

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      hydrated: false,
      set: (patch) => set(patch),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: STORE_KEYS.settings,
      storage,
      version: 2,
      migrate: (state: any, version) => (version < 2 ? { ...state, autoFlipLocal: true } : state),
      partialize: ({ set: _s, reset: _r, hydrated: _h, ...rest }) => rest,
      onRehydrateStorage: () => () => useSettings.setState({ hydrated: true }),
    },
  ),
);

export const TIME_CONTROLS: { label: string; tc: TimeControl }[] = [
  { label: 'No clock', tc: { minutes: 0, increment: 0 } },
  { label: '3 + 2', tc: { minutes: 3, increment: 2 } },
  { label: '5 + 0', tc: { minutes: 5, increment: 0 } },
  { label: '10 + 0', tc: { minutes: 10, increment: 0 } },
  { label: '15 + 10', tc: { minutes: 15, increment: 10 } },
  { label: '30 + 0', tc: { minutes: 30, increment: 0 } },
];

export function tcLabel(tc: TimeControl): string {
  if (!tc.minutes) return 'No clock';
  return `${tc.minutes} + ${tc.increment}`;
}
