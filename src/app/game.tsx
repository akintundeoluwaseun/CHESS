import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, BackHandler, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession, currentGame } from '@/features/game/session';
import { CapturedRow, Clock, CoachIcon, MoveList, PromotionPicker, ThinkingDots, CLASS_COLORS } from '@/features/game/parts';
import { BoardView } from '@/board/BoardView';
import { trackPieces } from '@/chess/pieceIds';
import { materialFromHistory } from '@/chess/ChessGame';
import type { Color, PieceSymbol, Square } from '@/chess/types';
import { RESULT_TEXT, other } from '@/chess/types';
import { getLevel } from '@/engine/levels';
import { CLASS_LABEL } from '@/engine/explain';
import { useSettings } from '@/data/settings';
import { useProgress } from '@/data/progressStore';
import { AmbientGlow, Button, Chip, ConfirmDialog, IconButton, Row, Segmented, Sheet, ToggleRow, ToolButton, Txt, Card } from '@/ui/kit';
import { Avatar } from '@/ui/widgets';
import { Aurora, Glass } from '@/ui/glass';
import { PieceSvg } from '@/render2d/PieceSvg';
import { fonts, neu, neuInset, radius, space, usePalette } from '@/ui/theme';
import { aiGameConfig, GameConfig } from '@/modes/modes';
import { uid } from '@/data/storage';
import { haptic } from '@/audio/sound';
import { ACHIEVEMENTS } from '@/progression/catalog';
import { CHALLENGES } from '@/content/challenges';

export default function GameScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const s = useSession();
  const settings = useSettings();
  const prog = useProgress();
  const [selected, setSelected] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const [pendingMove, setPendingMove] = useState<{ from: Square; to: Square; promotion?: PieceSymbol } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<'resign' | 'restart' | 'draw' | null>(null);
  const [overDismissed, setOverDismissed] = useState(false);

  const cfg = s.config;
  const game = currentGame();
  const view: '2d' | '3d' = s.viewMode ?? settings.renderMode;
  const setView = (v: '2d' | '3d') => {
    useSession.getState().setViewMode(v);
    if (cfg?.mode !== 'local') settings.set({ renderMode: v });
  };

  // Two-player games: after each move the board turns to face the player whose turn it is.
  // The turn happens just after the move animation so both players see the move land.
  const liveTurn = s.fen.split(' ')[1] as Color;
  const [facing, setFacing] = useState<Color>(liveTurn);
  const [banner, setBanner] = useState<string | null>(null);
  useEffect(() => {
    if (cfg?.playerColor !== null) return;
    if (!settings.autoFlipLocal) return;
    if (facing === liveTurn) return;
    const t = setTimeout(() => {
      setFacing(liveTurn);
      if (!s.result) setBanner(liveTurn === 'w' ? "White's turn" : "Black's turn");
    }, s.moves.length ? 520 : 0);
    return () => clearTimeout(t);
  }, [liveTurn, cfg?.id, settings.autoFlipLocal]);
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 1500);
    return () => clearTimeout(t);
  }, [banner]);

  // Pause when leaving the screen or backgrounding the app; resume on return.
  useFocusEffect(useCallback(() => {
    useSession.getState().unpause();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') useSession.getState().unpause();
      else useSession.getState().pause();
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => { leave(); return true; });
    return () => { sub.remove(); back.remove(); useSession.getState().pause(); };
  }, []));

  useEffect(() => { setSelected(null); setPendingMove(null); }, [s.moves.length]);
  useEffect(() => { if (!s.result) setOverDismissed(false); }, [s.result]);

  const leave = () => {
    useSession.getState().pause();
    if (router.canGoBack()) router.back(); else router.replace('/');
  };

  const tracked = useMemo(() => trackPieces(game.startFen, s.moves), [s.moves, cfg?.id]);
  const material = useMemo(() => materialFromHistory(s.moves), [s.moves]);

  if (!cfg) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
        <Txt variant="title">No game in progress</Txt>
        <Button title="Back to home" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const turn = s.fen.split(' ')[1] as Color;
  const player: Color = cfg.playerColor ?? 'w';
  const baseOrientation: Color = cfg.playerColor ?? (settings.autoFlipLocal ? facing : 'w');
  const orientation: Color = flipped ? other(baseOrientation) : baseOrientation;
  const myTurn = !s.result && !s.aiThinking && (cfg.playerColor === null ? (!settings.autoFlipLocal || facing === turn) : turn === cfg.playerColor);
  const movable: Color | null = myTurn ? (cfg.playerColor ?? turn) : null;
  const last = s.moves[s.moves.length - 1];
  const inCheck = game.inCheck();
  const checkSq = inCheck && !s.result ? game.kingSquare(turn) : s.result?.reason === 'checkmate' ? game.kingSquare(turn) : null;
  const targets = selected ? game.legalTargets(selected) : [];
  const timed = cfg.timeControl.minutes > 0;
  const level = cfg.aiLevel ? getLevel(cfg.aiLevel) : null;
  const challenge = cfg.challengeId ? CHALLENGES.find((c) => c.id === cfg.challengeId) : undefined;

  const boardSize = Math.min(width - 16, height * 0.56, 560);

  const tryMove = (from: Square, to: Square) => {
    if (game.isPromotion(from, to)) { setPromo({ from, to }); return; }
    commit(from, to);
  };
  const commit = (from: Square, to: Square, promotion?: PieceSymbol) => {
    if (settings.confirmMoves && !pendingMove) { setPendingMove({ from, to, promotion }); return; }
    setPendingMove(null);
    const ok = useSession.getState().userMove(from, to, promotion);
    if (!ok) { haptic('error'); }
    setSelected(null);
  };

  const onSquarePress = (sq: Square) => {
    if (!myTurn || pendingMove) return;
    const piece = game.get(sq);
    if (selected && targets.includes(sq)) { tryMove(selected, sq); return; }
    if (piece && piece.color === movable) { setSelected(sq === selected ? null : sq); haptic('light'); return; }
    setSelected(null);
  };
  const onDrop = (from: Square, to: Square) => {
    if (!myTurn) return;
    if (game.legalTargets(from).includes(to)) tryMove(from, to);
    else setSelected(null);
  };

  const hintSquares = s.hint ? { from: s.hint.move.slice(0, 2) as Square, to: s.hint.move.slice(2, 4) as Square } : null;
  const opponentColor = other(orientation);
  const bottomColor = orientation;

  const PlayerBar = ({ color }: { color: Color }) => {
    const isHuman = cfg.playerColor === null || color === cfg.playerColor;
    const name = cfg.playerColor === null ? (color === 'w' ? 'White' : 'Black') : isHuman ? prog.username : `${level?.name} AI`;
    const sub = cfg.playerColor === null ? '' : isHuman ? (cfg.rated ? `${prog.rating}` : '') : `≈ ${level?.elo}`;
    const adv = color === 'w' ? material.diff : -material.diff;
    const active = !s.result && turn === color;
    return (
      <Row style={[{ paddingHorizontal: 10, height: 54, borderRadius: 18 }, active ? neu(p, 4) : { backgroundColor: 'transparent' }]}>
        {isHuman && cfg.playerColor !== null ? <Avatar index={prog.avatar} size={34} ring={active} /> : (
          <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
            backgroundColor: cfg.playerColor === null ? (color === 'w' ? '#E9E1D0' : '#5A5D66') : p.surfaceAlt,
            borderWidth: active ? 2 : 0, borderColor: p.accent }}>
            {cfg.playerColor === null
              ? <PieceSvg type="k" color={color} setId={settings.pieceSet} size={28} />
              : <Ionicons name="hardware-chip-outline" size={17} color={p.textMuted} />}
          </View>
        )}
        <View style={{ flex: 1, gap: 1 }}>
          <Row gap={6}>
            <Txt variant="bodyStrong" numberOfLines={1} style={{ fontSize: 14 }}>{name}</Txt>
            {!!sub && <Txt variant="caption" muted>{sub}</Txt>}
            {active && !isHuman && s.aiThinking && <ThinkingDots />}
            {active && cfg.playerColor === null && <Txt variant="label" color={p.accent} style={{ fontSize: 10 }}>To move</Txt>}
          </Row>
          <CapturedRow pieces={material.capturedBy[color]} color={other(color)} advantage={adv} />
        </View>
        {timed ? <Clock color={color} active={active} /> : active ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.accent, marginRight: 6 }} /> : null}
      </Row>
    );
  };

  const status = (() => {
    if (s.engineError) return { icon: 'alert-circle', color: p.danger, text: s.engineError, action: { label: 'Retry', fn: () => useSession.getState().retryEngine() } };
    if (s.result) return null;
    if (s.aiThinking) return { icon: 'hourglass-outline', color: p.textMuted, text: `${level?.name} is thinking…` };
    if (s.drawOfferPending) return { icon: 'hand-left-outline', color: p.textMuted, text: 'The AI is considering your draw offer…' };
    if (s.notice) return { icon: 'information-circle-outline', color: p.info, text: s.notice };
    if (inCheck) return { icon: 'warning-outline', color: p.danger, text: cfg.playerColor === null ? `${turn === 'w' ? 'White' : 'Black'} is in check` : 'You are in check' };
    if (cfg.playerColor === null) return { icon: 'swap-horizontal', color: p.textMuted, text: `${turn === 'w' ? 'White' : 'Black'} to move` };
    if (challenge?.goal.maxMoves) {
      const mine = s.moves.filter((m) => m.color === cfg.playerColor).length;
      return { icon: 'flag-outline', color: p.accent, text: `${challenge.goal.kind === 'win' ? 'Win' : 'Survive'} · move ${mine} of ${challenge.goal.maxMoves}` };
    }
    return { icon: 'ellipse', color: p.success, text: 'Your move' };
  })();

  const finished = s.finished;
  const outcome = finished?.record.outcome;
  const title = !s.result ? '' : finished?.challengeSuccess !== undefined
    ? (finished.challengeSuccess ? 'Challenge complete' : 'Challenge failed')
    : cfg.playerColor === null ? (s.result.winner ? `${s.result.winner === 'w' ? 'White' : 'Black'} wins` : 'Draw')
      : outcome === 'win' ? 'Victory' : outcome === 'loss' ? 'Defeat' : 'Draw';

  const rematch = () => {
    let next: GameConfig;
    if (challenge) next = { ...cfg, id: uid('g') };
    else if (cfg.mode === 'ai' || cfg.mode === 'quick') next = { ...aiGameConfig(cfg.aiLevel!, other(player), cfg.timeControl), mode: cfg.mode, title: cfg.title };
    else next = { ...cfg, id: uid('g'), playerColor: cfg.playerColor ? other(cfg.playerColor) : null };
    if (cfg.mode === 'ranked') { router.replace('/ranked'); return; }
    useSession.getState().start(next);
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top }}>
      <Aurora intensity={0.45} />
      {/* Top bar */}
      <Row style={{ paddingHorizontal: space.lg, height: 52 }}>
        <IconButton icon="chevron-back" label="Leave game" onPress={leave} size={38} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Txt variant="h2">{challenge ? challenge.title : cfg.title}</Txt>
          <Txt variant="caption" muted>{[level?.name, cfg.rated ? 'Rated' : null, timed ? `${cfg.timeControl.minutes}+${cfg.timeControl.increment}` : null].filter(Boolean).join(' · ') || 'Casual'}</Txt>
        </View>
        <IconButton icon="ellipsis-horizontal" label="Game menu" onPress={() => setMenu(true)} size={38} />
      </Row>

      <View style={{ flex: 1, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', paddingHorizontal: 8 }}>
        <View style={{ width: boardSize }}><PlayerBar color={opponentColor} /></View>
        <View style={{ marginVertical: 6 }}>
          {banner && (
            <Animated.View key={banner + s.moves.length} entering={FadeIn.duration(200)} exiting={FadeOut.duration(300)} pointerEvents="none"
              style={{ position: 'absolute', zIndex: 5, top: '42%', alignSelf: 'center' }}>
              <Glass radius={14} intensity={60} style={{ paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(15,22,30,0.55)' }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: turn === 'w' ? '#F2EEE6' : '#1A1A1A', borderWidth: 1.5, borderColor: p.accent }} />
                <Txt variant="h2" color="#FFFFFF">{banner}</Txt>
              </Glass>
            </Animated.View>
          )}
          <BoardView mode={view}
            pieces={tracked.pieces} captured={tracked.lastCaptured} orientation={orientation} size={boardSize}
            selected={selected} targets={targets} lastMove={last ? { from: last.from, to: last.to } : null}
            checkSquare={checkSq} hint={hintSquares} interactive={myTurn && !pendingMove} movableColor={movable}
            onSquarePress={onSquarePress} onDrop={onDrop}
          />
        </View>
        <View style={{ width: boardSize }}><PlayerBar color={bottomColor} /></View>
      </View>

      {/* Status / coach / hint */}
      <View style={{ paddingHorizontal: space.lg, marginTop: 4, gap: 8, minHeight: 96 }}>
        {pendingMove ? (
          <Row style={{ backgroundColor: p.surface, borderRadius: radius.md, padding: 10 }}>
            <Txt variant="bodyStrong" style={{ flex: 1 }}>Confirm move {pendingMove.from}–{pendingMove.to}?</Txt>
            <Button title="Cancel" size="sm" variant="secondary" onPress={() => { setPendingMove(null); setSelected(null); }} />
            <Button title="Play" size="sm" onPress={() => { const m = pendingMove; setPendingMove(null); useSession.getState().userMove(m.from, m.to, m.promotion); }} />
          </Row>
        ) : s.hint ? (
          <Animated.View entering={FadeInDown.duration(220)} style={{ flexDirection: 'row', gap: 10, backgroundColor: p.surface, borderRadius: radius.md, padding: 12, borderLeftWidth: 3, borderLeftColor: p.success }}>
            <Ionicons name="bulb-outline" size={18} color={p.success} />
            <Txt variant="caption" style={{ flex: 1, fontSize: 13 }}>{s.hint.text}</Txt>
          </Animated.View>
        ) : s.coach ? (
          <Animated.View entering={FadeInDown.duration(220)} style={{ flexDirection: 'row', gap: 10, backgroundColor: p.surface, borderRadius: radius.md, padding: 12, borderLeftWidth: 3, borderLeftColor: CLASS_COLORS(p)[s.coach.classification] }}>
            <CoachIcon cls={s.coach.classification} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="caption" style={{ fontFamily: fonts.semibold, color: CLASS_COLORS(p)[s.coach.classification] }}>{CLASS_LABEL[s.coach.classification]}</Txt>
              <Txt variant="caption" style={{ fontSize: 13 }}>{s.coach.text}</Txt>
              {cfg.allowUndo && ['mistake', 'blunder', 'inaccuracy'].includes(s.coach.classification) && !s.result && (
                <Row gap={14} style={{ marginTop: 4 }}>
                  <Txt variant="caption" color={p.accent} style={{ fontFamily: fonts.semibold }} onPress={() => useSession.getState().undo()}>Take back</Txt>
                  <Txt variant="caption" muted onPress={() => useSession.getState().dismissCoach()}>Dismiss</Txt>
                </Row>
              )}
            </View>
          </Animated.View>
        ) : status ? (
          <Row style={{ height: 30, paddingHorizontal: 4 }} gap={8}>
            <Ionicons name={status.icon as any} size={status.icon === 'ellipse' ? 9 : 16} color={status.color} />
            <Txt variant="caption" muted style={{ flex: 1 }} numberOfLines={2}>{status.text}</Txt>
            {'action' in status && status.action && <Button title={status.action.label} size="sm" variant="secondary" onPress={status.action.fn} />}
          </Row>
        ) : null}

        <View style={[{ borderRadius: 16, paddingVertical: 4 }, neuInset(p, 3)]}>
          <MoveList moves={s.moves} />
        </View>
      </View>
      </View>

      {/* Toolbar */}
      <Row style={{ justifyContent: 'space-around', paddingHorizontal: space.md, paddingBottom: insets.bottom + 8, paddingTop: 8 }}>
        {cfg.allowUndo && <ToolButton icon="arrow-undo-outline" label="Undo" disabled={!!s.result || s.moves.length === 0} onPress={() => useSession.getState().undo()} />}
        {cfg.allowHints && <ToolButton icon="bulb-outline" label={s.hintLoading ? 'Thinking' : 'Hint'} active={!!s.hint} disabled={!myTurn || s.hintLoading} onPress={() => useSession.getState().requestHint()} />}
        <ToolButton icon="swap-vertical-outline" label="Flip" onPress={() => setFlipped((f) => !f)} />
        <ToolButton icon={view === '3d' ? 'grid-outline' : 'cube-outline'} label={view === '3d' ? '2D' : '3D'} onPress={() => setView(view === '3d' ? '2d' : '3d')} />
        {s.result ? (
          <ToolButton icon="stats-chart-outline" label="Review" onPress={() => router.push(`/analysis/${cfg.id}`)} />
        ) : (
          <ToolButton icon="flag-outline" label="Resign" onPress={() => setConfirm('resign')} />
        )}
      </Row>

      {promo && <PromotionPicker color={turn} onCancel={() => { setPromo(null); setSelected(null); }} onPick={(t) => { const m = promo; setPromo(null); commit(m.from, m.to, t); }} />}

      {/* Menu */}
      <Sheet visible={menu} onClose={() => setMenu(false)} title="Game options">
        <Txt variant="label" muted>View</Txt>
        <Segmented options={[{ value: '2d', label: '2D Classic' }, { value: '3d', label: '3D' }]} value={view} onChange={setView} />
        {view === '3d' && (
          <Segmented options={[{ value: 'player', label: 'Player' }, { value: 'top', label: 'Top' }, { value: 'low', label: 'Low' }]} value={settings.camera} onChange={(v) => settings.set({ camera: v })} />
        )}
        <ToggleRow label="Sound effects" value={settings.sound} onChange={(v) => settings.set({ sound: v })} icon="volume-medium-outline" />
        <ToggleRow label="Show legal moves" value={settings.showLegal} onChange={(v) => settings.set({ showLegal: v })} icon="locate-outline" />
        {cfg.allowHints && cfg.aiLevel && <ToggleRow label="Coach tips" detail="Explains mistakes and great moves as you play" value={settings.coachTips} onChange={(v) => settings.set({ coachTips: v })} icon="school-outline" />}
        {cfg.playerColor === null && <ToggleRow label="Turn board to each player" detail="The board rotates to face whoever moves next" value={settings.autoFlipLocal} onChange={(v) => settings.set({ autoFlipLocal: v })} icon="sync-outline" />}
        <Txt variant="label" muted style={{ marginTop: 6 }}>Game</Txt>
        {!s.result && <Button title={cfg.playerColor === null ? 'Agree to a draw' : 'Offer a draw'} variant="secondary" icon="hand-left-outline" onPress={() => { setMenu(false); setConfirm('draw'); }} full />}
        {!cfg.rated && <Button title="Restart game" variant="secondary" icon="refresh" onPress={() => { setMenu(false); s.moves.length && !s.result ? setConfirm('restart') : rematchSame(); }} full />}
        <Button title="All settings" variant="ghost" icon="settings-outline" onPress={() => { setMenu(false); router.push('/settings'); }} full />
      </Sheet>

      <ConfirmDialog visible={confirm === 'resign'} title="Resign this game?" text={cfg.rated ? 'This counts as a loss for your rating.' : 'The game will end as a loss.'} confirm="Resign" danger
        onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); useSession.getState().resign(); }} />
      <ConfirmDialog visible={confirm === 'restart'} title="Restart?" text="The current game will be discarded and not recorded." confirm="Restart"
        onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); rematchSame(); }} />
      <ConfirmDialog visible={confirm === 'draw'} title={cfg.playerColor === null ? 'Agree to a draw?' : 'Offer a draw?'} text={cfg.playerColor === null ? 'Both players agree to end the game as a draw.' : 'The AI accepts only if it judges the position to be equal or worse for itself.'} confirm={cfg.playerColor === null ? 'Draw' : 'Offer'}
        onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); useSession.getState().offerDraw(); }} />

      {/* Game over */}
      {s.result && finished && !overDismissed && (
        <Animated.View entering={FadeIn.duration(250)} style={{ position: 'absolute', inset: 0, backgroundColor: p.overlay, justifyContent: 'flex-end' } as any}>
          <Animated.View entering={SlideInDown.springify().damping(18)} style={{ backgroundColor: p.bgElevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl, paddingBottom: insets.bottom + space.lg, gap: 14, borderWidth: 1, borderColor: p.border }}>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Ionicons name={outcome === 'win' || finished.challengeSuccess ? 'trophy' : outcome === 'loss' || finished.challengeSuccess === false ? 'close-circle-outline' : 'remove-circle-outline'} size={40}
                color={outcome === 'win' || finished.challengeSuccess ? p.gold : p.textMuted} />
              <Txt variant="display">{title}</Txt>
              <Txt muted>{RESULT_TEXT[s.result.reason]}{s.moves.length ? ` · ${Math.ceil(s.moves.length / 2)} move${Math.ceil(s.moves.length / 2) === 1 ? '' : 's'}` : ''}</Txt>
            </View>
            <Card style={{ gap: 8, padding: 14 }}>
              {finished.record.ratingAfter !== undefined && (
                <Row>
                  <Txt style={{ flex: 1 }}>Rating</Txt>
                  <Txt variant="number">{finished.record.ratingBefore} → {finished.record.ratingAfter}</Txt>
                  <Chip label={`${finished.record.ratingAfter - finished.record.ratingBefore! >= 0 ? '+' : ''}${finished.record.ratingAfter - finished.record.ratingBefore!}`}
                    tone={finished.record.ratingAfter >= finished.record.ratingBefore! ? 'success' : 'danger'} />
                </Row>
              )}
              {finished.rewards.filter((r) => r.kind === 'xp').map((r, i) => (
                <Row key={i}><Txt variant="caption" style={{ flex: 1 }} muted>{(r as any).label}</Txt><Txt variant="number" color={p.gold} style={{ fontSize: 13 }}>+{(r as any).amount} XP</Txt></Row>
              ))}
              {finished.rewards.filter((r) => r.kind === 'xp').length === 0 && (
                <Txt variant="caption" muted>{s.moves.length < 10 ? 'Very short games (under 5 moves each) earn no XP.' : 'No XP this time.'}</Txt>
              )}
              {finished.rewards.filter((r) => r.kind === 'achievement').map((r, i) => (
                <Row key={'a' + i}><Ionicons name="trophy-outline" size={14} color={p.accent} /><Txt variant="caption">{ACHIEVEMENTS.find((a) => a.id === (r as any).id)?.title}</Txt></Row>
              ))}
            </Card>
            <Row>
              <Button title="Review" icon="analytics-outline" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/analysis/${cfg.id}`)} />
              <Button title={challenge ? 'Try again' : cfg.mode === 'ranked' ? 'Next game' : 'Rematch'} icon="refresh" style={{ flex: 1 }} onPress={rematch} />
            </Row>
            <Row>
              <Button title="View board" variant="ghost" size="sm" style={{ flex: 1 }} onPress={() => setOverDismissed(true)} />
              <Button title="Home" variant="ghost" size="sm" style={{ flex: 1 }} onPress={() => { useSession.getState().clear(); router.replace('/'); }} />
            </Row>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );

  function rematchSame() {
    useSession.getState().start({ ...cfg!, id: uid('g') });
  }
}
