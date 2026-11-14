import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Share, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { useGames } from '@/data/gamesStore';
import { ChessGame } from '@/chess/ChessGame';
import { trackPieces } from '@/chess/pieceIds';
import { BoardView } from '@/board/BoardView';
import { analyzeGame, GameAnalysis } from '@/engine/analysis';
import { CLASS_LABEL, CLASS_SYMBOL, Classification } from '@/engine/explain';
import { formatEval } from '@/engine/uci';
import { Button, Card, Chip, IconButton, ProgressBar, Row, Screen, Txt } from '@/ui/kit';
import { fonts, radius, usePalette } from '@/ui/theme';
import { CLASS_COLORS, MoveList } from '@/features/game/parts';
import { RESULT_TEXT } from '@/chess/types';
import { getLevel } from '@/engine/levels';
import { useProgress } from '@/data/progressStore';

export default function AnalysisScreen() {
  const p = usePalette();
  const { width, height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const record = useGames((s) => s.games.find((g) => g.id === id));
  const saved = useGames((s) => s.analyses[id ?? '']);
  const username = useProgress((s) => s.username);
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(saved ?? null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ply, setPly] = useState(0);
  const cancelled = useRef(false);

  const game = useMemo(() => (record ? new ChessGame(record.startFen, record.uci) : null), [record?.id]);
  const history = game?.history() ?? [];
  useEffect(() => { setPly(history.length); }, [record?.id]);
  useEffect(() => () => { cancelled.current = true; }, []);

  const run = async () => {
    if (!record || !game) return;
    setError(null);
    setProgress(0);
    try {
      const a = await analyzeGame(record.startFen, game.history(), setProgress, 11, () => cancelled.current);
      if (cancelled.current) return;
      useGames.getState().saveAnalysis(record.id, a);
      setAnalysis(a);
    } catch (e) {
      if (!cancelled.current) setError((e as Error).message === 'cancelled' ? null : (e as Error).message);
    } finally {
      setProgress(null);
    }
  };
  useEffect(() => { if (record && !saved && history.length) run(); }, [record?.id]);

  if (!record || !game) return <Screen title="Review" back><Txt muted>This game is no longer available.</Txt></Screen>;

  const boardSize = Math.min(width - 48, height * 0.46, 520);
  const view = new ChessGame(record.startFen, record.uci.slice(0, ply));
  const tracked = trackPieces(record.startFen, view.history());
  const last = view.lastMove();
  const am = ply > 0 ? analysis?.moves[ply - 1] : undefined;
  const evalWhite = ply === 0 ? analysis?.startEvalWhite ?? 0 : am?.evalAfterWhite ?? 0;
  const orientation = record.playerColor ?? 'w';
  const opponent = record.aiLevel ? `${getLevel(record.aiLevel).name} AI` : 'Opponent';
  const whiteName = record.playerColor === null ? 'White' : record.playerColor === 'w' ? username : opponent;
  const blackName = record.playerColor === null ? 'Black' : record.playerColor === 'b' ? username : opponent;

  const share = () => {
    const pgn = game.pgn({
      Event: 'Onyx Chess', Date: new Date(record.startedAt).toISOString().slice(0, 10).replace(/-/g, '.'),
      White: whiteName, Black: blackName,
      Result: record.result.winner === 'w' ? '1-0' : record.result.winner === 'b' ? '0-1' : '1/2-1/2',
    });
    Share.share({ message: pgn }).catch(() => {});
  };

  return (
    <Screen title="Game review" back right={<IconButton icon="share-outline" label="Share PGN" onPress={share} size={38} />}>
      <Row>
        <Txt variant="caption" muted style={{ flex: 1 }}>{whiteName} vs {blackName} · {RESULT_TEXT[record.result.reason]}</Txt>
        {record.outcome && <Chip label={record.outcome === 'win' ? 'Won' : record.outcome === 'loss' ? 'Lost' : 'Draw'} tone={record.outcome === 'win' ? 'success' : record.outcome === 'loss' ? 'danger' : 'neutral'} />}
      </Row>

      <Row gap={8} style={{ alignItems: 'stretch', justifyContent: 'center' }}>
        <EvalBar cp={evalWhite} height={boardSize} flip={orientation === 'b'} />
        <BoardView pieces={tracked.pieces} captured={tracked.lastCaptured} orientation={orientation} size={boardSize} interactive={false}
          lastMove={last ? { from: last.from, to: last.to } : null} checkSquare={view.inCheck() ? view.kingSquare(view.turn()) : null}
          markers={am && last && ['mistake', 'blunder', 'inaccuracy', 'best'].includes(am.classification) ? [{ square: last.to, kind: am.classification === 'best' ? 'good' : 'bad' }] : []} />
      </Row>

      <Row style={{ justifyContent: 'center' }} gap={10}>
        <IconButton icon="play-skip-back" label="First move" onPress={() => setPly(0)} disabled={ply === 0} />
        <IconButton icon="chevron-back" label="Previous move" onPress={() => setPly(Math.max(0, ply - 1))} disabled={ply === 0} size={48} />
        <IconButton icon="chevron-forward" label="Next move" onPress={() => setPly(Math.min(history.length, ply + 1))} disabled={ply >= history.length} size={48} />
        <IconButton icon="play-skip-forward" label="Last move" onPress={() => setPly(history.length)} disabled={ply >= history.length} />
      </Row>

      <Card padded={false} style={{ paddingVertical: 4 }}>
        <MoveList moves={history.map((m, i) => ({ san: m.san + (analysis ? markFor(analysis.moves[i]?.classification) : '') }))} current={ply} onSelect={setPly} />
      </Card>

      {progress !== null && (
        <Card style={{ gap: 8 }}>
          <Row><Ionicons name="analytics-outline" size={18} color={p.accent} /><Txt variant="bodyStrong">Analysing with Stockfish… {Math.round(progress * 100)}%</Txt></Row>
          <ProgressBar value={progress} />
        </Card>
      )}
      {error && <Card style={{ gap: 8 }}><Txt color={p.danger}>{error}</Txt><Button title="Try again" variant="secondary" onPress={run} /></Card>}
      {!analysis && progress === null && !error && history.length === 0 && <Txt muted>No moves were played in this game.</Txt>}

      {am && (
        <Card style={{ gap: 8, borderLeftWidth: 3, borderLeftColor: CLASS_COLORS(p)[am.classification] }}>
          <Row>
            <Txt variant="h2" style={{ flex: 1 }}>{Math.ceil(ply / 2)}{am.color === 'w' ? '.' : '...'} {am.san}</Txt>
            <Chip label={CLASS_LABEL[am.classification]} tone={['best', 'excellent'].includes(am.classification) ? 'success' : ['mistake', 'blunder'].includes(am.classification) ? 'danger' : 'neutral'} />
            <Txt variant="number" muted style={{ fontSize: 13 }}>{formatEval(am.evalAfter)}</Txt>
          </Row>
          <Txt style={{ lineHeight: 21 }}>{am.explanation}</Txt>
        </Card>
      )}

      {analysis && (
        <>
          <Card style={{ gap: 10 }}>
            <Txt variant="label" muted>Evaluation</Txt>
            <EvalGraph data={[analysis.startEvalWhite, ...analysis.moves.map((m) => m.evalAfterWhite)]} width={width - 64} current={ply} onSelect={setPly} />
          </Card>
          <Card style={{ gap: 10 }}>
            <Row>
              <View style={{ flex: 1, alignItems: 'center' }}><Txt variant="numberLg">{analysis.accuracy.w}%</Txt><Txt variant="caption" muted>{whiteName} accuracy</Txt></View>
              <View style={{ flex: 1, alignItems: 'center' }}><Txt variant="numberLg">{analysis.accuracy.b}%</Txt><Txt variant="caption" muted>{blackName} accuracy</Txt></View>
            </Row>
            {(['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'] as Classification[]).map((c) => (
              <Row key={c}>
                <Txt variant="number" style={{ width: 40, textAlign: 'center' }}>{analysis.counts.w[c] ?? 0}</Txt>
                <Row gap={6} style={{ flex: 1, justifyContent: 'center' }}>
                  <Txt style={{ color: CLASS_COLORS(p)[c], fontFamily: fonts.bold }}>{CLASS_SYMBOL[c]}</Txt>
                  <Txt variant="caption" muted>{CLASS_LABEL[c]}</Txt>
                </Row>
                <Txt variant="number" style={{ width: 40, textAlign: 'center' }}>{analysis.counts.b[c] ?? 0}</Txt>
              </Row>
            ))}
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              <Txt variant="caption" muted>Jump to:</Txt>
              {analysis.moves.map((m, i) => ({ m, i })).filter(({ m }) => ['blunder', 'mistake'].includes(m.classification) && (record.playerColor === null || m.color === record.playerColor)).slice(0, 6).map(({ m, i }) => (
                <Pressable key={i} onPress={() => setPly(i + 1)}><Chip label={`${Math.ceil((i + 1) / 2)}. ${m.san}${CLASS_SYMBOL[m.classification]}`} tone="danger" /></Pressable>
              ))}
            </Row>
          </Card>
        </>
      )}
    </Screen>
  );
}

function markFor(c?: Classification): string {
  if (!c) return '';
  if (c === 'blunder') return '??';
  if (c === 'mistake') return '?';
  if (c === 'inaccuracy') return '?!';
  return '';
}

function EvalBar({ cp, height, flip }: { cp: number; height: number; flip: boolean }) {
  const p = usePalette();
  const w = 1 / (1 + Math.exp(-0.004 * cp)); // white share
  const whiteH = height * w;
  return (
    <View style={{ width: 14, height, borderRadius: 4, overflow: 'hidden', backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: p.border, justifyContent: flip ? 'flex-start' : 'flex-end' }}>
      <View style={{ height: whiteH, backgroundColor: '#EDEAE3' }} />
    </View>
  );
}

function EvalGraph({ data, width, current, onSelect }: { data: number[]; width: number; current: number; onSelect: (i: number) => void }) {
  const p = usePalette();
  const h = 110;
  const x = (i: number) => (i / Math.max(1, data.length - 1)) * width;
  const y = (v: number) => h / 2 - (Math.max(-800, Math.min(800, v)) / 800) * (h / 2 - 4);
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${width},${h} L0,${h} Z`;
  return (
    <Pressable onPress={(e) => onSelect(Math.round((e.nativeEvent.locationX / width) * (data.length - 1)))}>
      <Svg width={width} height={h}>
        <Rect x={0} y={0} width={width} height={h} fill="#26272B" rx={6} />
        <Path d={area} fill="#EDEAE3" />
        <Line x1={0} x2={width} y1={h / 2} y2={h / 2} stroke="rgba(128,128,128,0.6)" strokeWidth={1} />
        <Line x1={x(current)} x2={x(current)} y1={0} y2={h} stroke={p.accent} strokeWidth={2} />
      </Svg>
    </Pressable>
  );
}
