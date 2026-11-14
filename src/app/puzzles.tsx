import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BoardView } from '@/board/BoardView';
import { ChessGame } from '@/chess/ChessGame';
import { trackPieces } from '@/chess/pieceIds';
import type { BoardMarker } from '@/board/types';
import type { PieceSymbol, Square } from '@/chess/types';
import { Button, Chip, Row, Screen, Txt } from '@/ui/kit';
import { fonts, radius, usePalette } from '@/ui/theme';
import { useProgress } from '@/data/progressStore';
import { dailyPuzzle, nextPuzzle, Puzzle, THEME_FILTERS, THEME_LABELS } from '@/content/puzzles';
import { describeMove, uciToSan } from '@/engine/explain';
import { moveSound, sfx, haptic } from '@/audio/sound';
import { PromotionPicker } from '@/features/game/parts';

type Phase = 'solving' | 'wrong' | 'solved' | 'failed-solved' | 'showing';

export default function Puzzles() {
  const p = usePalette();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ daily?: string }>();
  const prog = useProgress();
  const [theme, setTheme] = useState('all');
  const [puzzle, setPuzzle] = useState<Puzzle>(() => (params.daily ? dailyPuzzle() : nextPuzzle(prog.puzzleRating, prog.solvedPuzzles, 'all')));
  const isDaily = !!params.daily && puzzle.id === dailyPuzzle().id;
  const [game, setGame] = useState(() => new ChessGame(puzzle.fen));
  const [ply, setPly] = useState(0); // index into puzzle.moves of the next expected move
  const [phase, setPhase] = useState<Phase>('solving');
  const [selected, setSelected] = useState<Square | null>(null);
  const [markers, setMarkers] = useState<BoardMarker[]>([]);
  const [hint, setHint] = useState(false);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const [, force] = useState(0);
  const reported = useRef(false);
  const hintsUsed = useRef(0);
  const history = useRef<string[]>([]);
  const solver = useMemo(() => new ChessGame(puzzle.fen).turn(), [puzzle]);
  const boardSize = Math.min(width - 16, height * 0.58, 560);

  const load = (pz: Puzzle) => {
    history.current.push(puzzle.id);
    setPuzzle(pz);
    setGame(new ChessGame(pz.fen));
    setPly(0); setPhase('solving'); setSelected(null); setMarkers([]); setHint(false);
    reported.current = false; hintsUsed.current = 0;
  };

  const report = (solved: boolean) => {
    if (reported.current) return;
    reported.current = true;
    useProgress.getState().dispatch({ type: 'puzzle', id: puzzle.id, rating: puzzle.rating, solved, daily: isDaily, hintsUsed: hintsUsed.current });
  };

  const playReply = (g: ChessGame, idx: number) => {
    setTimeout(() => {
      const rec = g.moveUci(puzzle.moves[idx]);
      if (rec) moveSound(rec, g.inCheck());
      setPly(idx + 1);
      force((x) => x + 1);
    }, 420);
  };

  const attempt = (from: Square, to: Square, promotion?: PieceSymbol) => {
    if (phase !== 'solving' || game.turn() !== solver) return;
    const uci = from + to + (promotion ?? '');
    const expected = puzzle.moves[ply];
    const test = new ChessGame(game.fen());
    const rec = test.moveUci(uci);
    if (!rec) return;
    const mates = test.status()?.reason === 'checkmate';
    setSelected(null);
    setHint(false);
    if (uci === expected || mates) {
      game.moveUci(uci);
      moveSound(rec, game.inCheck());
      setMarkers([{ square: to, kind: 'good' }]);
      const next = ply + 1;
      if (next >= puzzle.moves.length || mates) {
        setPly(next);
        const clean = !reported.current;
        report(true);
        setPhase(clean ? 'solved' : 'failed-solved');
        sfx('correct'); haptic('success');
      } else {
        setPly(next);
        playReply(game, next);
      }
      force((x) => x + 1);
    } else {
      // Show the wrong move briefly, then take it back.
      game.moveUci(uci);
      moveSound(rec, game.inCheck());
      setMarkers([{ square: to, kind: 'bad' }]);
      setPhase('wrong');
      sfx('wrong'); haptic('error');
      report(false);
      force((x) => x + 1);
      setTimeout(() => { game.undo(); setMarkers([]); setPhase('solving'); force((x) => x + 1); }, 700);
    }
  };

  const onSquarePress = (sq: Square) => {
    if (phase !== 'solving' || game.turn() !== solver) return;
    const piece = game.get(sq);
    if (selected && game.legalTargets(selected).includes(sq)) {
      if (game.isPromotion(selected, sq)) setPromo({ from: selected, to: sq });
      else attempt(selected, sq);
      return;
    }
    setSelected(piece && piece.color === solver ? (sq === selected ? null : sq) : null);
  };
  const onDrop = (from: Square, to: Square) => {
    if (!game.legalTargets(from).includes(to)) return;
    if (game.isPromotion(from, to)) setPromo({ from, to }); else attempt(from, to);
  };

  const showSolution = () => {
    report(false);
    setPhase('showing');
    const g = game;
    let i = ply;
    const step = () => {
      if (i >= puzzle.moves.length) { setPhase('failed-solved'); return; }
      const rec = g.moveUci(puzzle.moves[i]);
      if (rec) moveSound(rec, g.inCheck());
      i++;
      setPly(i);
      setMarkers(rec ? [{ square: rec.to, kind: 'info' }] : []);
      force((x) => x + 1);
      setTimeout(step, 750);
    };
    setTimeout(step, 200);
  };

  const tracked = trackPieces(game.startFen, game.history());
  const last = game.lastMove();
  const done = phase === 'solved' || phase === 'failed-solved';
  const keyMove = puzzle.moves[0];
  const explanation = useMemo(() => {
    const d = describeMove(puzzle.fen, keyMove);
    const san = uciToSan(puzzle.fen, keyMove);
    return `${san}${d.length ? ` ${d[0]}` : ''}.`;
  }, [puzzle]);
  const hintSq = hint ? (puzzle.moves[ply]?.slice(0, 2) as Square) : null;

  return (
    <Screen title={isDaily ? 'Daily puzzle' : 'Puzzles'} back padded={false} contentStyle={{ paddingHorizontal: 0, gap: 12 }}
      overlay={promo && <PromotionPicker color={solver} onCancel={() => setPromo(null)} onPick={(t) => { const m = promo; setPromo(null); attempt(m.from, m.to, t); }} />}>
      {!params.daily && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {THEME_FILTERS.map((t) => (
            <Txt key={t.id} onPress={() => { setTheme(t.id); load(nextPuzzle(prog.puzzleRating, prog.solvedPuzzles, t.id, [puzzle.id])); }}
              variant="caption" style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, overflow: 'hidden', fontFamily: fonts.semibold,
                backgroundColor: theme === t.id ? p.accent : p.surfaceAlt, color: theme === t.id ? p.accentText : p.textMuted }}>{t.label}</Txt>
          ))}
        </ScrollView>
      )}
      <Row style={{ paddingHorizontal: 16 }}>
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: solver === 'w' ? '#F2EEE6' : '#1A1A1A', borderWidth: 1, borderColor: p.borderStrong }} />
        <Txt variant="h2" style={{ flex: 1 }}>{done ? 'Solved' : `${solver === 'w' ? 'White' : 'Black'} to move — find the best move`}</Txt>
        <Chip label={`${puzzle.rating}`} icon="star-outline" />
      </Row>
      <View style={{ alignItems: 'center' }}>
        <BoardView pieces={tracked.pieces} captured={tracked.lastCaptured} orientation={solver} size={boardSize}
          selected={selected} targets={selected ? game.legalTargets(selected) : []} lastMove={last ? { from: last.from, to: last.to } : null}
          markers={markers} highlights={hintSq ? [hintSq] : []} interactive={phase === 'solving' && game.turn() === solver} movableColor={phase === 'solving' ? solver : null}
          onSquarePress={onSquarePress} onDrop={onDrop} checkSquare={game.inCheck() ? game.kingSquare(game.turn()) : null} />
      </View>
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        {phase === 'wrong' && <Row><Ionicons name="close-circle" size={20} color={p.danger} /><Txt color={p.danger}>Not quite. Try again.</Txt></Row>}
        {phase === 'solving' && reported.current && <Row><Ionicons name="refresh" size={18} color={p.textMuted} /><Txt muted>Keep trying — or reveal the solution.</Txt></Row>}
        {phase === 'solving' && !reported.current && ply > 0 && <Row><Ionicons name="checkmark-circle" size={20} color={p.success} /><Txt color={p.success}>Correct! Keep going.</Txt></Row>}
        {done && (
          <Animated.View entering={FadeInDown} style={{ backgroundColor: p.surface, borderRadius: radius.md, padding: 14, gap: 8, borderLeftWidth: 3, borderLeftColor: phase === 'solved' ? p.success : p.warning }}>
            <Row>
              <Ionicons name={phase === 'solved' ? 'checkmark-circle' : 'information-circle'} size={20} color={phase === 'solved' ? p.success : p.warning} />
              <Txt variant="h2">{phase === 'solved' ? 'Puzzle solved!' : 'Solution shown'}</Txt>
            </Row>
            <Txt variant="caption" style={{ fontSize: 13 }}>The key move: {explanation}</Txt>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {puzzle.themes.filter((t) => THEME_LABELS[t] && !['oneMove', 'short', 'long'].includes(t)).map((t) => <Chip key={t} label={THEME_LABELS[t]} />)}
            </Row>
            <Txt variant="caption" muted>Puzzle rating: {prog.puzzleRating}</Txt>
          </Animated.View>
        )}
        <Row>
          {!done && phase !== 'showing' && <Button title="Hint" icon="bulb-outline" variant="secondary" style={{ flex: 1 }} disabled={hint} onPress={() => { hintsUsed.current++; setHint(true); }} />}
          {!done && phase !== 'showing' && <Button title="Solution" icon="eye-outline" variant="secondary" style={{ flex: 1 }} onPress={showSolution} />}
          {done && !isDaily && <Button title="Next puzzle" icon="arrow-forward" style={{ flex: 1 }} onPress={() => load(nextPuzzle(useProgress.getState().puzzleRating, useProgress.getState().solvedPuzzles, theme, [puzzle.id, ...history.current.slice(-20)]))} />}
          {done && isDaily && <Button title="More puzzles" icon="arrow-forward" style={{ flex: 1 }} onPress={() => load(nextPuzzle(useProgress.getState().puzzleRating, useProgress.getState().solvedPuzzles, 'all', [puzzle.id]))} />}
        </Row>
      </View>
    </Screen>
  );
}
