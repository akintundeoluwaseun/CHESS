import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, NeuIcon, Card, Chip, Divider, ProgressBar, Row, Screen, SectionHeader, Txt } from '@/ui/kit';
import { usePalette } from '@/ui/theme';
import { useProgress } from '@/data/progressStore';
import { LESSONS, LESSON_CATEGORIES } from '@/content/lessons';
import { CHALLENGES } from '@/content/challenges';
import { PUZZLES } from '@/content/puzzles';

export default function Learn() {
  const p = usePalette();
  const prog = useProgress();
  const doneLessons = LESSONS.filter((l) => prog.completedLessons[l.id]).length;
  const doneCh = CHALLENGES.filter((c) => prog.completedChallenges[c.id]).length;
  return (
    <Screen title="Learn">
      <Card style={{ gap: 12 }}>
        <Row>
          <NeuIcon icon="extension-puzzle" size={48} />
          <View style={{ flex: 1 }}>
            <Txt variant="h2">Puzzles</Txt>
            <Txt variant="caption" muted>Puzzle rating {prog.puzzleRating} · {prog.counters.puzzlesSolved} of {PUZZLES.length} solved</Txt>
          </View>
        </Row>
        <Button title="Solve puzzles" icon="flash-outline" onPress={() => router.push('/puzzles')} full />
      </Card>

      <Card onPress={() => router.push('/challenges')}>
        <Row>
          <NeuIcon icon="shield-checkmark" size={48} color={p.gold} />
          <View style={{ flex: 1, gap: 6 }}>
            <Txt variant="h2">Challenge ladder</Txt>
            <ProgressBar value={doneCh / CHALLENGES.length} height={4} />
            <Txt variant="caption" muted>{doneCh} of {CHALLENGES.length} complete</Txt>
          </View>
          <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
        </Row>
      </Card>

      <SectionHeader title={`Lessons · ${doneLessons}/${LESSONS.length}`} />
      {LESSON_CATEGORIES.map((cat) => {
        const items = LESSONS.filter((l) => l.category === cat.id);
        return (
          <Card key={cat.id} padded={false}>
            <View style={{ padding: 14, paddingBottom: 8 }}><Txt variant="title" style={{ fontSize: 20 }}>{cat.title}</Txt></View>
            {items.map((l, i) => {
              const done = !!prog.completedLessons[l.id];
              return (
                <View key={l.id}>
                  {i > 0 && <Divider style={{ marginLeft: 56 }} />}
                  <Row style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? p.successSoft : p.surfaceAlt }}>
                      {done ? <Ionicons name="checkmark" size={16} color={p.success} /> : <Txt variant="caption" muted>{i + 1}</Txt>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyStrong" onPress={() => router.push(`/lesson/${l.id}`)}>{l.title}</Txt>
                      <Txt variant="caption" muted onPress={() => router.push(`/lesson/${l.id}`)}>{l.summary}</Txt>
                    </View>
                    {!done && <Chip label="+40 XP" tone="gold" />}
                    <Ionicons name="chevron-forward" size={16} color={p.textMuted} onPress={() => router.push(`/lesson/${l.id}`)} />
                  </Row>
                </View>
              );
            })}
          </Card>
        );
      })}
    </Screen>
  );
}
