import React, { ReactNode, useEffect, useId } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleProp, StyleSheet, Switch, Text, TextProps, TextStyle,
  useWindowDimensions, View, ViewStyle,
} from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { fonts, glass, neu, neuAccent, neuInset, radius, space, usePalette } from './theme';
import { Aurora, GlassIcon } from './glass';
import { haptic, sfx } from '@/audio/sound';

export type IconName = keyof typeof Ionicons.glyphMap;

/* --------------------------------- Text --------------------------------- */

type Variant = 'hero' | 'display' | 'title' | 'h2' | 'body' | 'bodyStrong' | 'caption' | 'label' | 'number' | 'numberLg';

const VARIANTS: Record<Variant, TextStyle> = {
  hero: { fontFamily: fonts.displayBold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  display: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  title: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  h2: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: 'uppercase' },
  number: { fontFamily: fonts.semibold, fontSize: 15, fontVariant: ['tabular-nums'] },
  numberLg: { fontFamily: fonts.semibold, fontSize: 22, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
};

export function Txt({ variant = 'body', color, muted, faint, style, children, ...rest }: TextProps & {
  variant?: Variant; color?: string; muted?: boolean; faint?: boolean; children?: ReactNode;
}) {
  const p = usePalette();
  const c = color ?? (faint ? p.textFaint : muted ? p.textMuted : p.text);
  return <Text {...rest} style={[VARIANTS[variant], { color: c }, style]}>{children}</Text>;
}

/* -------------------------------- Pressable ----------------------------- */

export function PressScale({ onPress, disabled, style, children, haptics = true, accessibilityLabel }: {
  onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>; children: ReactNode; haptics?: boolean; accessibilityLabel?: string;
}) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  // Layout props belong on the outer Pressable so flex/alignSelf work inside rows.
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const outer: ViewStyle = {};
  const inner: { -readonly [K in keyof ViewStyle]: ViewStyle[K] } = { ...flat };
  for (const k of ['flex', 'alignSelf', 'width', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical'] as const) {
    if (flat[k] !== undefined) { (outer as any)[k] = flat[k]; delete (inner as any)[k]; }
  }
  if (outer.flex !== undefined || outer.width !== undefined) inner.width = '100%';
  if (outer.flex !== undefined) inner.flexGrow = 1;
  return (
    <Pressable
      style={outer}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPressIn={() => { s.value = withTiming(0.97, { duration: 90 }); }}
      onPressOut={() => { s.value = withSpring(1, { damping: 14, stiffness: 260 }); }}
      onPress={() => { if (haptics) { haptic('light'); sfx('tap'); } onPress?.(); }}
    >
      <Animated.View style={[a, inner, disabled && { opacity: 0.45 }]}>{children}</Animated.View>
    </Pressable>
  );
}

/* --------------------------------- Button ------------------------------- */

export function Button({ title, onPress, variant = 'primary', icon, size = 'md', disabled, loading, style, full }: {
  title: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: IconName;
  size?: 'sm' | 'md' | 'lg'; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>; full?: boolean;
}) {
  const p = usePalette();
  const fg = variant === 'primary' ? p.accentText : variant === 'danger' ? p.danger : variant === 'ghost' ? p.textMuted : p.text;
  const h = size === 'sm' ? 38 : size === 'lg' ? 56 : 48;
  const skin: ViewStyle = variant === 'primary' ? neuAccent(p) : variant === 'ghost' ? { backgroundColor: 'transparent' } : neu(p, size === 'sm' ? 3 : 4);
  return (
    <PressScale onPress={onPress} disabled={disabled || loading} style={[{
      height: h, borderRadius: size === 'sm' ? 12 : 16, paddingHorizontal: size === 'sm' ? 14 : 20,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: full ? 'stretch' : 'auto',
    }, skin, style]}>
      {loading ? <ActivityIndicator color={fg} size="small" /> : icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={variant === 'secondary' ? p.accent : fg} /> : null}
      <Txt variant={size === 'lg' ? 'h2' : 'bodyStrong'} color={fg} style={size === 'sm' ? { fontSize: 13.5 } : undefined}>{title}</Txt>
    </PressScale>
  );
}

/** Neumorphic round icon button: raised, or pressed in when active. */
export function IconButton({ icon, onPress, label, size = 40, active, disabled, tint }: {
  icon: IconName; onPress?: () => void; label: string; size?: number; active?: boolean; disabled?: boolean; tint?: string;
}) {
  const p = usePalette();
  return (
    <PressScale onPress={onPress} disabled={disabled} accessibilityLabel={label} style={[{
      width: size, height: size, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }, glass(p), active && { backgroundColor: p.accentSoft, borderColor: p.accent }]}>
      <Ionicons name={icon} size={size * 0.46} color={tint ?? (active ? p.accent : p.text)} />
    </PressScale>
  );
}

/** Liquid-glass icon tile (used for mode shortcuts). */
export function NeuIcon({ icon, size = 52, color }: { icon: IconName; size?: number; color?: string; active?: boolean }) {
  return <GlassIcon icon={icon} size={size} tint={color} />;
}

/** Labeled vertical tool button used in the game toolbar. */
export function ToolButton({ icon, label, onPress, disabled, active }: { icon: IconName; label: string; onPress?: () => void; disabled?: boolean; active?: boolean }) {
  const p = usePalette();
  return (
    <PressScale onPress={onPress} disabled={disabled} accessibilityLabel={label} style={{ alignItems: 'center', minWidth: 56, paddingVertical: 4, gap: 6 }}>
      <View style={[{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, glass(p),
        active && { backgroundColor: p.accentSoft, borderColor: p.accent }]}>
        <Ionicons name={icon} size={20} color={active ? p.accent : p.text} />
      </View>
      <Txt variant="caption" muted style={{ fontSize: 11 }}>{label}</Txt>
    </PressScale>
  );
}

/* ---------------------------------- Card -------------------------------- */

export function Card({ children, style, onPress, padded = true, inset }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean; inset?: boolean }) {
  const p = usePalette();
  const base: ViewStyle = { borderRadius: 22, padding: padded ? space.lg : 0, ...(inset ? neuInset(p, 4) : neu(p, 6)) };
  if (onPress) return <PressScale onPress={onPress} style={[base, style]}>{children}</PressScale>;
  return <View style={[base, style]}>{children}</View>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: p.border }, style]} />;
}

export function Chip({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'gold'; icon?: IconName }) {
  const p = usePalette();
  const bg = tone === 'gold' ? p.goldSoft : tone === 'accent' ? p.accentSoft : tone === 'success' ? p.successSoft : tone === 'danger' ? p.dangerSoft : p.surfaceAlt;
  const fg = tone === 'gold' ? p.gold : tone === 'accent' ? p.accent : tone === 'success' ? p.success : tone === 'danger' ? p.danger : p.textMuted;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: bg, alignSelf: 'flex-start' }}>
      {icon && <Ionicons name={icon} size={12} color={fg} />}
      <Txt variant="caption" color={fg} style={{ fontSize: 11, fontFamily: fonts.semibold }}>{label}</Txt>
    </View>
  );
}

/* ------------------------------ Progress bar ---------------------------- */

export function ProgressBar({ value, height = 6, color, track, style }: { value: number; height?: number; color?: string; track?: string; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  const w = useSharedValue(0);
  useEffect(() => { w.value = withTiming(Math.max(0, Math.min(1, value)), { duration: 700, easing: Easing.out(Easing.cubic) }); }, [value]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={[{ height: height + 4, borderRadius: (height + 4) / 2, padding: 2, overflow: 'hidden' }, neuInset(p, 2), track ? { backgroundColor: track } : null, style]}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color ?? p.accent }, a]} />
    </View>
  );
}

/* --------------------------------- Layout ------------------------------- */

/** Soft warm light falling from the top of the screen. Gives depth without loud gradients. */
export function AmbientGlow({ height = 440, strength = 1 }: { height?: number; strength?: number }) {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const id = 'amb' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg pointerEvents="none" width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="0%" rx="80%" ry="100%" fx="50%" fy="0%">
          <Stop offset="0" stopColor={p.accent} stopOpacity={(p.mode === 'dark' ? 0.17 : 0.13) * strength} />
          <Stop offset="0.55" stopColor={p.accent} stopOpacity={(p.mode === 'dark' ? 0.05 : 0.04) * strength} />
          <Stop offset="1" stopColor={p.accent} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${id})`} />
    </Svg>
  );
}

export function Screen({ children, scroll = true, title, back, right, padded = true, contentStyle, overlay }: {
  children: ReactNode; scroll?: boolean; title?: string; back?: boolean; right?: ReactNode; padded?: boolean; contentStyle?: StyleProp<ViewStyle>; overlay?: ReactNode;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const header = (title || back || right) ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: Math.max(insets.top, 12) + 6, paddingBottom: 8, gap: 12, minHeight: 52 }}>
      {back && <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
      <Txt variant="title" style={{ flex: 1 }} numberOfLines={1}>{title}</Txt>
      {right}
    </View>
  ) : <View style={{ height: insets.top }} />;
  const body = scroll ? (
    <ScrollView contentContainerStyle={[{ padding: padded ? space.lg : 0, paddingBottom: insets.bottom + 110, gap: space.lg }, contentStyle]} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : <View style={[{ flex: 1, padding: padded ? space.lg : 0 }, contentStyle]}>{children}</View>;
  return <View style={{ flex: 1, backgroundColor: p.bg }}><Aurora intensity={0.55} />{header}{body}{overlay}</View>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -4 }}>
      <Txt variant="label" muted>{title}</Txt>
      {action && <Pressable onPress={onAction} hitSlop={10}><Txt variant="caption" color={p.accent} style={{ fontFamily: fonts.semibold }}>{action}</Txt></Pressable>}
    </View>
  );
}

export function Row({ children, style, gap = 12 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function EmptyState({ icon, title, text, action, onAction }: { icon: IconName; title: string; text: string; action?: string; onAction?: () => void }) {
  const p = usePalette();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 22, gap: 8 }}>
      <View style={[{ width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' }, neuInset(p, 3)]}>
        <Ionicons name={icon} size={22} color={p.textMuted} />
      </View>
      <Txt variant="h2">{title}</Txt>
      <Txt variant="caption" muted style={{ textAlign: 'center', maxWidth: 260 }}>{text}</Txt>
      {action && <Button title={action} size="sm" variant="secondary" onPress={onAction} style={{ marginTop: 6 }} />}
    </View>
  );
}

/* --------------------------------- Inputs ------------------------------- */

export function Segmented<T extends string | number>({ options, value, onChange, style }: {
  options: { value: T; label: string; locked?: boolean }[]; value: T; onChange: (v: T) => void; style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  return (
    <View style={[{ flexDirection: 'row', borderRadius: 16, padding: 4, gap: 4 }, neuInset(p, 3), style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} disabled={o.locked} onPress={() => { haptic('light'); onChange(o.value); }}
            style={[{ flex: 1, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4,
              backgroundColor: 'transparent', opacity: o.locked ? 0.4 : 1 }, on ? { backgroundColor: p.surfaceAlt, borderWidth: 1, borderColor: p.borderStrong } : null]}>
            {o.locked && <Ionicons name="lock-closed" size={11} color={p.textMuted} />}
            <Txt variant="caption" color={on ? p.accent : p.textMuted} style={{ fontFamily: on ? fonts.semibold : fonts.medium }} numberOfLines={1}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({ label, detail, value, onChange, icon }: { label: string; detail?: string; value: boolean; onChange: (v: boolean) => void; icon?: IconName }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 }}>
      {icon && <Ionicons name={icon} size={18} color={p.textMuted} />}
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong">{label}</Txt>
        {detail && <Txt variant="caption" muted>{detail}</Txt>}
      </View>
      <Switch value={value} onValueChange={(v) => { haptic('light'); onChange(v); }}
        trackColor={{ false: p.surfaceAlt, true: p.accent }} thumbColor={p.mode === 'dark' ? '#F2EEE6' : '#FFFFFF'} ios_backgroundColor={p.surfaceAlt} />
    </View>
  );
}

/* --------------------------------- Sheet -------------------------------- */

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: p.overlay }} onPress={onClose} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: p.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
        paddingHorizontal: space.lg, paddingTop: 10, paddingBottom: insets.bottom + space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border, maxHeight: '88%' }}>
        <View style={{ alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: p.borderStrong, marginBottom: 12 }} />
        {title && <Txt variant="title" style={{ marginBottom: 12 }}>{title}</Txt>}
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

export function ConfirmDialog({ visible, title, text, confirm, onConfirm, onCancel, danger }: {
  visible: boolean; title: string; text: string; confirm: string; onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  const p = usePalette();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: p.overlay, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <View style={[{ borderRadius: 28, padding: space.xl, width: '100%', maxWidth: 360, gap: 10, backgroundColor: p.bgElevated, borderWidth: 1, borderColor: p.glassBorder }]}>
          <Txt variant="title">{title}</Txt>
          <Txt muted>{text}</Txt>
          <Row style={{ marginTop: 10 }}>
            <Button title="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
            <Button title={confirm} variant={danger ? 'danger' : 'primary'} onPress={onConfirm} style={{ flex: 1 }} />
          </Row>
        </View>
      </View>
    </Modal>
  );
}

/* ---------------------------------- Stat -------------------------------- */

export function Stat({ label, value, sub, align = 'left' }: { label: string; value: string | number; sub?: string; align?: 'left' | 'center' }) {
  return (
    <View style={{ flex: 1, alignItems: align === 'center' ? 'center' : 'flex-start', gap: 2 }}>
      <Txt variant="numberLg">{value}</Txt>
      <Txt variant="caption" muted>{label}</Txt>
      {sub && <Txt variant="caption" faint style={{ fontSize: 11 }}>{sub}</Txt>}
    </View>
  );
}
