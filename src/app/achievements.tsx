import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Row, Screen, Txt } from '@/ui/kit';
import type { IconName } from '@/ui/kit';
import { usePalette } from '@/ui/theme';
import { useProgress } from '@/data/progressStore';
import { ACHIEVEMENTS } from '@/progression/catalog';

export default function Achievements() {
  const p = usePalette();
  const got = useProgress((s) => s.achievements);
  const sorted = [...ACHIEVEMENTS].sort((a, b) => (got[b.id] ? 1 : 0) - (got[a.id] ? 1 : 0));
  return (
    <Screen title="Achievements" back>
      <Txt muted>{Object.keys(got).length} of {ACHIEVEMENTS.length} unlocked · each badge is worth 50 XP.</Txt>
      {sorted.map((a) => {
        const on = !!got[a.id];
        return (
          <Card key={a.id} style={{ opacity: on ? 1 : 0.6 }}>
            <Row>
              <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? p.accentSoft : p.surfaceAlt }}>
                <Ionicons name={(on ? a.icon : 'lock-closed-outline') as IconName} size={22} color={on ? p.accent : p.textFaint} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="h2">{a.title}</Txt>
                <Txt variant="caption" muted>{a.description}</Txt>
              </View>
              {on && <Txt variant="caption" muted>{new Date(got[a.id]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Txt>}
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}
