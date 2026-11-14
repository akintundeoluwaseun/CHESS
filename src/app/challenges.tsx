import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Row, Screen, Txt } from '@/ui/kit';
import { usePalette } from '@/ui/theme';
import { CHALLENGES, challengeUnlocked } from '@/content/challenges';
import { useProgress } from '@/data/progressStore';
import { useLaunchGame } from '@/features/game/launch';
import { uid } from '@/data/storage';
import { getLevel } from '@/engine/levels';
import type { GameConfig } from '@/modes/modes';

export default function Challenges() {
  const p = usePalette();
  const completed = useProgress((s) => s.completedChallenges);
  const { launch, dialog } = useLaunchGame();
  const start = (i: number) => {
    const c = CHALLENGES[i];
    const cfg: GameConfig = {
      id: uid('g'), mode: 'challenge', title: 'Challenge', startFen: c.fen, playerColor: c.playerColor, aiLevel: c.level,
      timeControl: c.timeControl, allowUndo: false, allowHints: false, rated: false, challengeId: c.id, goal: c.goal,
    };
    launch(cfg);
  };
  return (
    <Screen title="Challenges" back>
      <Txt muted>Complete each challenge to unlock the next. No undo and no hints — just you and the engine.</Txt>
      {CHALLENGES.map((c, i) => {
        const done = !!completed[c.id];
        const open = challengeUnlocked(i, completed);
        return (
          <Card key={c.id} onPress={open ? () => start(i) : undefined} style={{ opacity: open ? 1 : 0.55 }}>
            <Row>
              <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? p.successSoft : open ? p.accentSoft : p.surfaceAlt }}>
                <Ionicons name={done ? 'checkmark' : open ? 'flag' : 'lock-closed'} size={18} color={done ? p.success : open ? p.accent : p.textFaint} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Row gap={8}>
                  <Txt variant="h2">{c.title}</Txt>
                  <Txt variant="caption" muted>{'★'.repeat(c.tier)}</Txt>
                </Row>
                <Txt variant="caption" muted>{c.description}</Txt>
                <Row gap={6} style={{ marginTop: 4 }}>
                  <Chip label={`vs ${getLevel(c.level).name}`} />
                  <Chip label={c.playerColor === 'w' ? 'White' : 'Black'} />
                  {!done && <Chip label={`+${30 + 15 * c.tier} XP`} tone="gold" />}
                </Row>
              </View>
            </Row>
          </Card>
        );
      })}
      {dialog}
    </Screen>
  );
}
