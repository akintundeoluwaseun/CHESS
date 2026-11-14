import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Row, Screen, Segmented, Txt } from '@/ui/kit';
import { fonts, neu, neuInset, radius, usePalette } from '@/ui/theme';
import { AI_LEVELS } from '@/engine/levels';
import { useSettings, TIME_CONTROLS } from '@/data/settings';
import { aiGameConfig, localGameConfig } from '@/modes/modes';
import { useLaunchGame } from '@/features/game/launch';
import type { Color } from '@/chess/types';
import { PieceSvg } from '@/render2d/PieceSvg';

export default function Setup() {
  const p = usePalette();
  const params = useLocalSearchParams<{ mode?: string }>();
  const local = params.mode === 'local';
  const settings = useSettings();
  const [level, setLevel] = useState(settings.defaultLevel);
  const [color, setColor] = useState<Color | 'random'>('w');
  const [tcIndex, setTcIndex] = useState(Math.max(0, TIME_CONTROLS.findIndex((t) => t.tc.minutes === settings.defaultTime.minutes && t.tc.increment === settings.defaultTime.increment)));
  const { launch, dialog } = useLaunchGame();
  const tc = TIME_CONTROLS[tcIndex].tc;

  const start = () => {
    if (local) launch(localGameConfig(tc));
    else {
      settings.set({ defaultLevel: level, defaultTime: tc });
      launch(aiGameConfig(level, color, tc));
    }
  };

  return (
    <Screen title={local ? 'Two Players' : 'Play vs AI'} back>
      {!local && (
        <>
          <Txt variant="label" muted>Opponent</Txt>
          <View style={{ gap: 8 }}>
            {AI_LEVELS.map((l) => {
              const on = l.id === level;
              return (
                <Pressable key={l.id} onPress={() => setLevel(l.id)} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, marginVertical: 2 },
                  on ? { ...neuInset(p, 3), borderWidth: 1, borderColor: p.accent } : neu(p, 4)]}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: on ? p.accent : p.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                    <Txt variant="number" color={on ? p.accentText : p.textMuted}>{l.id}</Txt>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Row gap={8}><Txt variant="bodyStrong">{l.name}</Txt><Txt variant="caption" muted>≈ {l.elo}</Txt></Row>
                    {on && <Txt variant="caption" muted>{l.blurb}</Txt>}
                  </View>
                  {on && <Ionicons name="checkmark-circle" size={20} color={p.accent} />}
                </Pressable>
              );
            })}
          </View>
          <Txt variant="label" muted>Your colour</Txt>
          <Row gap={10}>
            {(['w', 'random', 'b'] as const).map((c) => {
              const on = color === c;
              return (
                <Pressable key={c} onPress={() => setColor(c)} style={[{ flex: 1, height: 82, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 4 },
                  on ? { ...neuInset(p, 3), borderWidth: 1, borderColor: p.accent } : neu(p, 4)]}>
                  {c === 'random' ? <Ionicons name="shuffle" size={30} color={p.text} /> : <PieceSvg type="k" color={c} setId={settings.pieceSet} size={40} />}
                  <Txt variant="caption" style={{ fontFamily: fonts.semibold }}>{c === 'w' ? 'White' : c === 'b' ? 'Black' : 'Random'}</Txt>
                </Pressable>
              );
            })}
          </Row>
        </>
      )}
      {local && (
        <Card>
          <Row>
            <Ionicons name="people-outline" size={26} color={p.accent} />
            <Txt muted style={{ flex: 1 }}>Two people share this phone and take turns. You can rotate the board each turn from the game menu.</Txt>
          </Row>
        </Card>
      )}
      <Txt variant="label" muted>Time control</Txt>
      <Segmented options={TIME_CONTROLS.slice(0, 3).map((t, i) => ({ value: i, label: t.label }))} value={tcIndex < 3 ? tcIndex : -1} onChange={setTcIndex} />
      <Segmented options={TIME_CONTROLS.slice(3).map((t, i) => ({ value: i + 3, label: t.label }))} value={tcIndex >= 3 ? tcIndex : -1} onChange={setTcIndex} style={{ marginTop: -8 }} />
      <Button title="Start game" icon="play" size="lg" onPress={start} full />
      {dialog}
    </Screen>
  );
}
