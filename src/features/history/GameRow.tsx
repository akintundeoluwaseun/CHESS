import React from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Chip, Divider, Row, Txt } from '@/ui/kit';
import { usePalette } from '@/ui/theme';
import { getLevel } from '@/engine/levels';
import type { GameRecord } from '@/progression/types';

export function GameRow({ g, first }: { g: GameRecord; first?: boolean }) {
  const p = usePalette();
  const tone = g.outcome === 'win' ? p.success : g.outcome === 'loss' ? p.danger : p.textMuted;
  const label = g.outcome === 'win' ? 'W' : g.outcome === 'loss' ? 'L' : g.outcome === 'draw' ? 'D' : '·';
  const opp = g.mode === 'local' ? 'Two players' : g.aiLevel ? `${getLevel(g.aiLevel).name} AI` : 'AI';
  return (
    <Pressable onPress={() => router.push(`/analysis/${g.id}`)}>
      {!first && <Divider style={{ marginLeft: 60 }} />}
      <Row style={{ padding: 14 }}>
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Txt variant="number" color={tone}>{label}</Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong" style={{ fontSize: 14 }}>{opp}</Txt>
          <Txt variant="caption" muted>{g.mode === 'ranked' ? 'Ranked' : g.mode === 'challenge' ? 'Challenge' : g.mode === 'quick' ? 'Quick game' : g.mode === 'local' ? 'Local' : 'Casual'} · {Math.ceil(g.uci.length / 2)} moves · {new Date(g.endedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Txt>
        </View>
        {g.ratingAfter !== undefined && g.ratingBefore !== undefined && (
          <Chip label={`${g.ratingAfter - g.ratingBefore >= 0 ? '+' : ''}${g.ratingAfter - g.ratingBefore}`} tone={g.ratingAfter >= g.ratingBefore ? 'success' : 'danger'} />
        )}
        <Ionicons name="chevron-forward" size={16} color={p.textMuted} />
      </Row>
    </Pressable>
  );
}
