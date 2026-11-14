import * as THREE from 'three';
import type { BoardTheme, SurfaceKind } from '@/board/boardThemes';

/**
 * Procedural material textures (no image assets needed). Generated once per
 * theme and quality, then cached. Kept small and power-of-two for mobile GPUs.
 */

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, oct = 4): number {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise(x * f, y * f); f *= 2; a *= 0.5; }
  return s;
}

function hex(c: string): [number, number, number] {
  const n = parseInt(c.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Returns a brightness multiplier (≈0.75..1.2) for a surface kind at (x, y) in pixel space. */
function pattern(kind: SurfaceKind, x: number, y: number, seed: number, scale: number, vertical: boolean): number {
  const sx = (vertical ? y : x) * scale, sy = (vertical ? x : y) * scale;
  switch (kind) {
    case 'wood': {
      const warp = fbm(sx * 0.02 + seed, sy * 0.25 + seed * 3, 3) * 6;
      const rings = Math.sin(sy * 0.9 + warp * 2.2 + seed * 7);
      const fine = fbm(sx * 0.05, sy * 3, 2);
      return 0.9 + rings * 0.07 + (fine - 0.5) * 0.12;
    }
    case 'marble': {
      const t = fbm(sx * 0.035 + seed, sy * 0.035 - seed, 5);
      const vein = Math.abs(Math.sin((sx + sy) * 0.05 + t * 9));
      const v = Math.pow(vein, 0.18);
      return 0.78 + v * 0.27 + (fbm(sx * 0.2, sy * 0.2, 2) - 0.5) * 0.06;
    }
    case 'stone': {
      const n = fbm(sx * 0.08 + seed, sy * 0.08, 4);
      const speck = hash(Math.floor(sx * 1.3), Math.floor(sy * 1.3)) > 0.985 ? 1.18 : 1;
      return (0.88 + (n - 0.5) * 0.28) * speck;
    }
    case 'lacquer':
    default:
      return 0.97 + (fbm(sx * 0.03 + seed, sy * 0.03, 3) - 0.5) * 0.08;
  }
}

const cache = new Map<string, THREE.DataTexture>();

function finish(data: Uint8Array, size: number, key: string, transparent = false): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.premultiplyAlpha = false;
  if (transparent) tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

/** 8×8 squares texture; row 0 = rank 1, column 0 = file a. */
export function squaresTexture(theme: BoardTheme, size: number): THREE.DataTexture {
  const key = `sq-${theme.id}-${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const data = new Uint8Array(size * size * 4);
  const light = hex(theme.light), dark = hex(theme.dark);
  const cell = size / 8;
  const scale = 512 / size;
  for (let y = 0; y < size; y++) {
    const rank = Math.floor(y / cell);
    for (let x = 0; x < size; x++) {
      const file = Math.floor(x / cell);
      const isLight = (file + rank) % 2 === 1;
      const base = isLight ? light : dark;
      const seed = file * 13.7 + rank * 7.1;
      let m = pattern(theme.surface, x, y, seed, scale, (file + rank) % 2 === 0);
      // subtle bevel at square edges
      const ex = Math.min(x % cell, cell - 1 - (x % cell));
      const ey = Math.min(y % cell, cell - 1 - (y % cell));
      const e = Math.min(ex, ey);
      if (e < 1) m *= 0.86;
      else if (e < 2) m *= 0.95;
      const i = (y * size + x) * 4;
      data[i] = Math.min(255, base[0] * m);
      data[i + 1] = Math.min(255, base[1] * m);
      data[i + 2] = Math.min(255, base[2] * m);
      data[i + 3] = 255;
    }
  }
  return finish(data, size, key);
}

export function frameTexture(theme: BoardTheme, size: number): THREE.DataTexture {
  const key = `fr-${theme.id}-${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const data = new Uint8Array(size * size * 4);
  const a = hex(theme.frame), b = hex(theme.frameDark);
  const scale = 512 / size;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const m = pattern(theme.frameSurface, x * 1.4, y * 1.4, 3.3, scale, false);
      const t = Math.max(0, Math.min(1, (m - 0.75) * 2));
      const i = (y * size + x) * 4;
      data[i] = b[0] + (a[0] - b[0]) * t;
      data[i + 1] = b[1] + (a[1] - b[1]) * t;
      data[i + 2] = b[2] + (a[2] - b[2]) * t;
      data[i + 3] = 255;
    }
  return finish(data, size, key);
}

/* Tiny 5×7 bitmap font for board coordinates. */
const GLYPHS: Record<string, string[]> = {
  a: ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
  b: ['10000', '10000', '11110', '10001', '10001', '10001', '11110'],
  c: ['00000', '00000', '01110', '10000', '10000', '10001', '01110'],
  d: ['00001', '00001', '01111', '10001', '10001', '10001', '01111'],
  e: ['00000', '00000', '01110', '10001', '11111', '10000', '01110'],
  f: ['00110', '01001', '01000', '11100', '01000', '01000', '01000'],
  g: ['00000', '01111', '10001', '10001', '01111', '00001', '01110'],
  h: ['10000', '10000', '10110', '11001', '10001', '10001', '10001'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
};

/**
 * Transparent overlay with coordinates in the frame margin, upright for the
 * viewer's side. Covers the full frame top (span units wide).
 */
export function coordTexture(theme: BoardTheme, span: number, flip: boolean, size = 512): THREE.DataTexture {
  const key = `co-${theme.id}-${flip}-${size}-${span}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const data = new Uint8Array(size * size * 4);
  const col = hex(theme.coord);
  const ppu = size / span; // pixels per board unit
  const px = Math.max(1, Math.round(ppu * 0.035));
  const margin = (span - 8) / 2;
  const stamp = (ch: string, cx: number, cy: number) => {
    const g = GLYPHS[ch];
    const w = 5 * px, h = 7 * px;
    for (let gy = 0; gy < 7; gy++)
      for (let gx = 0; gx < 5; gx++) {
        if (g[gy][gx] !== '1') continue;
        for (let oy = 0; oy < px; oy++)
          for (let ox = 0; ox < px; ox++) {
            // glyph row 0 is the top of the letter; "top" points away from the viewer
            let lx = gx * px + ox - w / 2;
            let ly = h / 2 - (gy * px + oy);
            if (flip) { lx = -lx; ly = -ly; }
            const x = Math.round(cx + lx), y = Math.round(cy + ly);
            if (x < 0 || y < 0 || x >= size || y >= size) continue;
            const i = (y * size + x) * 4;
            data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2]; data[i + 3] = 215;
          }
      }
  };
  const files = 'abcdefgh';
  for (let f = 0; f < 8; f++) {
    const x = (margin + f + 0.5) * ppu;
    stamp(files[f], x, flip ? size - (margin / 2) * ppu : (margin / 2) * ppu);
  }
  for (let r = 0; r < 8; r++) {
    const y = (margin + r + 0.5) * ppu;
    stamp(String(r + 1), flip ? size - (margin / 2) * ppu : (margin / 2) * ppu, y);
  }
  return finish(data, size, key, true);
}

/** Soft round contact shadow (alpha falls off from the centre). */
export function blobTexture(): THREE.DataTexture {
  const key = 'blob';
  const hit = cache.get(key);
  if (hit) return hit;
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
      const a = Math.max(0, 1 - d);
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
      data[i + 3] = Math.round(255 * Math.pow(a, 1.8) * 0.85);
    }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

/** Fine turned-wood grain used as a bump/roughness map on wooden pieces. */
export function grainTexture(): THREE.DataTexture {
  const key = 'grain';
  const hit = cache.get(key);
  if (hit) return hit;
  const w = 128, h = 256;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const g = fbm(x * 0.6, y * 0.02, 3) * 0.6 + Math.sin(x * 0.9 + fbm(x * 0.1, y * 0.05, 2) * 6) * 0.2 + 0.4;
      const v = Math.max(0, Math.min(255, g * 255));
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

/** Vertical backdrop gradient so the board sits in a lit room instead of a flat void. */
export function backdropTexture(top: string, bottom: string): THREE.DataTexture {
  const key = `bd-${top}-${bottom}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const n = 256;
  const a = hex(top), b = hex(bottom);
  const data = new Uint8Array(n * 4);
  for (let y = 0; y < n; y++) {
    const t = Math.pow(y / (n - 1), 1.4); // row 0 = bottom of the screen
    const i = y * 4;
    data[i] = b[0] + (a[0] - b[0]) * t;
    data[i + 1] = b[1] + (a[1] - b[1]) * t;
    data[i + 2] = b[2] + (a[2] - b[2]) * t;
    data[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, 1, n, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}
