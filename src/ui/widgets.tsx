import React, { useEffect, useId } from 'react';
import { Modal, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useSettings } from '@/data/settings';
import { getBoardTheme } from '@/board/boardThemes';
import Animated, { FadeIn, ZoomIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { PieceSvg } from '@/render2d/PieceSvg';
import type { PieceSymbol } from '@/chess/types';
import { fonts, radius, usePalette } from './theme';
import { Button, Txt } from './kit';
import { useProgress } from '@/data/progressStore';
import { ACHIEVEMENTS } from '@/progression/catalog';
import { Glass } from './glass';
import { rankTitle } from '@/progression/levels';
import { sfx, haptic } from '@/audio/sound';

/* -------------------------------- Avatar -------------------------------- */

export const AVATARS: { piece: PieceSymbol; bg: string; color: 'w' | 'b' }[] = [
  { piece: 'n', bg: '#3A2A1C', color: 'w' },
  { piece: 'k', bg: '#1E2B33', color: 'w' },
  { piece: 'q', bg: '#3B2130', color: 'w' },
  { piece: 'b', bg: '#22311F', color: 'w' },
  { piece: 'r', bg: '#2F2F36', color: 'w' },
  { piece: 'p', bg: '#4A3A1E', color: 'w' },
  { piece: 'n', bg: '#D8C7A3', color: 'b' },
  { piece: 'q', bg: '#C9CDD3', color: 'b' },
];

export function Avatar({ index, size = 48, ring }: { index: number; size?: number; ring?: boolean }) {
  const p = usePalette();
  const a = AVATARS[index % AVATARS.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: a.bg, alignItems: 'center', justifyContent: 'center',
      borderWidth: ring ? 2 : 0, borderColor: p.accent, overflow: 'hidden' }}>
      <PieceSvg type={a.piece} color={a.color} setId="staunton" size={size * 0.82} />
    </View>
  );
}

/* ------------------------------ Level badge ----------------------------- */

export function LevelBadge({ level, size = 30 }: { level: number; size?: number }) {
  const p = usePalette();
  return (
    <View style={{ minWidth: size, height: size, borderRadius: size / 2, paddingHorizontal: 6, backgroundColor: p.goldSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: p.gold }}>
      <Txt variant="number" color={p.gold} style={{ fontSize: size * 0.42 }}>{level}</Txt>
    </View>
  );
}

/* ------------------------------- Line chart ----------------------------- */

export function LineChart({ data, width, height = 120, color }: { data: number[]; width: number; height?: number; color?: string }) {
  const p = usePalette();
  const c = color ?? p.accent;
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const pad = Math.max(10, (max - min) * 0.15);
  const lo = min - pad, hi = max + pad;
  const x = (i: number) => 8 + (i / (data.length - 1)) * (width - 16);
  const y = (v: number) => 8 + (1 - (v - lo) / (hi - lo)) * (height - 26);
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${d} L${x(data.length - 1)},${height - 18} L${x(0)},${height - 18} Z`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="lc" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c} stopOpacity={0.28} />
          <Stop offset="1" stopColor={c} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {[0.25, 0.5, 0.75].map((f) => <Line key={f} x1={8} x2={width - 8} y1={8 + f * (height - 26)} y2={8 + f * (height - 26)} stroke={p.border} strokeWidth={1} />)}
      <Path d={area} fill="url(#lc)" />
      <Path d={d} stroke={c} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r={4} fill={c} />
      <SvgText x={8} y={height - 4} fontSize={10} fill={p.textFaint} fontFamily={fonts.medium}>{Math.round(min)}</SvgText>
      <SvgText x={width - 8} y={height - 4} fontSize={10} fill={p.textFaint} fontFamily={fonts.medium} textAnchor="end">{Math.round(max)}</SvgText>
    </Svg>
  );
}

/** Small win/draw/loss ring. */
export function ResultRing({ wins, draws, losses, size = 86 }: { wins: number; draws: number; losses: number; size?: number }) {
  const p = usePalette();
  const total = wins + draws + losses;
  const r = size / 2 - 6;
  const C = 2 * Math.PI * r;
  const seg = (n: number) => (total ? (n / total) * C : 0);
  const parts = [{ n: wins, c: p.success }, { n: draws, c: p.textFaint }, { n: losses, c: p.danger }];
  let off = 0;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={p.surfaceAlt} strokeWidth={8} fill="none" />
      {total > 0 && parts.map((s, i) => {
        const len = seg(s.n);
        const el = <Circle key={i} cx={size / 2} cy={size / 2} r={r} stroke={s.c} strokeWidth={8} fill="none"
          strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} rotation={-90} origin={`${size / 2}, ${size / 2}`} />;
        off += len;
        return el;
      })}
      <SvgText x={size / 2} y={size / 2 + 6} fontSize={18} fill={p.text} fontFamily={fonts.semibold} textAnchor="middle">
        {total ? `${Math.round((wins / total) * 100)}%` : '–'}
      </SvgText>
    </Svg>
  );
}

/* ----------------------------- Celebrations ----------------------------- */

/** Global overlay that celebrates level-ups and achievements one at a time. */
export function Celebrations() {
  const p = usePalette();
  const next = useProgress((s) => s.celebrations[0]);
  const pop = useProgress((s) => s.popCelebration);
  const glow = useSharedValue(0.6);
  useEffect(() => {
    if (!next) return;
    sfx(next.kind === 'level' ? 'levelup' : 'achievement');
    haptic('success');
    glow.value = withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0.6, { duration: 900 })), -1);
  }, [next]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.9 + glow.value * 0.15 }] }));
  if (!next) return null;
  const isLevel = next.kind === 'level';
  const ach = next.kind === 'achievement' ? ACHIEVEMENTS.find((a) => a.id === next.id) : undefined;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={pop} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: p.overlay, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Animated.View entering={ZoomIn.springify().damping(14)} style={{ width: '100%', maxWidth: 340 }}>
         <Glass radius={20} intensity={60} style={{ padding: 28, alignItems: 'center', gap: 10, backgroundColor: p.mode === 'dark' ? 'rgba(18,26,35,0.82)' : 'rgba(255,255,255,0.8)' }}>
          <View style={{ width: 110, height: 110, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={[{ position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: p.goldSoft }, glowStyle]} />
            {isLevel ? (
              <Txt variant="hero" color={p.gold} style={{ fontSize: 48, lineHeight: 56 }}>{next.level}</Txt>
            ) : (
              <Ionicons name={(ach?.icon ?? 'trophy-outline') as any} size={50} color={p.gold} />
            )}
          </View>
          <Animated.View entering={FadeIn.delay(150)} style={{ alignItems: 'center', gap: 6 }}>
            <Txt variant="label" color={p.gold}>{isLevel ? 'Level up' : 'Achievement unlocked'}</Txt>
            <Txt variant="display" style={{ textAlign: 'center' }}>{isLevel ? rankTitle(next.level) : ach?.title}</Txt>
            <Txt muted style={{ textAlign: 'center' }}>{isLevel ? `You reached level ${next.level}. Keep learning and playing to climb further.` : ach?.description}</Txt>
            {!isLevel && <Txt variant="caption" color={p.gold} style={{ fontFamily: fonts.semibold }}>+50 XP</Txt>}
          </Animated.View>
          <Button title="Continue" onPress={pop} full style={{ marginTop: 8 }} />
         </Glass>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ------------------------------- Hero art -------------------------------- */

/** Decorative corner of a board with a king and knight, lit from behind. Used on the home hero. */
export function HeroArt({ size = 210 }: { size?: number }) {
  const p = usePalette();
  const set = useSettings((x) => x.pieceSet);
  const theme = getBoardTheme(useSettings((x) => x.boardTheme));
  const id = 'hg' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const cell = size / 5;
  const float = useSharedValue(0);
  useEffect(() => { float.value = withRepeat(withSequence(withTiming(1, { duration: 2600 }), withTiming(0, { duration: 2600 })), -1); }, []);
  const kingStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * float.value }] }));
  return (
    <View pointerEvents="none" style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', left: size * 0.1, top: size * 0.2, width: size, height: size, transform: [{ rotate: '-14deg' }], opacity: 0.32, flexDirection: 'row', flexWrap: 'wrap', borderRadius: 10, overflow: 'hidden' }}>
        {Array.from({ length: 25 }).map((_, i) => (
          <View key={i} style={{ width: cell, height: cell, backgroundColor: (Math.floor(i / 5) + i) % 2 ? theme.dark : theme.light }} />
        ))}
      </View>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id={id} cx="58%" cy="45%" r="50%">
            <Stop offset="0" stopColor={p.accent} stopOpacity={0.45} />
            <Stop offset="1" stopColor={p.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#${id})`} />
      </Svg>
      <Animated.View style={[{ position: 'absolute', right: size * 0.02, top: size * 0.02 }, kingStyle]}>
        <PieceSvg type="k" color="w" setId={set} size={size * 0.68} />
      </Animated.View>
      <View style={{ position: 'absolute', left: size * 0.08, bottom: size * 0.02 }}>
        <PieceSvg type="n" color="b" setId={set} size={size * 0.52} />
      </View>
    </View>
  );
}

/* ------------------------------ Progress ring ----------------------------- */

export function ProgressRing({ value, size = 64, stroke = 6, color, children }: { value: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode }) {
  const p = usePalette();
  const r = (size - stroke) / 2 - 2;
  const C = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={p.surfaceInset} strokeWidth={stroke} fill="none" />
        {v > 0.005 && <Circle cx={size / 2} cy={size / 2} r={r} stroke={color ?? p.accent} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${C * v} ${C}`} rotation={-90} origin={`${size / 2}, ${size / 2}`} />}
      </Svg>
      {children}
    </View>
  );
}
