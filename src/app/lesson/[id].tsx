import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { BoardView } from '@/board/BoardView';
import { ChessGame } from '@/chess/ChessGame';
import { trackPieces } from '@/chess/pieceIds';
import type { BoardMarker } from '@/board/types';
import type { PieceSymbol, Square } from '@/chess/types';
import { Button, Card, Row, Screen, Txt } from '@/ui/kit';
import { radius, usePalette } from '@/ui/theme';
import { LESSONS, LessonStep } from '@/content/lessons';
import { useProgress } from '@/data/progressStore';
import { chooseAiMove } from '@/engine/ai';
import { getLevel } from '@/engine/levels';
import { haptic, moveSound, sfx } from '@/audio/sound';
import { PromotionPicker, ThinkingDots } from '@/features/game/parts';
import type { Reward } from '@/progression/types';

type State = 'idle' | 'wrong' | 'success' | 'failed' | 'thinking';

export default function LessonScreen() {
  const p = usePalette();
  const { width, height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lesson = LESSONS.find((l) => l.id === id);
  const [stepIdx, setStepIdx] = useState(0);
  const [complete, setComplete] = useState<Reward[] | null>(null);
  if (!lesson) return <Screen title="Lesson" back><Txt>Lesson not found.</Txt></Screen>;
  const step = lesson.steps[stepIdx];
  const boardSize = Math.min(width - 32, height * 0.5, 520);

  const next = () => {
    if (stepIdx + 1 < lesson.steps.length) setStepIdx(stepIdx + 1);
    else {
      const rewards = useProgress.getState().dispatch({ type: 'lesson', id: lesson.id });
      sfx('correct');
      setComplete(rewards);
    }
  };

  if (complete) {
    const xp = complete.reduce((a, r) => a + (r.kind === 'xp' ? r.amount : 0), 0);
    return (
      <Screen title={lesson.title} back>
        <Animated.View entering={FadeIn} style={{ alignItems: 'center', gap: 10, paddingVertical: 30 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: p.successSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={44} color={p.success} />
          </View>
          <Txt variant="display">Lesson complete</Txt>
          <Txt muted style={{ textAlign: 'center' }}>{lesson.summary}</Txt>
          {xp > 0 && <Txt variant="h2" color={p.accent}>+{xp} XP</Txt>}
        </Animated.View>
        <Button title="Back to lessons" onPress={() => router.back()} full />
        {(() => {
          const i = LESSONS.findIndex((l) => l.id === lesson.id);
          const nxt = LESSONS[i + 1];
          return nxt ? <Button title={`Next: ${nxt.title}`} variant="secondary" icon="arrow-forward" full onPress={() => router.replace(`/lesson/${nxt.id}`)} /> : null;
        })()}
      </Screen>
    );
  }

  return (
    <Screen title={lesson.title} back>
      <Row gap={6}>
        {lesson.steps.map((_, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= stepIdx ? p.accent : p.surfaceAlt }} />)}
      </Row>
      <StepView key={`${lesson.id}-${stepIdx}`} step={step} boardSize={boardSize} onNext={next} isLast={stepIdx === lesson.steps.length - 1} />
    </Screen>
  );
}

function StepView({ step, boardSize, onNext, isLast }: { step: LessonStep; boardSize: number; onNext: () => void; isLast: boolean }) {
  const p = usePalette();
  const fen = step.kind === 'info' ? step.fen : step.fen;
  const [game, setGame] = useState(() => (fen ? new ChessGame(fen) : null));
  const [ply, setPly] = useState(0);
  const [state, setState] = useState<State>('idle');
  const [selected, setSelected] = useState<Square | null>(null);
  const [markers, setMarkers] = useState<BoardMarker[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const [msg, setMsg] = useState('');
  const [, force] = useState(0);
  const learner = useMemo(() => (fen ? new ChessGame(fen).turn() : 'w'), [fen]);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const reset = () => {
    if (!fen) return;
    setGame(new ChessGame(fen)); setPly(0); setState('idle'); setSelected(null); setMarkers([]); setMsg('');
  };

  const engineReply = async (g: ChessGame) => {
    setState('thinking');
    try {
      const mv = await chooseAiMove({ startFen: g.startFen, moves: g.uciHistory(), level: getLevel(10) });
      if (!alive.current) return;
      const rec = g.moveUci(mv);
      if (rec) moveSound(rec, g.inCheck());
      force((x) => x + 1);
      const st = g.status();
      if (st) { setState('failed'); setMsg(st.reason === 'stalemate' ? 'Stalemate — the defending king had no legal move. Try again.' : 'The game ended in a draw. Try again.'); return; }
      setState('idle');
    } catch (e) {
      setState('idle');
      setMsg((e as Error).message);
    }
  };

  const attempt = (from: Square, to: Square, promotion?: PieceSymbol) => {
    if (!game || state !== 'idle' || game.turn() !== learner) return;
    const uci = from + to + (promotion ?? '');
    setSelected(null);
    if (step.kind === 'move') {
      const expected = step.solution[ply].split('|');
      const test = new ChessGame(game.fen());
      const rec = test.moveUci(uci);
      if (!rec) return;
      const mates = test.status()?.reason === 'checkmate';
      if (expected.includes(uci) || mates) {
        game.moveUci(uci);
        moveSound(rec, game.inCheck());
        setMarkers([{ square: to, kind: 'good' }]);
        const nextPly = ply + 1;
        if (nextPly >= step.solution.length || mates) {
          setPly(nextPly); setState('success'); sfx('correct'); haptic('success');
        } else {
          setPly(nextPly);
          setTimeout(() => {
            if (!alive.current) return;
            const r = game.moveUci(step.solution[nextPly].split('|')[0]);
            if (r) moveSound(r, game.inCheck());
            setPly(nextPly + 1); force((x) => x + 1);
          }, 450);
        }
        force((x) => x + 1);
      } else {
        game.moveUci(uci);
        moveSound(rec, game.inCheck());
        setMarkers([{ square: to, kind: 'bad' }]);
        setState('wrong'); sfx('wrong'); haptic('error');
        force((x) => x + 1);
        setTimeout(() => { if (!alive.current) return; game.undo(); setMarkers([]); setState('idle'); force((x) => x + 1); }, 750);
      }
    } else if (step.kind === 'goal') {
      const rec = game.move(from, to, promotion);
      if (!rec) return;
      moveSound(rec, game.inCheck());
      force((x) => x + 1);
      const mine = game.history().filter((m) => m.color === learner).length;
      if (step.goal === 'promote' && rec.promotion) { setState('success'); sfx('correct'); return; }
      const st = game.status();
      if (st?.reason === 'checkmate') { setState('success'); sfx('correct'); return; }
      if (st) { setState('failed'); setMsg(st.reason === 'stalemate' ? 'Stalemate! The king had no legal moves but was not in check. Try again.' : 'That position is a draw. Try again.'); sfx('wrong'); return; }
      if (mine >= step.maxMoves) { setState('failed'); setMsg(`You used all ${step.maxMoves} moves. Try again.`); sfx('wrong'); return; }
      engineReply(game);
    }
  };

  const onSquarePress = (sq: Square) => {
    if (!game || state !== 'idle' || game.turn() !== learner) return;
    const piece = game.get(sq);
    if (selected && game.legalTargets(selected).includes(sq)) {
      if (game.isPromotion(selected, sq)) setPromo({ from: selected, to: sq }); else attempt(selected, sq);
      return;
    }
    setSelected(piece && piece.color === learner ? (sq === selected ? null : sq) : null);
  };
  const onDrop = (from: Square, to: Square) => {
    if (!game || !game.legalTargets(from).includes(to)) return;
    if (game.isPromotion(from, to)) setPromo({ from, to }); else attempt(from, to);
  };

  const tracked = game ? trackPieces(game.startFen, game.history()) : null;
  const last = game?.lastMove();
  const interactive = step.kind !== 'info' && state === 'idle' && game?.turn() === learner;
  const hintSq = step.kind === 'move' && showHint && state === 'idle' ? (step.solution[ply]?.split('|')[0].slice(0, 2) as Square) : null;
  const movesLeft = step.kind === 'goal' && game ? step.maxMoves - game.history().filter((m) => m.color === learner).length : 0;

  return (
    <Animated.View entering={FadeInDown.duration(250)} style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <Txt variant="title">{step.title}</Txt>
        <Txt muted style={{ lineHeight: 22 }}>{step.text}</Txt>
      </View>
      {game && tracked && (
        <View style={{ alignItems: 'center' }}>
          <BoardView pieces={tracked.pieces} captured={tracked.lastCaptured} orientation={learner} size={boardSize}
            selected={selected} targets={selected ? game.legalTargets(selected) : []} lastMove={last ? { from: last.from, to: last.to } : null}
            markers={markers} highlights={[...(step.kind === 'info' ? step.highlights ?? [] : []), ...(hintSq ? [hintSq] : [])]}
            interactive={interactive} movableColor={interactive ? learner : null} onSquarePress={onSquarePress} onDrop={onDrop}
            checkSquare={game.inCheck() ? game.kingSquare(game.turn()) : null} />
        </View>
      )}
      {step.kind === 'goal' && state !== 'success' && (
        <Row>
          {state === 'thinking' ? <><ThinkingDots /><Txt variant="caption" muted>Engine is defending…</Txt></> : <Txt variant="caption" muted>{movesLeft} moves left</Txt>}
        </Row>
      )}
      {state === 'wrong' && <Row><Ionicons name="close-circle" size={20} color={p.danger} /><Txt color={p.danger}>Not this time — try another move.</Txt></Row>}
      {state === 'failed' && <Card style={{ gap: 10 }}><Txt color={p.danger}>{msg}</Txt><Button title="Try again" icon="refresh" variant="secondary" onPress={reset} /></Card>}
      {!!msg && state === 'idle' && <Txt variant="caption" color={p.danger}>{msg}</Txt>}
      {state === 'success' && (
        <Animated.View entering={FadeInDown} style={{ backgroundColor: p.successSoft, borderRadius: radius.md, padding: 14, flexDirection: 'row', gap: 10 }}>
          <Ionicons name="checkmark-circle" size={22} color={p.success} />
          <Txt style={{ flex: 1 }}>{step.kind !== 'info' ? step.success : ''}</Txt>
        </Animated.View>
      )}
      {step.kind === 'info' || state === 'success' ? (
        <Button title={isLast ? 'Finish lesson' : 'Continue'} icon="arrow-forward" onPress={onNext} full />
      ) : step.kind === 'move' ? (
        <Button title={showHint ? step.hint : 'Show hint'} icon="bulb-outline" variant="secondary" onPress={() => setShowHint(true)} full />
      ) : (
        <Button title="Restart position" icon="refresh" variant="ghost" onPress={reset} full />
      )}
      {promo && <View style={{ height: 0 }}><PromotionPickerHost color={learner} onCancel={() => setPromo(null)} onPick={(t) => { const m = promo; setPromo(null); attempt(m.from, m.to, t); }} /></View>}
    </Animated.View>
  );
}

/** Lesson promotion picker rendered as a modal so it sits above the scroll view. */
function PromotionPickerHost(props: { color: 'w' | 'b'; onPick: (p: PieceSymbol) => void; onCancel: () => void }) {
  return <Modal transparent visible animationType="fade" onRequestClose={props.onCancel}><PromotionPicker {...props} /></Modal>;
}
