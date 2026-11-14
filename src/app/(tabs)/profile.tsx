import React, { useState } from 'react';
import { Pressable, TextInput, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Chip, Divider, EmptyState, IconButton, ProgressBar, Row, Screen, SectionHeader, Segmented, Sheet, Stat, Txt } from '@/ui/kit';
import type { IconName } from '@/ui/kit';
import { Avatar, AVATARS, LevelBadge, LineChart, ResultRing } from '@/ui/widgets';
import { fonts, radius, usePalette } from '@/ui/theme';
import { useProgress } from '@/data/progressStore';
import { useGames } from '@/data/gamesStore';
import { levelFromXp, rankTitle } from '@/progression/levels';
import { ACHIEVEMENTS } from '@/progression/catalog';
import { getLevel } from '@/engine/levels';
import { GameRow } from '@/features/history/GameRow';

export default function Profile() {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const prog = useProgress();
  const games = useGames((s) => s.games);
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(prog.username);
  const [avatar, setAvatar] = useState(prog.avatar);
  const [chart, setChart] = useState<'rating' | 'puzzle'>('rating');
  const lvl = levelFromXp(prog.xp);
  const c = prog.counters;
  const unlocked = Object.keys(prog.achievements).length;
  const series = chart === 'rating' ? [800, ...prog.ratingHistory.map((h) => h.r)] : [1000, ...prog.puzzleHistory.map((h) => h.r)];

  return (
    <Screen title="Profile" right={<IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} size={38} />}>
      <Card style={{ alignItems: 'center', gap: 8 }}>
        <Pressable onPress={() => { setName(prog.username); setAvatar(prog.avatar); setEdit(true); }}>
          <Avatar index={prog.avatar} size={84} ring />
          <View style={{ position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="pencil" size={13} color={p.accentText} />
          </View>
        </Pressable>
        <Txt variant="display">{prog.username}</Txt>
        <Row gap={8}>
          <LevelBadge level={lvl.level} size={26} />
          <Txt muted>{rankTitle(lvl.level)}</Txt>
          <Txt faint>·</Txt>
          <Txt muted>Joined {new Date(prog.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</Txt>
        </Row>
        <View style={{ alignSelf: 'stretch', gap: 6, marginTop: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="caption" muted>Level {lvl.level}</Txt>
            <Txt variant="caption" muted>{prog.xp} XP total · {lvl.needed - lvl.into} to next</Txt>
          </Row>
          <ProgressBar value={lvl.progress} color={p.gold} />
        </View>
      </Card>

      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <Stat label="Rating" value={prog.rating} sub={prog.ratedGames < 10 ? 'provisional' : undefined} />
          <Stat label="Best rating" value={prog.ratedGames ? prog.bestRating : '–'} />
          <Stat label="Puzzle rating" value={prog.puzzleRating} />
        </Row>
        <Divider style={{ marginVertical: 14 }} />
        <Row>
          <ResultRing wins={c.wins} draws={c.draws} losses={c.losses} />
          <View style={{ flex: 1, gap: 8, marginLeft: 8 }}>
            <Row><Txt style={{ flex: 1 }} muted>Games played</Txt><Txt variant="number">{c.gamesPlayed}</Txt></Row>
            <Row><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.success }} /><Txt style={{ flex: 1 }} muted>Wins</Txt><Txt variant="number">{c.wins}</Txt></Row>
            <Row><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.textFaint }} /><Txt style={{ flex: 1 }} muted>Draws</Txt><Txt variant="number">{c.draws}</Txt></Row>
            <Row><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.danger }} /><Txt style={{ flex: 1 }} muted>Losses</Txt><Txt variant="number">{c.losses}</Txt></Row>
          </View>
        </Row>
        <Txt variant="caption" faint style={{ marginTop: 8 }}>Win rate counts games against the AI. Two-player games: {c.localGames}.</Txt>
      </Card>

      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <Stat label="Day streak" value={prog.streak.current} sub={`best ${prog.streak.best}`} />
          <Stat label="Win streak" value={c.winStreak} sub={`best ${c.bestWinStreak}`} />
          <Stat label="Puzzles solved" value={c.puzzlesSolved} />
          <Stat label="Lessons" value={c.lessonsCompleted} />
        </Row>
      </Card>

      <SectionHeader title="Progress over time" />
      <Card style={{ gap: 12 }}>
        <Segmented options={[{ value: 'rating', label: 'Ranked rating' }, { value: 'puzzle', label: 'Puzzle rating' }]} value={chart} onChange={setChart} />
        {series.length >= 3 ? <LineChart data={series} width={width - 64} height={130} />
          : <EmptyState icon="trending-up-outline" title="Not enough data yet" text={chart === 'rating' ? 'Play a couple of ranked games to see your rating chart.' : 'Solve a few puzzles to chart your puzzle rating.'} />}
      </Card>

      <SectionHeader title={`Achievements · ${unlocked}/${ACHIEVEMENTS.length}`} action="View all" onAction={() => router.push('/achievements')} />
      <Card>
        <Row gap={10} style={{ flexWrap: 'wrap' }}>
          {ACHIEVEMENTS.slice(0, 12).map((a) => {
            const got = !!prog.achievements[a.id];
            return (
              <View key={a.id} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: got ? p.accentSoft : p.surfaceAlt, opacity: got ? 1 : 0.5 }}>
                <Ionicons name={(got ? a.icon : 'lock-closed') as IconName} size={got ? 20 : 15} color={got ? p.accent : p.textFaint} />
              </View>
            );
          })}
        </Row>
      </Card>

      <SectionHeader title="Recent games" action={games.length > 5 ? 'See all' : undefined} onAction={() => router.push('/history')} />
      <Card padded={false}>
        {games.length === 0 ? <View style={{ padding: 16 }}><EmptyState icon="time-outline" title="No games yet" text="Your finished games will be listed here, ready to review." action="Play now" onAction={() => router.push('/play')} /></View>
          : games.slice(0, 5).map((g, i) => <GameRow key={g.id} g={g} first={i === 0} />)}
      </Card>

      <Sheet visible={edit} onClose={() => setEdit(false)} title="Edit profile">
        <Txt variant="label" muted>Name</Txt>
        <TextInput value={name} onChangeText={setName} maxLength={18} placeholder="Your name" placeholderTextColor={p.textFaint}
          style={{ height: 48, borderRadius: radius.md, backgroundColor: p.surfaceAlt, color: p.text, paddingHorizontal: 14, fontFamily: fonts.medium, fontSize: 16 }} />
        <Txt variant="label" muted>Avatar</Txt>
        <Row gap={10} style={{ flexWrap: 'wrap' }}>
          {AVATARS.map((_, i) => (
            <Pressable key={i} onPress={() => setAvatar(i)}><Avatar index={i} size={56} ring={avatar === i} /></Pressable>
          ))}
        </Row>
        <Button title="Save" onPress={() => { useProgress.getState().setProfile({ username: name, avatar }); setEdit(false); }} full />
      </Sheet>
    </Screen>
  );
}

