import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Chip, EmptyState, IconButton, NeuIcon, PressScale, ProgressBar, Row, SectionHeader, Txt } from '@/ui/kit';
import type { IconName } from '@/ui/kit';
import { Avatar, ProgressRing } from '@/ui/widgets';
import { Aurora, Glass, GlassIcon } from '@/ui/glass';
import { fonts, neu, neuInset, space, usePalette } from '@/ui/theme';
import { useProgress } from '@/data/progressStore';
import { levelFromXp, rankTitle } from '@/progression/levels';
import { ACHIEVEMENTS } from '@/progression/catalog';
import { missionDef } from '@/progression/progress';
import { MODES, quickGameConfig } from '@/modes/modes';
import { levelForRating, getLevel } from '@/engine/levels';
import { useLaunchGame } from '@/features/game/launch';
import { dailyPuzzle } from '@/content/puzzles';
import { Board2D } from '@/render2d/Board2D';
import { trackPieces } from '@/chess/pieceIds';
import { ChessGame } from '@/chess/ChessGame';
import { PieceSvg } from '@/render2d/PieceSvg';
import { useSettings } from '@/data/settings';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** Big, simple Play button. */
function PlayDisc({ onPress }: { onPress: () => void }) {
  const p = usePalette();
  return (
    <PressScale onPress={onPress} accessibilityLabel="Play" style={{ width: 112, height: 112, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
      backgroundColor: p.accent, boxShadow: '0px 8px 22px rgba(60,203,156,0.28)' } as any}>
      <Ionicons name="play" size={40} color={p.accentText} style={{ marginLeft: 5 }} />
      <Txt variant="caption" color={p.accentText} style={{ fontFamily: fonts.bold, marginTop: 2 }}>PLAY</Txt>
    </PressScale>
  );
}

export default function Home() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const prog = useProgress();
  const pieceSet = useSettings((s) => s.pieceSet);
  const { launch, resume, dialog, saved } = useLaunchGame();
  const lvl = levelFromXp(prog.xp);
  const quickLevel = levelForRating(prog.rating);
  const daily = useMemo(() => dailyPuzzle(), [prog.missions.day]);
  const dailySolved = !!prog.solvedPuzzles[daily.id];
  const c = prog.counters;
  const recentAch = Object.entries(prog.achievements).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([id]) => ACHIEVEMENTS.find((a) => a.id === id)).filter(Boolean);

  const continuePreview = useMemo(() => {
    if (!saved) return null;
    try {
      const g = new ChessGame(saved.config.startFen, saved.uci);
      return { pieces: trackPieces(g.startFen, g.history()).pieces, last: g.lastMove() };
    } catch { return null; }
  }, [saved]);

  const modes = MODES.filter((m) => ['puzzles', 'training', 'challenges'].includes(m.id));

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Aurora intensity={0.9} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: insets.bottom + 120, gap: 22 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Row>
          <Pressable onPress={() => router.push('/profile')}>
            <Avatar index={prog.avatar} size={48} ring />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Txt variant="caption" muted>{greeting()},</Txt>
            <Txt variant="title" numberOfLines={1}>{prog.username}</Txt>
          </View>
          <Glass radius={12} blur={false} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 40 }}>
            <Ionicons name="flame" size={16} color={prog.streak.current > 0 ? p.warning : p.textFaint} />
            <Txt variant="number" style={{ fontSize: 14 }}>{prog.streak.current}</Txt>
          </Glass>
          <IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} size={40} />
        </Row>

        {/* Play panel */}
        <Animated.View entering={FadeInDown.duration(450)}>
          <Card style={{ padding: 20, gap: 18 }}>
            <Row gap={18}>
              <PlayDisc onPress={() => launch(quickGameConfig(prog.rating))} />
              <View style={{ flex: 1, gap: 6 }}>
                <Txt variant="label" color={p.accent}>Quick game</Txt>
                <Txt variant="display">{quickLevel.name}</Txt>
                <Txt variant="caption" muted>AI opponent ≈{quickLevel.elo}{'\n'}10 minutes · matched to you</Txt>
              </View>
            </Row>
            <Row gap={12}>
              <ModeButton icon="options-outline" label="Choose AI" onPress={() => router.push('/setup')} />
              <ModeButton icon="people-outline" label="2 Players" onPress={() => router.push('/setup?mode=local')} />
              <ModeButton icon="podium-outline" label="Ranked" onPress={() => router.push('/ranked')} />
            </Row>
          </Card>
        </Animated.View>

        {/* Continue */}
        {saved && continuePreview && (
          <Card onPress={resume} style={{ padding: 14 }}>
            <Row>
              <View style={[{ padding: 4, borderRadius: 12 }, neuInset(p, 3)]}>
                <Board2D pieces={continuePreview.pieces} orientation={saved.config.playerColor ?? 'w'} size={64} interactive={false}
                  lastMove={continuePreview.last ? { from: continuePreview.last.from, to: continuePreview.last.to } : null} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Txt variant="label" color={p.accent}>Continue</Txt>
                <Txt variant="h2">{saved.config.title}{saved.config.aiLevel ? ` · ${getLevel(saved.config.aiLevel).name}` : ''}</Txt>
                <Txt variant="caption" muted>Move {Math.floor(saved.uci.length / 2) + 1}</Txt>
              </View>
              <View style={[{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, neu(p, 3)]}>
                <Ionicons name="play" size={16} color={p.accent} />
              </View>
            </Row>
          </Card>
        )}

        {/* Stats tiles */}
        <Row gap={14}>
          <Card style={{ flex: 1, padding: 14, alignItems: 'center', gap: 8 }} onPress={() => router.push('/profile')}>
            <ProgressRing value={lvl.progress} size={70} color={p.gold}>
              <Txt variant="numberLg" color={p.gold}>{lvl.level}</Txt>
            </ProgressRing>
            <View style={{ alignItems: 'center' }}>
              <Txt variant="bodyStrong" style={{ fontSize: 14 }}>{rankTitle(lvl.level)}</Txt>
              <Txt variant="caption" muted style={{ fontSize: 11 }}>{lvl.into}/{lvl.needed} XP</Txt>
            </View>
          </Card>
          <View style={{ flex: 1, gap: 14 }}>
            <StatTile icon="trending-up" label="Rating" value={`${prog.rating}${prog.ratedGames < 10 ? '?' : ''}`} />
            <StatTile icon="extension-puzzle" label="Puzzles solved" value={String(c.puzzlesSolved)} />
          </View>
        </Row>

        {/* Modes */}
        <SectionHeader title="Explore" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18 }}>
          {modes.map((m) => (
            <PressScale key={m.id} onPress={() => router.push(m.route as any)} style={{ width: '30%', alignItems: 'center', gap: 8 }}>
              <GlassIcon icon={m.icon as IconName} size={64} tint={m.id === 'puzzles' ? p.accent : m.id === 'training' ? p.info : p.gold} />
              <Txt variant="caption" style={{ fontFamily: fonts.semibold, textAlign: 'center' }} numberOfLines={1}>{m.title}</Txt>
            </PressScale>
          ))}
        </View>

        {/* Daily */}
        <SectionHeader title="Today" />
        <Card style={{ padding: 16, gap: 14 }}>
          <Pressable onPress={() => router.push({ pathname: '/puzzles', params: { daily: '1' } })}>
            <Row>
              <View style={[{ width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, neuInset(p, 3)]}>
                {dailySolved ? <Ionicons name="checkmark" size={24} color={p.success} /> : <PieceSvg type="q" color="w" setId={pieceSet} size={40} />}
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">Daily puzzle</Txt>
                <Txt variant="caption" muted>{dailySolved ? 'Solved — see you tomorrow' : `Rated ${daily.rating} · ${daily.moves.length > 1 ? `${Math.ceil(daily.moves.length / 2)} moves` : 'one move'}`}</Txt>
              </View>
              <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
            </Row>
          </Pressable>
          <View style={[{ borderRadius: 18, padding: 14, gap: 14 }, neuInset(p, 3)]}>
            {prog.missions.daily.map((m) => <MissionRow key={m.id} id={m.id} progress={m.progress} done={m.done} />)}
            <Txt variant="label" muted>This week</Txt>
            {prog.missions.weekly.map((m) => <MissionRow key={m.id} id={m.id} progress={m.progress} done={m.done} />)}
          </View>
        </Card>

        {/* Achievements */}
        <SectionHeader title="Achievements" action="View all" onAction={() => router.push('/achievements')} />
        <Card style={{ padding: 16 }}>
          {recentAch.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, padding: 4 }}>
              {recentAch.map((a) => (
                <View key={a!.id} style={{ width: 76, alignItems: 'center', gap: 8 }}>
                  <GlassIcon icon={a!.icon as IconName} size={54} tint={p.gold} />
                  <Txt variant="caption" style={{ textAlign: 'center', fontSize: 11 }} numberOfLines={2}>{a!.title}</Txt>
                </View>
              ))}
            </ScrollView>
          ) : (
            <EmptyState icon="trophy-outline" title="No achievements yet" text="Finish a game or solve a puzzle to earn your first badge." />
          )}
        </Card>
      </ScrollView>
      {dialog}
    </View>
  );
}

function ModeButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const p = usePalette();
  return (
    <PressScale onPress={onPress} style={[{ flex: 1, height: 48, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, neu(p, 4)]}>
      <Ionicons name={icon} size={16} color={p.accent} />
      <Txt variant="caption" style={{ fontFamily: fonts.semibold }}>{label}</Txt>
    </PressScale>
  );
}

function StatTile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const p = usePalette();
  return (
    <Card style={{ flex: 1, padding: 12 }}>
      <Row gap={10}>
        <View style={[{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, neuInset(p, 2)]}>
          <Ionicons name={icon} size={17} color={p.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="numberLg" style={{ fontSize: 19 }}>{value}</Txt>
          <Txt variant="caption" muted style={{ fontSize: 11 }} numberOfLines={1}>{label}</Txt>
        </View>
      </Row>
    </Card>
  );
}

function MissionRow({ id, progress, done }: { id: string; progress: number; done: boolean }) {
  const p = usePalette();
  const def = missionDef(id);
  if (!def) return null;
  return (
    <View style={{ gap: 6 }}>
      <Row>
        <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={done ? p.success : p.textFaint} />
        <Txt variant="bodyStrong" style={{ flex: 1, fontSize: 14 }} color={done ? p.textMuted : p.text}>{def.title}</Txt>
        <Chip label={`+${def.xp} XP`} tone={done ? 'success' : 'gold'} />
      </Row>
      {!done && def.target > 1 && (
        <Row gap={8} style={{ paddingLeft: 30 }}>
          <ProgressBar value={progress / def.target} height={4} style={{ flex: 1 }} />
          <Txt variant="caption" muted style={{ fontFamily: fonts.medium, fontSize: 11 }}>{progress}/{def.target}</Txt>
        </Row>
      )}
    </View>
  );
}
