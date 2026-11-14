import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Line, Polygon } from 'react-native-svg';
import type { BoardProps } from '@/board/types';
import type { Square } from '@/chess/types';
import { FILES, coordsToSquare, squareToCoords } from '@/chess/types';
import { getBoardTheme } from '@/board/boardThemes';
import { useSettings } from '@/data/settings';
import { PieceSvg } from './PieceSvg';
import type { TrackedPiece } from '@/chess/pieceIds';
import { fonts } from '@/ui/theme';

function sqXY(sq: Square, flip: boolean, cell: number) {
  const { file, rank } = squareToCoords(sq);
  const col = flip ? 7 - file : file;
  const row = flip ? rank : 7 - rank;
  return { x: col * cell, y: row * cell };
}

const AnimatedPiece = memo(function AnimatedPiece({ piece, cell, flip, setId, duration, hidden }: {
  piece: TrackedPiece; cell: number; flip: boolean; setId: string; duration: number; hidden: boolean;
}) {
  const { x, y } = sqXY(piece.square, flip, cell);
  const tx = useSharedValue(x);
  const ty = useSharedValue(y);
  useEffect(() => {
    if (duration <= 0) { tx.value = x; ty.value = y; return; }
    tx.value = withTiming(x, { duration, easing: Easing.out(Easing.cubic) });
    ty.value = withTiming(y, { duration, easing: Easing.out(Easing.cubic) });
  }, [x, y, duration]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: cell, height: cell, opacity: hidden ? 0.25 : 1 }, style]}>
      <PieceSvg type={piece.type} color={piece.color} setId={setId} size={cell} />
    </Animated.View>
  );
});

const FadingCapture = memo(function FadingCapture({ piece, cell, flip, setId, duration }: { piece: TrackedPiece; cell: number; flip: boolean; setId: string; duration: number }) {
  const o = useSharedValue(1);
  const s = useSharedValue(1);
  useEffect(() => {
    o.value = withTiming(0, { duration: duration * 1.4 });
    s.value = withTiming(0.6, { duration: duration * 1.4 });
  }, []);
  const { x, y } = sqXY(piece.square, flip, cell);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x, top: y, width: cell, height: cell }, style]}>
      <PieceSvg type={piece.type} color={piece.color} setId={setId} size={cell} />
    </Animated.View>
  );
});

function Board2DImpl(props: BoardProps) {
  const { pieces, orientation, size, selected, targets = [], lastMove, checkSquare, hint, markers = [], highlights = [], interactive = true, captured } = props;
  const settings = useSettings();
  const theme = getBoardTheme(settings.boardTheme);
  const cell = size / 8;
  const flip = orientation === 'b';
  const duration = settings.animations === 'off' ? 0 : settings.animations === 'reduced' ? 120 : 220;
  const occupied = useMemo(() => new Map(pieces.map((p) => [p.square, p])), [pieces]);

  // When the board turns to the other side, spin it like a real board being rotated.
  const spin = useSharedValue(0);
  const prevOrientation = useRef(orientation);
  useEffect(() => {
    if (prevOrientation.current !== orientation && duration > 0) {
      spin.value = 180;
      spin.value = withTiming(0, { duration: 750, easing: Easing.inOut(Easing.cubic) });
    }
    prevOrientation.current = orientation;
  }, [orientation]);
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));

  // Drag state
  const [drag, setDrag] = useState<{ piece: TrackedPiece; x: number; y: number } | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const occRef = useRef(occupied);
  occRef.current = occupied;
  const start = useRef<{ sq: Square | null; x: number; y: number; dragging: boolean }>({ sq: null, x: 0, y: 0, dragging: false });

  const squareAt = (x: number, y: number): Square | null => {
    const col = Math.floor(x / cell);
    const row = Math.floor(y / cell);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    const file = flip ? 7 - col : col;
    const rank = flip ? row : 7 - row;
    return coordsToSquare(file, rank);
  };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !!propsRef.current.interactive,
    onMoveShouldSetPanResponder: () => !!propsRef.current.interactive,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      start.current = { sq: squareAt(locationX, locationY), x: locationX, y: locationY, dragging: false };
    },
    onPanResponderMove: (e, g) => {
      const st = start.current;
      if (!st.sq) return;
      const p = occRef.current.get(st.sq);
      const mc = propsRef.current.movableColor;
      if (!p || !mc || (mc !== 'both' && p.color !== mc)) return;
      if (!st.dragging && Math.hypot(g.dx, g.dy) > 8) {
        st.dragging = true;
        if (propsRef.current.selected !== st.sq) propsRef.current.onSquarePress?.(st.sq);
      }
      if (st.dragging) setDrag({ piece: p, x: st.x + g.dx, y: st.y + g.dy });
    },
    onPanResponderRelease: (e, g) => {
      const st = start.current;
      if (st.dragging && st.sq) {
        const to = squareAt(st.x + g.dx, st.y + g.dy);
        setDrag(null);
        if (to && to !== st.sq) propsRef.current.onDrop?.(st.sq, to);
      } else if (st.sq) {
        propsRef.current.onSquarePress?.(st.sq);
      }
      start.current = { sq: null, x: 0, y: 0, dragging: false };
    },
    onPanResponderTerminate: () => { setDrag(null); start.current = { sq: null, x: 0, y: 0, dragging: false }; },
  }), [cell, flip]);

  const squares = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 8; col++) {
        const file = flip ? 7 - col : col;
        const rank = flip ? row : 7 - row;
        const light = (file + rank) % 2 === 1;
        out.push(<View key={`${row}-${col}`} style={{ position: 'absolute', left: col * cell, top: row * cell, width: cell, height: cell, backgroundColor: light ? theme.light : theme.dark }} />);
      }
    return out;
  }, [cell, flip, theme]);

  const overlay = (sq: Square, color: string, key: string) => {
    const { x, y } = sqXY(sq, flip, cell);
    return <View key={key} pointerEvents="none" style={{ position: 'absolute', left: x, top: y, width: cell, height: cell, backgroundColor: color }} />;
  };

  const coordColor = (light: boolean) => (light ? theme.dark : theme.light);

  return (
    <View style={{ width: size, height: size, borderRadius: 6 }} {...responder.panHandlers}>
      {/* All visuals ignore touches so locationX/Y are always relative to the board itself. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 6, overflow: 'hidden' }, spinStyle]}>
      {squares}
      {settings.showLastMove && lastMove && [overlay(lastMove.from, theme.lastMove, 'lm1'), overlay(lastMove.to, theme.lastMove, 'lm2')]}
      {highlights.map((sq) => overlay(sq, theme.lastMove, 'hl' + sq))}
      {selected && overlay(selected, theme.selected, 'sel')}
      {checkSquare && (() => {
        const { x, y } = sqXY(checkSquare, flip, cell);
        return <View key="chk" pointerEvents="none" style={{ position: 'absolute', left: x, top: y, width: cell, height: cell, borderRadius: cell / 2, backgroundColor: theme.check, transform: [{ scale: 0.92 }] }} />;
      })()}
      {markers.map((m) => overlay(m.square, m.kind === 'good' ? 'rgba(80,190,120,0.55)' : m.kind === 'bad' ? 'rgba(220,70,60,0.55)' : 'rgba(90,150,230,0.45)', 'mk' + m.square))}
      {settings.showCoords && (
        <>
          {Array.from({ length: 8 }).map((_, i) => {
            const rank = flip ? i + 1 : 8 - i;
            const light = ((flip ? 7 : 0) + rank - 1) % 2 === 1;
            return <Text key={'r' + i} pointerEvents="none" style={[styles.coord, { left: 2, top: i * cell + 1, color: coordColor(light), fontSize: Math.max(8, cell * 0.2) }]}>{rank}</Text>;
          })}
          {Array.from({ length: 8 }).map((_, i) => {
            const file = flip ? 7 - i : i;
            const light = (file + (flip ? 7 : 0)) % 2 === 1;
            return <Text key={'f' + i} pointerEvents="none" style={[styles.coord, { left: i * cell + cell - cell * 0.22, top: size - cell * 0.27, color: coordColor(light), fontSize: Math.max(8, cell * 0.2) }]}>{FILES[file]}</Text>;
          })}
        </>
      )}
      {captured && duration > 0 && <FadingCapture key={captured.id + (lastMove?.to ?? '')} piece={captured} cell={cell} flip={flip} setId={settings.pieceSet} duration={duration} />}
      {pieces.map((p) => (
        <AnimatedPiece key={p.id} piece={p} cell={cell} flip={flip} setId={settings.pieceSet} duration={duration} hidden={drag?.piece.id === p.id} />
      ))}
      {settings.showLegal && targets.map((sq) => {
        const { x, y } = sqXY(sq, flip, cell);
        const cap = occupied.has(sq);
        return cap ? (
          <View key={'t' + sq} pointerEvents="none" style={{ position: 'absolute', left: x, top: y, width: cell, height: cell, borderRadius: cell / 2, borderWidth: cell * 0.09, borderColor: 'rgba(20,20,20,0.32)' }} />
        ) : (
          <View key={'t' + sq} pointerEvents="none" style={{ position: 'absolute', left: x + cell * 0.36, top: y + cell * 0.36, width: cell * 0.28, height: cell * 0.28, borderRadius: cell, backgroundColor: 'rgba(20,20,20,0.28)' }} />
        );
      })}
      {hint && <HintArrow from={hint.from} to={hint.to} cell={cell} flip={flip} size={size} color={theme.hint} />}
      {drag && (
        <View pointerEvents="none" style={{ position: 'absolute', left: drag.x - cell * 0.6, top: drag.y - cell * 0.9, width: cell * 1.2, height: cell * 1.2 }}>
          <PieceSvg type={drag.piece.type} color={drag.piece.color} setId={settings.pieceSet} size={cell * 1.2} />
        </View>
      )}
      </Animated.View>
    </View>
  );
}

function HintArrow({ from, to, cell, flip, size, color }: { from: Square; to: Square; cell: number; flip: boolean; size: number; color: string }) {
  const a = sqXY(from, flip, cell);
  const b = sqXY(to, flip, cell);
  const x1 = a.x + cell / 2, y1 = a.y + cell / 2, x2 = b.x + cell / 2, y2 = b.y + cell / 2;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const head = cell * 0.42;
  const ex = x2 - Math.cos(ang) * head * 0.6;
  const ey = y2 - Math.sin(ang) * head * 0.6;
  const p1 = `${x2},${y2}`;
  const p2 = `${ex - Math.cos(ang) * head * 0.4 + Math.sin(ang) * head * 0.55},${ey - Math.sin(ang) * head * 0.4 - Math.cos(ang) * head * 0.55}`;
  const p3 = `${ex - Math.cos(ang) * head * 0.4 - Math.sin(ang) * head * 0.55},${ey - Math.sin(ang) * head * 0.4 + Math.cos(ang) * head * 0.55}`;
  return (
    <Svg pointerEvents="none" width={size} height={size} style={StyleSheet.absoluteFill}>
      <Line x1={x1} y1={y1} x2={ex - Math.cos(ang) * head * 0.3} y2={ey - Math.sin(ang) * head * 0.3} stroke={color} strokeWidth={cell * 0.18} strokeLinecap="round" />
      <Polygon points={`${p1} ${p2} ${p3}`} fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  coord: { position: 'absolute', fontFamily: fonts.semibold, opacity: 0.9 },
});

export const Board2D = memo(Board2DImpl);
