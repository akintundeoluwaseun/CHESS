import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NeuIcon, Card, Row, Screen, Txt } from '@/ui/kit';
import type { IconName } from '@/ui/kit';
import { usePalette } from '@/ui/theme';
import { MODES, quickGameConfig } from '@/modes/modes';
import { useLaunchGame } from '@/features/game/launch';
import { useProgress } from '@/data/progressStore';

export default function Play() {
  const p = usePalette();
  const rating = useProgress((s) => s.rating);
  const { launch, resume, dialog, saved } = useLaunchGame();
  return (
    <Screen title="Play">
      {saved && (
        <Card onPress={resume} style={{ borderColor: p.accent }}>
          <Row>
            <Ionicons name="play-circle" size={28} color={p.accent} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">Continue your game</Txt>
              <Txt variant="caption" muted>{saved.config.title} · move {Math.floor(saved.uci.length / 2) + 1}</Txt>
            </View>
            <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
          </Row>
        </Card>
      )}
      {MODES.map((m) => (
        <Card key={m.id} onPress={() => (m.id === 'quick' ? launch(quickGameConfig(rating)) : router.push(m.route as any))}>
          <Row>
            <NeuIcon icon={m.icon as IconName} size={50} color={({ quick: p.accent, ai: p.info, ranked: p.gold, puzzles: p.accent, training: p.info, challenges: p.gold, local: '#B07CF0' } as Record<string, string>)[m.id]} />
            <View style={{ flex: 1 }}>
              <Txt variant="h2">{m.title}</Txt>
              <Txt variant="caption" muted>{m.subtitle}</Txt>
            </View>
            <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
          </Row>
        </Card>
      ))}
      {dialog}
    </Screen>
  );
}
