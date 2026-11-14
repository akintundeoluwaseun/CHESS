import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/**
 * Local persistence. All stores go through this one adapter, so swapping in
 * SQLite or adding cloud sync later means changing a single file (each store
 * already has a version number and migrate hook).
 */
export const storage = createJSONStorage(() => AsyncStorage);

export const STORE_KEYS = {
  settings: 'onyx.settings',
  progress: 'onyx.progress',
  games: 'onyx.games',
  active: 'onyx.activeGame',
} as const;

export async function wipeAllData() {
  await AsyncStorage.multiRemove(Object.values(STORE_KEYS));
}

export function uid(prefix = ''): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
