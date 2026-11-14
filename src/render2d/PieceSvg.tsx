import React, { memo, useId } from 'react';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { Color, PieceSymbol } from '@/chess/types';
import { getPieceSet, silhouette } from '@/board/pieceDesign';

function PieceSvgImpl({ type, color, setId, size }: { type: PieceSymbol; color: Color; setId: string; size: number }) {
  const set = getPieceSet(setId);
  const c = color === 'w' ? set.light : set.dark;
  const s = silhouette(setId, type);
  // Unique per instance: on web all SVGs share one DOM id namespace.
  const gid = `pg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const fill = `url(#${gid})`;
  const accent = set.accent;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={c.top} />
          <Stop offset="1" stopColor={c.bottom} />
        </LinearGradient>
      </Defs>
      <Ellipse cx={50} cy={95} rx={27} ry={3.6} fill="#000" opacity={0.28} />
      <Path d={s.body} fill={fill} stroke={c.stroke} strokeWidth={2.2} strokeLinejoin="round" />
      {s.extras.rects.map(([x, y, w, h, a], i) => (
        <Rect key={`r${i}`} x={x} y={y} width={w} height={h} rx={1} fill={a && accent ? accent : fill} stroke={c.stroke} strokeWidth={2} />
      ))}
      {s.extras.circles.map(([x, y, r, a], i) => {
        const eye = type === 'n' && i === 0;
        return <Circle key={`c${i}`} cx={x} cy={y} r={r} fill={eye ? c.stroke : a && accent ? accent : fill} stroke={c.stroke} strokeWidth={eye ? 0 : 2} />;
      })}
      {!!s.details && <Path d={s.details} stroke={c.detail} strokeWidth={1.6} fill="none" strokeLinecap="round" />}
    </Svg>
  );
}

export const PieceSvg = memo(PieceSvgImpl);
