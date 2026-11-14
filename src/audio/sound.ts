import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useSettings } from '@/data/settings';

const SOURCES = {
  move: require('../../assets/sounds/move.wav'),
  capture: require('../../assets/sounds/capture.wav'),
  castle: require('../../assets/sounds/castle.wav'),
  check: require('../../assets/sounds/check.wav'),
  promote: require('../../assets/sounds/promote.wav'),
  start: require('../../assets/sounds/start.wav'),
  win: require('../../assets/sounds/win.wav'),
  lose: require('../../assets/sounds/lose.wav'),
  draw: require('../../assets/sounds/draw.wav'),
  tap: require('../../assets/sounds/tap.wav'),
  correct: require('../../assets/sounds/correct.wav'),
  wrong: require('../../assets/sounds/wrong.wav'),
  levelup: require('../../assets/sounds/levelup.wav'),
  achievement: require('../../assets/sounds/achievement.wav'),
};
export type Sfx = keyof typeof SOURCES;

const players: Partial<Record<Sfx, AudioPlayer>> = {};
let music: AudioPlayer | null = null;
let initialised = false;

export async function initAudio() {
  if (initialised) return;
  initialised = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' } as any);
  } catch {
    /* not fatal */
  }
}

function player(name: Sfx): AudioPlayer | null {
  try {
    if (!players[name]) {
      const p = createAudioPlayer(SOURCES[name]);
      p.volume = name === 'tap' ? 0.5 : 0.9;
      players[name] = p;
    }
    return players[name]!;
  } catch {
    return null;
  }
}

/** Pre-create players for the sounds used during play so the first move isn't delayed. */
export function preloadSounds() {
  (['move', 'capture', 'check', 'castle', 'tap'] as Sfx[]).forEach(player);
}

export function sfx(name: Sfx) {
  if (!useSettings.getState().sound) return;
  const p = player(name);
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch {
    /* ignore */
  }
}

export function haptic(kind: 'light' | 'medium' | 'success' | 'error' = 'light') {
  if (!useSettings.getState().haptics || Platform.OS === 'web') return;
  try {
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch {
    /* ignore */
  }
}

export function moveSound(rec: { flags: string; captured?: string; promotion?: string }, check: boolean) {
  if (check) sfx('check');
  else if (rec.promotion) sfx('promote');
  else if (rec.flags.includes('k') || rec.flags.includes('q')) sfx('castle');
  else if (rec.captured) sfx('capture');
  else sfx('move');
  haptic(rec.captured || check ? 'medium' : 'light');
}

export function setMusic(on: boolean) {
  try {
    if (on) {
      if (!music) {
        music = createAudioPlayer(require('../../assets/sounds/music.m4a'));
        music.loop = true;
        music.volume = 0.3;
      }
      music.play();
    } else music?.pause();
  } catch {
    /* ignore */
  }
}
