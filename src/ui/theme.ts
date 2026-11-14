import { useColorScheme, ViewStyle } from 'react-native';
import { useSettings } from '@/data/settings';

export interface Palette {
  mode: 'dark' | 'light';
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  info: string;
  overlay: string;
  shadow: string;
  gold: string;
  goldSoft: string;
  surfaceInset: string;
  neuLight: string;
  neuDark: string;
  glassFill: string;
  glassBorder: string;
  glassSheen: string;
  aurora: [string, string, string];
}

/**
 * "Aurora Glass": deep blue-black base lit by soft colour, clean solid cards for
 * content, and liquid-glass surfaces reserved for floating controls.
 */
export const DARK: Palette = {
  mode: 'dark',
  bg: '#0A0F15',
  bgElevated: '#111820',
  surface: '#121A23',
  surfaceAlt: '#1A2430',
  surfaceInset: '#0E151C',
  border: 'rgba(170,200,225,0.08)',
  borderStrong: 'rgba(170,200,225,0.16)',
  text: '#EEF3F7',
  textMuted: '#93A3B2',
  textFaint: '#5E6D7B',
  accent: '#3CCB9C',
  accentText: '#04211A',
  accentSoft: 'rgba(60,203,156,0.14)',
  success: '#3CCB9C',
  successSoft: 'rgba(60,203,156,0.14)',
  danger: '#F2665A',
  dangerSoft: 'rgba(242,102,90,0.14)',
  warning: '#F5B544',
  info: '#6CA8F0',
  overlay: 'rgba(4,7,10,0.62)',
  shadow: '#000',
  gold: '#F2C45A',
  goldSoft: 'rgba(242,196,90,0.14)',
  neuLight: 'rgba(255,255,255,0.05)',
  neuDark: 'rgba(0,0,0,0.45)',
  glassFill: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.12)',
  glassSheen: 'rgba(255,255,255,0.22)',
  aurora: ['#1E8C70', '#3D4FB8', '#B8862E'],
};

export const LIGHT: Palette = {
  mode: 'light',
  bg: '#EEF2F6',
  bgElevated: '#F6F8FA',
  surface: '#FFFFFF',
  surfaceAlt: '#E6ECF1',
  surfaceInset: '#E9EEF3',
  border: 'rgba(20,40,60,0.08)',
  borderStrong: 'rgba(20,40,60,0.15)',
  text: '#121C26',
  textMuted: '#5A6A78',
  textFaint: '#95A3AF',
  accent: '#0E9F75',
  accentText: '#FFFFFF',
  accentSoft: 'rgba(14,159,117,0.11)',
  success: '#0E9F75',
  successSoft: 'rgba(14,159,117,0.11)',
  danger: '#D9473B',
  dangerSoft: 'rgba(217,71,59,0.10)',
  warning: '#C98A12',
  info: '#2F6FC2',
  overlay: 'rgba(15,25,35,0.35)',
  shadow: '#2A3A48',
  gold: '#C58E13',
  goldSoft: 'rgba(197,142,19,0.12)',
  neuLight: 'rgba(255,255,255,0.9)',
  neuDark: 'rgba(40,60,80,0.14)',
  glassFill: 'rgba(255,255,255,0.6)',
  glassBorder: 'rgba(20,40,60,0.08)',
  glassSheen: 'rgba(255,255,255,0.75)',
  aurora: ['#5ED3AE', '#8FA2F2', '#F2CF7E'],
};

/** Solid content card: clean surface, hairline edge, soft depth. */
export function neu(p: Palette, depth = 6): ViewStyle {
  return {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    boxShadow: `0px ${Math.round(depth * 0.8)}px ${depth * 3}px ${p.neuDark}`,
  } as ViewStyle;
}

/** Recessed tray (tracks, wells). */
export function neuInset(p: Palette, _depth = 4): ViewStyle {
  return { backgroundColor: p.surfaceInset, borderWidth: 1, borderColor: p.border } as ViewStyle;
}

/** Primary action: solid jade with a soft glow. */
export function neuAccent(p: Palette): ViewStyle {
  return { backgroundColor: p.accent, boxShadow: `0px 8px 22px ${p.accentSoft}, 0px 2px 6px ${p.neuDark}` } as ViewStyle;
}

/** Liquid glass: translucent fill, bright rim, soft shadow. Pair with <GlassSheen/> for the highlight. */
export function glass(p: Palette): ViewStyle {
  return {
    backgroundColor: p.glassFill,
    borderWidth: 1,
    borderColor: p.glassBorder,
    boxShadow: `0px 4px 14px ${p.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(40,60,80,0.08)'}`,
  } as ViewStyle;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 };

export const fonts = {
  display: 'Sora_600SemiBold',
  displayBold: 'Sora_700Bold',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export function usePalette(): Palette {
  const pref = useSettings((s) => s.themeMode);
  const sys = useColorScheme();
  const mode = pref === 'system' ? (sys === 'light' ? 'light' : 'dark') : pref;
  return mode === 'light' ? LIGHT : DARK;
}
