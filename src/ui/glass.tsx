import React, { ReactNode, useId } from 'react';
import { Platform, StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import { GlassBlur } from './glassBlur';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { glass, usePalette } from './theme';

const sid = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '');

/** Soft coloured light behind the UI so glass surfaces have something to refract. */
export function Aurora({ height, intensity = 1 }: { height?: number; intensity?: number }) {
  const p = usePalette();
  const { width, height: wh } = useWindowDimensions();
  const h = height ?? wh;
  const id = 'au' + sid(useId());
  const o = (p.mode === 'dark' ? 0.2 : 0.3) * intensity;
  const blobs: [number, number, number, string][] = [
    [width * 0.05, h * 0.06, width * 0.85, p.aurora[0]],
    [width * 1.0, h * 0.22, width * 0.75, p.aurora[1]],
    [width * 0.2, h * 0.78, width * 0.7, p.aurora[2]],
  ];
  return (
    <Svg pointerEvents="none" width={width} height={h} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs>
        {blobs.map(([, , , c], i) => (
          <RadialGradient key={i} id={`${id}${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={c} stopOpacity={o * (i === 2 ? 0.55 : 1)} />
            <Stop offset="1" stopColor={c} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {blobs.map(([x, y, r], i) => <Ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.9} fill={`url(#${id}${i})`} />)}
    </Svg>
  );
}

/** Kept for API compatibility: simple glass has no highlight. */
export function GlassSheen(_: { radius?: number }) {
  return null;
}

/** Frosted liquid-glass panel. Real blur on iOS/web; translucent tint on Android. */
export function Glass({ children, style, radius = 16, blur = true, intensity = 40 }: {
  children?: ReactNode; style?: StyleProp<ViewStyle>; radius?: number; blur?: boolean; intensity?: number;
}) {
  const p = usePalette();
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, glass(p), style]}>
      {blur && Platform.OS !== 'android' && <GlassBlur intensity={intensity} dark={p.mode === 'dark'} />}
      <GlassSheen radius={radius} />
      {children}
    </View>
  );
}

/** Simple glass icon tile: frosted rounded square, thin edge, tinted glyph. */
export function GlassIcon({ icon, size = 56, tint }: { icon: keyof typeof Ionicons.glyphMap; size?: number; tint?: string }) {
  const p = usePalette();
  return (
    <View style={[{ width: size, height: size, borderRadius: Math.round(size * 0.24), alignItems: 'center', justifyContent: 'center' }, glass(p), { boxShadow: 'none' } as any]}>
      <Ionicons name={icon} size={size * 0.42} color={tint ?? p.accent} />
    </View>
  );
}
