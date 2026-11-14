import React, { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Row, Screen, Segmented, Stat, Txt } from '@/ui/kit';
import { LineChart } from '@/ui/widgets';
import { usePalette } from '@/ui/theme';
import { useProgress } from '@/data/progressStore';
import { levelForRating } from '@/engine/levels';
import { rankedGameConfig } from '@/modes/modes';
import { useLaunchGame } from '@/features/game/launch';
import { useGames } from '@/data/gamesStore';

const TCS = [
  { label: '5 + 0', tc: { minutes: 5, increment: 0 } },
  { label: '10 + 0', tc: { minutes: 10, increment: 0 } },
  { label: '15 + 10', tc: { minutes: 15, increment: 10 } },
];

export default function Ranked() {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const prog = useProgress();
  const games = useGames((s) => s.games.filter((g) => g.mode === 'ranked'));
  const [tc, setTc] = useState(1);
  const { launch, dialog } = useLaunchGame();
  const opp = levelForRating(prog.rating);
  const w = games.filter((g) => g.outcome === 'win').length;
  const d = games.filter((g) => g.outcome === 'draw').length;
  const l = games.filter((g) => g.outcome === 'loss').length;
  return (
    <Screen title="Ranked" back>
      <Card style={{ alignItems: 'center', gap: 4 }}>
        <Txt variant="label" muted>Your rating</Txt>
        <Txt variant="hero">{prog.rating}</Txt>
        <Txt variant="caption" muted>{prog.ratedGames < 10 ? `Provisional · ${prog.ratedGames}/10 games` : `Best ${prog.bestRating}`}</Txt>
        {prog.ratingHistory.length >= 2 && <View style={{ marginTop: 8 }}><LineChart data={[800, ...prog.ratingHistory.map((h) => h.r)]} width={width - 64} height={110} /></View>}
      </Card>
      <Card>
        <Row>
          <Stat label="Wins" value={w} />
          <Stat label="Draws" value={d} />
          <Stat label="Losses" value={l} />
        </Row>
      </Card>
      <Card style={{ gap: 10 }}>
        <Row>
          <Ionicons name="hardware-chip-outline" size={22} color={p.accent} />
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">Next opponent: {opp.name}</Txt>
            <Txt variant="caption" muted>Matched to your rating (≈ {opp.elo}). Win to climb, lose and you drop. No undo or hints in ranked games.</Txt>
          </View>
        </Row>
        <Segmented options={TCS.map((t, i) => ({ value: i, label: t.label }))} value={tc} onChange={setTc} />
      </Card>
      <Button title="Find ranked game" icon="podium" size="lg" full onPress={() => launch(rankedGameConfig(prog.rating, TCS[tc].tc))} />
      {dialog}
    </Screen>
  );
}
