import type { PieceSymbol } from '@/chess/types';

/**
 * Original piece designs, defined once as lathe profiles (radius, height in
 * square units) plus a few extra parts. The 3D renderer revolves these into
 * meshes; the 2D renderer mirrors them into silhouettes — so both modes show
 * the same set.
 */
export type Pt = [number, number];

export interface PieceDesign {
  profile: Pt[];
  /** Small spheres: [radius, y, ringRadius, count] (count 1 => centred). */
  balls?: [number, number, number, number][];
  /** Boxes: [w, h, d, x, y, z] */
  boxes?: [number, number, number, number, number, number][];
  /** Rook battlements: [count, ringRadius, y, w, h, d] */
  merlons?: [number, number, number, number, number, number];
  /** Knight head outline in (x, y), muzzle pointing to -x. */
  head?: Pt[];
  headDepth?: number;
  /** Which extra parts use the accent material. */
  accentParts?: ('balls' | 'boxes' | 'merlons')[];
  slit?: [Pt, Pt];
}

export interface PieceSetDef {
  id: string;
  name: string;
  designs: Record<PieceSymbol, PieceDesign>;
  light: { top: string; bottom: string; stroke: string; detail: string };
  dark: { top: string; bottom: string; stroke: string; detail: string };
  accent?: string;
  material: { light: Mat; dark: Mat; accent?: Mat };
}

export interface Mat { color: string; roughness: number; metalness: number; clearcoat?: number; sheen?: number }

const arc = (cx: number, cy: number, r: number, from: number, to: number, n = 8): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    out.push([Math.max(0, cx + r * Math.cos(a)), cy + r * Math.sin(a)]);
  }
  return out;
};

const BASE: Pt[] = [[0, 0], [0.37, 0], [0.378, 0.025], [0.36, 0.055], [0.335, 0.07], [0.335, 0.095], [0.3, 0.12], [0.26, 0.15]];

const KNIGHT_HEAD: Pt[] = [
  [0.21, 0.2], [-0.19, 0.2], [-0.17, 0.29], [-0.11, 0.37], [-0.1, 0.44], [-0.2, 0.49], [-0.3, 0.52], [-0.335, 0.575],
  [-0.31, 0.625], [-0.2, 0.66], [-0.13, 0.735], [-0.07, 0.79], [-0.02, 0.81], [0.02, 0.865], [0.06, 0.8], [0.12, 0.76],
  [0.18, 0.69], [0.225, 0.56], [0.235, 0.42], [0.23, 0.3],
];

function staunton(): Record<PieceSymbol, PieceDesign> {
  return {
    p: { profile: [...BASE, [0.22, 0.18], [0.155, 0.215], [0.125, 0.3], [0.115, 0.355], [0.175, 0.375], [0.175, 0.4], [0.105, 0.42], ...arc(0, 0.52, 0.125, -58, 90, 10)] },
    r: {
      profile: [...BASE, [0.245, 0.2], [0.225, 0.24], [0.205, 0.44], [0.215, 0.49], [0.265, 0.525], [0.275, 0.555], [0.258, 0.575], [0.258, 0.67], [0.19, 0.67], [0.19, 0.63], [0, 0.63]],
      merlons: [6, 0.224, 0.705, 0.075, 0.075, 0.11],
    },
    n: { profile: [...BASE, [0.25, 0.18], [0.24, 0.2], [0, 0.2]], head: KNIGHT_HEAD, headDepth: 0.2 },
    b: {
      profile: [...BASE, [0.205, 0.19], [0.14, 0.23], [0.112, 0.38], [0.1, 0.48], [0.172, 0.5], [0.172, 0.525], [0.1, 0.548], [0.125, 0.58], [0.152, 0.64], [0.155, 0.7], [0.135, 0.765], [0.095, 0.815], [0.045, 0.85], [0, 0.86]],
      balls: [[0.048, 0.9, 0, 1]],
      slit: [[0.14, 0.73], [0.02, 0.62]],
    },
    q: {
      profile: [...BASE, [0.225, 0.2], [0.162, 0.25], [0.125, 0.45], [0.112, 0.6], [0.192, 0.625], [0.192, 0.655], [0.112, 0.68], [0.13, 0.72], [0.17, 0.8], [0.218, 0.88], [0.2, 0.902], [0.135, 0.9], [0.13, 0.925], [0.1, 0.965], [0.05, 0.99], [0, 0.995]],
      balls: [[0.034, 0.905, 0.205, 9], [0.052, 1.04, 0, 1]],
    },
    k: {
      profile: [...BASE, [0.228, 0.2], [0.165, 0.25], [0.128, 0.46], [0.115, 0.62], [0.196, 0.645], [0.196, 0.675], [0.115, 0.7], [0.142, 0.74], [0.18, 0.87], [0.192, 0.905], [0.155, 0.925], [0.125, 0.96], [0.08, 0.99], [0, 1.0]],
      boxes: [[0.052, 0.21, 0.052, 0, 1.1, 0], [0.16, 0.052, 0.052, 0, 1.13, 0]],
    },
  };
}

function scaleDesign(d: PieceDesign, sx: number, sy: number): PieceDesign {
  return {
    ...d,
    profile: d.profile.map(([r, y]) => [r * sx, y * sy] as Pt),
    balls: d.balls?.map(([r, y, rr, n]) => [r * sx, y * sy, rr * sx, n]),
    boxes: d.boxes?.map(([w, h, dd, x, y, z]) => [w * sx, h * sy, dd * sx, x, y * sy, z]),
    merlons: d.merlons ? [d.merlons[0], d.merlons[1] * sx, d.merlons[2] * sy, d.merlons[3] * sx, d.merlons[4] * sy, d.merlons[5] * sx] : undefined,
    head: d.head?.map(([x, y]) => [x * sx, y * sy] as Pt),
    slit: d.slit?.map(([x, y]) => [x * sx, y * sy] as Pt) as [Pt, Pt] | undefined,
  };
}

function regal(): Record<PieceSymbol, PieceDesign> {
  const s = staunton();
  const out = {} as Record<PieceSymbol, PieceDesign>;
  (Object.keys(s) as PieceSymbol[]).forEach((k) => {
    out[k] = scaleDesign(s[k], 0.94, 1.08);
  });
  out.q.accentParts = ['balls'];
  out.k.accentParts = ['boxes'];
  out.b.accentParts = ['balls'];
  out.r.accentParts = ['merlons'];
  return out;
}

function modern(): Record<PieceSymbol, PieceDesign> {
  const base: Pt[] = [[0, 0], [0.34, 0], [0.34, 0.07], [0.27, 0.09]];
  return {
    p: { profile: [...base, [0.2, 0.12], [0.11, 0.38], ...arc(0, 0.48, 0.12, -66, 90, 10)] },
    r: { profile: [...base, [0.23, 0.12], [0.23, 0.6], [0.27, 0.62], [0.27, 0.7], [0, 0.7]] },
    n: { profile: [...base, [0.24, 0.12], [0.24, 0.18], [0, 0.18]], head: [
      [0.2, 0.18], [-0.18, 0.18], [-0.12, 0.42], [-0.32, 0.5], [-0.32, 0.62], [-0.1, 0.7], [0.0, 0.84], [0.08, 0.76], [0.2, 0.6], [0.22, 0.4],
    ], headDepth: 0.2 },
    b: { profile: [...base, [0.2, 0.12], [0.12, 0.5], [0.16, 0.56], [0.16, 0.6], [0.11, 0.7], [0.05, 0.8], [0, 0.82]], balls: [[0.04, 0.86, 0, 1]] },
    q: { profile: [...base, [0.22, 0.12], [0.13, 0.62], [0.2, 0.86], [0.17, 0.9], [0, 0.9]], balls: [[0.05, 0.96, 0, 1]] },
    k: { profile: [...base, [0.23, 0.12], [0.14, 0.66], [0.2, 0.9], [0.2, 0.95], [0, 0.95]], boxes: [[0.05, 0.2, 0.05, 0, 1.05, 0], [0.15, 0.05, 0.05, 0, 1.06, 0]] },
  };
}

export const PIECE_SETS: PieceSetDef[] = [
  {
    id: 'staunton', name: 'Staunton', designs: staunton(),
    light: { top: '#F7ECD6', bottom: '#C9A97A', stroke: '#3A2C1C', detail: 'rgba(58,44,28,0.45)' },
    dark: { top: '#5A4A3F', bottom: '#15100D', stroke: '#0A0706', detail: 'rgba(255,240,220,0.22)' },
    material: {
      light: { color: '#D9C29A', roughness: 0.45, metalness: 0, clearcoat: 0.5 },
      dark: { color: '#2A1E18', roughness: 0.38, metalness: 0, clearcoat: 0.7 },
    },
  },
  {
    id: 'regal', name: 'Regal', designs: regal(), accent: '#D1A956',
    light: { top: '#FFFDF8', bottom: '#D5CEC0', stroke: '#2E2A22', detail: 'rgba(46,42,34,0.4)' },
    dark: { top: '#3E434D', bottom: '#07080A', stroke: '#000000', detail: 'rgba(255,255,255,0.2)' },
    material: {
      light: { color: '#E4DED2', roughness: 0.28, metalness: 0, clearcoat: 1 },
      dark: { color: '#14161A', roughness: 0.2, metalness: 0.1, clearcoat: 1 },
      accent: { color: '#C99E4C', roughness: 0.28, metalness: 1 },
    },
  },
  {
    id: 'modern', name: 'Modern', designs: modern(),
    light: { top: '#F8F8F5', bottom: '#D7D7D1', stroke: '#2B2C2E', detail: 'rgba(43,44,46,0.35)' },
    dark: { top: '#5F636B', bottom: '#26282C', stroke: '#0E0F11', detail: 'rgba(255,255,255,0.18)' },
    material: {
      light: { color: '#DCDCD6', roughness: 0.6, metalness: 0 },
      dark: { color: '#3A3D43', roughness: 0.55, metalness: 0.15 },
    },
  },
];

export function getPieceSet(id: string): PieceSetDef {
  return PIECE_SETS.find((s) => s.id === id) ?? PIECE_SETS[0];
}

/* ------------------------- 2D silhouette builder ------------------------- */

const SX = 92;
const SY = 72;
const toSvg = (r: number, y: number): [number, number] => [50 + r * SX, 96 - y * SY];

export interface Silhouette {
  body: string;
  extras: { circles: [number, number, number, boolean][]; rects: [number, number, number, number, boolean][] };
  details: string;
}

const cache = new Map<string, Silhouette>();

export function silhouette(setId: string, type: PieceSymbol): Silhouette {
  const key = setId + type;
  const hit = cache.get(key);
  if (hit) return hit;
  const set = getPieceSet(setId);
  const d = set.designs[type];
  const accent = new Set(d.accentParts ?? []);
  const pts = d.profile;
  const right = pts.map(([r, y]) => toSvg(r, y));
  const left = [...pts].reverse().map(([r, y]) => toSvg(-r, y));
  let body = 'M' + [...left, ...right].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L') + ' Z';
  const circles: Silhouette['extras']['circles'] = [];
  const rects: Silhouette['extras']['rects'] = [];
  let details = '';
  if (d.head) {
    body += ' M' + d.head.map(([x, y]) => toSvg(x, y)).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L') + ' Z';
    // eye and nostril
    const [ex, ey] = toSvg(-0.12, 0.68);
    circles.push([ex, ey, 2.4, false]);
    const [mx1, my1] = toSvg(-0.08, 0.45);
    const [mx2, my2] = toSvg(0.1, 0.7);
    details += `M${mx1},${my1} Q${(mx1 + mx2) / 2 + 6},${(my1 + my2) / 2} ${mx2},${my2}`;
  }
  d.balls?.forEach(([r, y, ring, n]) => {
    if (n === 1) {
      const [x, yy] = toSvg(0, y);
      circles.push([x, yy, r * SX, accent.has('balls')]);
    } else {
      // Front-facing projection of the coronet: 5 visible balls.
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * (i / 4);
        const [x, yy] = toSvg(Math.cos(a) * ring, y + Math.sin(a) * 0.012);
        circles.push([x, yy, r * SX * 1.05, accent.has('balls')]);
      }
    }
  });
  d.boxes?.forEach(([w, h, , x, y]) => {
    const [cx, cy] = toSvg(x, y);
    rects.push([cx - (w * SX) / 2, cy - (h * SY) / 2, w * SX, h * SY, accent.has('boxes')]);
  });
  if (d.merlons) {
    const [, ring, y, w, h] = d.merlons;
    for (const fx of [-1, 0, 1]) {
      const [cx, top] = toSvg(fx * ring * 0.95, y + h / 2);
      const [, bottom] = toSvg(0, y - h / 2 - 0.03);
      rects.push([cx - (w * SX * 1.15) / 2, top, w * SX * 1.15, bottom - top, accent.has('merlons')]);
    }
  }
  if (d.slit) {
    const [a, b] = d.slit.map(([x, y]) => toSvg(x, y));
    details += ` M${a[0]},${a[1]} L${b[0]},${b[1]}`;
  }
  // collar lines: horizontal rings where the profile has a flat ledge
  for (let i = 1; i < pts.length; i++) {
    const [r0, y0] = pts[i - 1];
    const [r1, y1] = pts[i];
    if (Math.abs(y1 - y0) < 0.004 && r0 > 0.12 && r1 > 0.12 && y0 > 0.1) {
      const [x0, yy] = toSvg(-Math.min(r0, r1) * 0.96, y0);
      const [x1] = toSvg(Math.min(r0, r1) * 0.96, y0);
      details += ` M${x0},${yy} L${x1},${yy}`;
    }
  }
  const s: Silhouette = { body, extras: { circles, rects }, details };
  cache.set(key, s);
  return s;
}
