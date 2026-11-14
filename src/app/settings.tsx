import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Button, Card, ConfirmDialog, Divider, Row, Screen, SectionHeader, Segmented, ToggleRow, Txt } from '@/ui/kit';
import { radius, usePalette } from '@/ui/theme';
import { useSettings, TIME_CONTROLS } from '@/data/settings';
import { BOARD_THEMES } from '@/board/boardThemes';
import { PIECE_SETS } from '@/board/pieceDesign';
import { UNLOCKS, isUnlocked } from '@/progression/catalog';
import { levelFromXp } from '@/progression/levels';
import { useProgress } from '@/data/progressStore';
import { useGames } from '@/data/gamesStore';
import { useActiveGame } from '@/data/activeGame';
import { AI_LEVELS } from '@/engine/levels';
import { PieceSvg } from '@/render2d/PieceSvg';
import { setMusic } from '@/audio/sound';

export default function Settings() {
  const p = usePalette();
  const s = useSettings();
  const xp = useProgress((x) => x.xp);
  const level = levelFromXp(xp).level;
  const [confirmReset, setConfirmReset] = useState(false);
  const unlockLevel = (id: string) => UNLOCKS.find((u) => u.id === id)?.level ?? 1;

  return (
    <Screen title="Settings" back>
      <SectionHeader title="Appearance" />
      <Card style={{ gap: 12 }}>
        <Txt variant="bodyStrong">Interface theme</Txt>
        <Segmented options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]} value={s.themeMode} onChange={(v) => s.set({ themeMode: v })} />
        <Txt variant="bodyStrong" style={{ marginTop: 4 }}>Board</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {BOARD_THEMES.map((t) => {
            const open = isUnlocked(t.id, level);
            const on = s.boardTheme === t.id;
            return (
              <Pressable key={t.id} disabled={!open} onPress={() => s.set({ boardTheme: t.id })} style={{ width: '30%', gap: 6, opacity: open ? 1 : 0.5 }}>
                <View style={{ aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', borderWidth: 2, borderColor: on ? p.accent : 'transparent', backgroundColor: t.frame, padding: 5 }}>
                  <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', borderRadius: 4, overflow: 'hidden' }}>
                    {Array.from({ length: 16 }).map((_, i) => <View key={i} style={{ width: '25%', height: '25%', backgroundColor: (Math.floor(i / 4) + i) % 2 ? t.dark : t.light }} />)}
                  </View>
                  {!open && <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' } as any}><Ionicons name="lock-closed" size={18} color="#fff" /></View>}
                </View>
                <Txt variant="caption" numberOfLines={1} style={{ textAlign: 'center' }}>{open ? t.name : `Level ${unlockLevel(t.id)}`}</Txt>
              </Pressable>
            );
          })}
        </View>
        <Txt variant="bodyStrong" style={{ marginTop: 4 }}>Pieces</Txt>
        <Row gap={10}>
          {PIECE_SETS.map((set) => {
            const open = isUnlocked(set.id, level);
            const on = s.pieceSet === set.id;
            return (
              <Pressable key={set.id} disabled={!open} onPress={() => s.set({ pieceSet: set.id })} style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: radius.md,
                backgroundColor: on ? p.accentSoft : p.surfaceAlt, borderWidth: 1, borderColor: on ? p.accent : 'transparent', opacity: open ? 1 : 0.5 }}>
                <Row gap={0}><PieceSvg type="n" color="w" setId={set.id} size={36} /><PieceSvg type="q" color="b" setId={set.id} size={36} /></Row>
                <Txt variant="caption">{open ? set.name : `Level ${unlockLevel(set.id)}`}</Txt>
              </Pressable>
            );
          })}
        </Row>
      </Card>

      <SectionHeader title="Board & 3D" />
      <Card style={{ gap: 12 }}>
        <Txt variant="bodyStrong">Board view</Txt>
        <Segmented options={[{ value: '2d', label: 'Classic 2D' }, { value: '3d', label: '3D' }]} value={s.renderMode} onChange={(v) => s.set({ renderMode: v })} />
        <Txt variant="bodyStrong">3D quality</Txt>
        <Segmented options={[{ value: 'low', label: 'Battery saver' }, { value: 'balanced', label: 'Balanced' }, { value: 'high', label: 'High' }]} value={s.quality} onChange={(v) => s.set({ quality: v })} />
        <Txt variant="caption" muted>Battery saver turns off shadows and reflections. The 3D board only redraws while something moves.</Txt>
        <Txt variant="bodyStrong">3D camera</Txt>
        <Segmented options={[{ value: 'player', label: 'Player' }, { value: 'top', label: 'Top-down' }, { value: 'low', label: 'Low angle' }]} value={s.camera} onChange={(v) => s.set({ camera: v })} />
        <Txt variant="bodyStrong">Animations</Txt>
        <Segmented options={[{ value: 'off', label: 'Off' }, { value: 'reduced', label: 'Reduced' }, { value: 'full', label: 'Full' }]} value={s.animations} onChange={(v) => s.set({ animations: v })} />
        <Divider />
        <ToggleRow label="Show legal moves" value={s.showLegal} onChange={(v) => s.set({ showLegal: v })} />
        <ToggleRow label="Highlight last move" value={s.showLastMove} onChange={(v) => s.set({ showLastMove: v })} />
        <ToggleRow label="Board coordinates" value={s.showCoords} onChange={(v) => s.set({ showCoords: v })} />
        <ToggleRow label="Confirm moves" detail="Tap to confirm before a move is played" value={s.confirmMoves} onChange={(v) => s.set({ confirmMoves: v })} />
        <ToggleRow label="Rotate board in two-player games" value={s.autoFlipLocal} onChange={(v) => s.set({ autoFlipLocal: v })} />
      </Card>

      <SectionHeader title="Games" />
      <Card style={{ gap: 12 }}>
        <Txt variant="bodyStrong">Default AI difficulty</Txt>
        <Segmented options={AI_LEVELS.slice(0, 5).map((l) => ({ value: l.id, label: String(l.id) }))} value={s.defaultLevel <= 5 ? s.defaultLevel : -1} onChange={(v) => s.set({ defaultLevel: v })} />
        <Segmented options={AI_LEVELS.slice(5).map((l) => ({ value: l.id, label: String(l.id) }))} value={s.defaultLevel > 5 ? s.defaultLevel : -1} onChange={(v) => s.set({ defaultLevel: v })} style={{ marginTop: -6 }} />
        <Txt variant="caption" muted>{AI_LEVELS[s.defaultLevel - 1].name} — {AI_LEVELS[s.defaultLevel - 1].blurb}</Txt>
        <Txt variant="bodyStrong">Default game timer</Txt>
        <Segmented options={TIME_CONTROLS.slice(0, 3).map((t, i) => ({ value: i, label: t.label }))}
          value={TIME_CONTROLS.findIndex((t) => t.tc.minutes === s.defaultTime.minutes && t.tc.increment === s.defaultTime.increment)} onChange={(i) => s.set({ defaultTime: TIME_CONTROLS[i].tc })} />
        <Segmented options={TIME_CONTROLS.slice(3).map((t, i) => ({ value: i + 3, label: t.label }))}
          value={TIME_CONTROLS.findIndex((t) => t.tc.minutes === s.defaultTime.minutes && t.tc.increment === s.defaultTime.increment)} onChange={(i) => s.set({ defaultTime: TIME_CONTROLS[i].tc })} style={{ marginTop: -6 }} />
        <ToggleRow label="Coach tips" detail="Explains mistakes and great moves during casual games" value={s.coachTips} onChange={(v) => s.set({ coachTips: v })} />
      </Card>

      <SectionHeader title="Sound" />
      <Card>
        <ToggleRow label="Sound effects" value={s.sound} onChange={(v) => s.set({ sound: v })} icon="volume-medium-outline" />
        <ToggleRow label="Background music" value={s.music} onChange={(v) => { s.set({ music: v }); setMusic(v); }} icon="musical-notes-outline" />
        <ToggleRow label="Vibration" value={s.haptics} onChange={(v) => s.set({ haptics: v })} icon="phone-portrait-outline" />
      </Card>

      <SectionHeader title="Data" />
      <Card style={{ gap: 10 }}>
        <Txt variant="caption" muted>Your progress is stored on this device and works fully offline.</Txt>
        <Button title="Reset all progress" variant="danger" icon="trash-outline" onPress={() => setConfirmReset(true)} />
      </Card>
      <Txt variant="caption" faint style={{ textAlign: 'center' }}>
        Onyx Chess {Constants.expoConfig?.version ?? '1.0.0'} · Engine: Stockfish 19 (GPLv3) · Rules: chess.js
      </Txt>

      <ConfirmDialog visible={confirmReset} title="Reset everything?" danger confirm="Reset"
        text="This permanently deletes your games, rating, XP, achievements and settings."
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          useProgress.getState().resetProgress();
          useGames.getState().clear();
          useActiveGame.getState().clear();
          useSettings.getState().reset();
          router.replace('/');
        }} />
    </Screen>
  );
}
