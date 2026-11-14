import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { Color, MoveRecord, PieceSymbol } from '@/chess/types';
import { PieceSvg } from '@/render2d/PieceSvg';
import { useSettings } from '@/data/settings';
import { fonts, radius, usePalette } from '@/ui/theme';
import { Row, Txt } from '@/ui/kit';
import { remaining, useSession } from './session';

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  if (ms < 10000) return (Math.max(0, ms) / 1000).toFixed(1);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function Clock({ color, active }: { color: Color; active: boolean }) {
  const p = usePalette();
  const clocks = useSession((s) => s.clocks);
  const turnStartedAt = useSession((s) => s.turnStartedAt);
  const fen = useSession((s) => s.fen);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!active || !turnStartedAt) return;
    const id = setInterval(() => tick((t) => t + 1), 200);
    return () => clearInterval(id);
  }, [active, turnStartedAt]);
  const ms = remaining({ clocks, turnStartedAt, fen }, color);
  const low = ms < 20000;
  return (
    <View style={{ minWidth: 76, height: 34, paddingHorizontal: 10, borderRadius: radius.sm + 2, alignItems: 'center', justifyContent: 'center',
      backgroundColor: active ? (low ? p.danger : p.text) : p.surfaceAlt }}>
      <Txt variant="number" color={active ? p.bg : low ? p.danger : p.textMuted} style={{ fontSize: 17 }}>{formatClock(ms)}</Txt>
    </View>
  );
}

export function CapturedRow({ pieces, color, advantage }: { pieces: PieceSymbol[]; color: Color; advantage: number }) {
  const set = useSettings((s) => s.pieceSet);
  const p = usePalette();
  return (
    <Row gap={0} style={{ minHeight: 16 }}>
      {pieces.map((t, i) => (
        <View key={i} style={{ marginLeft: i && pieces[i - 1] === t ? -9 : i ? -3 : 0 }}>
          <PieceSvg type={t} color={color} setId={set} size={17} />
        </View>
      ))}
      {advantage > 0 && <Txt variant="caption" muted style={{ marginLeft: 4, fontFamily: fonts.semibold, fontSize: 12 }}>+{advantage}</Txt>}
      {!pieces.length && advantage <= 0 && <Txt variant="caption" faint style={{ fontSize: 11, color: p.textFaint }}> </Txt>}
    </Row>
  );
}

export function ThinkingDots() {
  const p = usePalette();
  const o = useSharedValue(0.3);
  useEffect(() => { o.value = withRepeat(withSequence(withTiming(1, { duration: 450 }), withTiming(0.3, { duration: 450 })), -1); }, []);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[{ flexDirection: 'row', gap: 4 }, s]}>
      {[0, 1, 2].map((i) => <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: p.accent }} />)}
    </Animated.View>
  );
}

export function MoveList({ moves, current, onSelect }: { moves: { san: string }[]; current?: number; onSelect?: (ply: number) => void }) {
  const p = usePalette();
  const ref = useRef<any>(null);
  useEffect(() => { if (current === undefined || current >= moves.length) setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 50); }, [moves.length]);
  if (!moves.length) return <Txt variant="caption" faint style={{ height: 30, lineHeight: 30, paddingHorizontal: 4 }}>Moves will appear here</Txt>;
  const items: React.ReactNode[] = [];
  moves.forEach((m, i) => {
    if (i % 2 === 0) items.push(<Txt key={'n' + i} variant="caption" faint style={{ fontFamily: fonts.medium, marginLeft: i ? 8 : 0 }}>{i / 2 + 1}.</Txt>);
    const active = current !== undefined ? current === i + 1 : i === moves.length - 1;
    items.push(
      <Txt key={'m' + i} onPress={onSelect ? () => onSelect(i + 1) : undefined} variant="caption"
        style={{ fontFamily: fonts.semibold, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6, overflow: 'hidden',
          backgroundColor: active ? p.accentSoft : 'transparent', color: active ? p.accent : p.text }}>{m.san}</Txt>,
    );
  });
  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 4 }} style={{ maxHeight: 34 }}>
      {items}
    </ScrollView>
  );
}

export function PromotionPicker({ color, onPick, onCancel }: { color: Color; onPick: (p: PieceSymbol) => void; onCancel: () => void }) {
  const p = usePalette();
  const set = useSettings((s) => s.pieceSet);
  return (
    <Animated.View entering={FadeIn.duration(150)} style={{ position: 'absolute', inset: 0, backgroundColor: p.overlay, alignItems: 'center', justifyContent: 'center', zIndex: 20 } as any}>
      <View style={{ backgroundColor: p.bgElevated, borderRadius: radius.xl, padding: 16, gap: 10, alignItems: 'center', borderWidth: 1, borderColor: p.border }}>
        <Txt variant="h2">Promote to</Txt>
        <Row gap={10}>
          {(['q', 'r', 'b', 'n'] as PieceSymbol[]).map((t) => (
            <Txt key={t} onPress={() => onPick(t)} style={{ padding: 6, borderRadius: 12, backgroundColor: p.surfaceAlt, overflow: 'hidden' }}>
              <PieceSvg type={t} color={color} setId={set} size={56} />
            </Txt>
          ))}
        </Row>
        <Txt variant="caption" muted onPress={onCancel} style={{ padding: 6 }}>Cancel</Txt>
      </View>
    </Animated.View>
  );
}

export const CLASS_COLORS = (p: ReturnType<typeof usePalette>): Record<string, string> => ({
  best: p.success, excellent: p.success, good: p.info, forced: p.textMuted, book: p.textMuted,
  inaccuracy: p.warning, mistake: '#E08A4A', blunder: p.danger,
});

export function CoachIcon({ cls }: { cls: string }) {
  const p = usePalette();
  const c = CLASS_COLORS(p)[cls] ?? p.textMuted;
  const icon = cls === 'blunder' ? 'alert-circle' : cls === 'mistake' ? 'warning' : cls === 'inaccuracy' ? 'help-circle' : 'star';
  return <Ionicons name={icon as any} size={18} color={c} />;
}

export type { MoveRecord };
