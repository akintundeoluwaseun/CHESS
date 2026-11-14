import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PieceSymbol } from '@/chess/types';
import { getPieceSet } from '@/board/pieceDesign';

export interface PieceGeometry {
  main: THREE.BufferGeometry;
  accent?: THREE.BufferGeometry;
}

const cache = new Map<string, PieceGeometry>();

function prep(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  // keep only the attributes every part has
  for (const name of Object.keys(ng.attributes)) if (!['position', 'normal', 'uv'].includes(name)) ng.deleteAttribute(name);
  return ng;
}

/** Revolved / extruded geometry for one piece type of a set, cached. */
export function pieceGeometry(setId: string, type: PieceSymbol, detail: 'low' | 'high'): PieceGeometry {
  const key = `${setId}-${type}-${detail}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const d = getPieceSet(setId).designs[type];
  const seg = detail === 'high' ? 40 : 22;
  const accent = new Set(d.accentParts ?? []);
  const main: THREE.BufferGeometry[] = [];
  const acc: THREE.BufferGeometry[] = [];

  const lathe = new THREE.LatheGeometry(d.profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y)), seg);
  lathe.computeVertexNormals();
  main.push(prep(lathe));

  d.balls?.forEach(([r, y, ring, n]) => {
    for (let i = 0; i < n; i++) {
      const s = new THREE.SphereGeometry(r, detail === 'high' ? 16 : 10, detail === 'high' ? 12 : 8);
      const a = (i / n) * Math.PI * 2;
      s.translate(Math.cos(a) * ring, y, Math.sin(a) * ring);
      (accent.has('balls') ? acc : main).push(prep(s));
    }
  });
  d.boxes?.forEach(([w, h, dd, x, y, z]) => {
    const b = new THREE.BoxGeometry(w, h, dd);
    b.translate(x, y, z);
    (accent.has('boxes') ? acc : main).push(prep(b));
  });
  if (d.merlons) {
    const [n, ring, y, w, h, dd] = d.merlons;
    for (let i = 0; i < n; i++) {
      const b = new THREE.BoxGeometry(w, h, dd);
      const a = (i / n) * Math.PI * 2;
      b.rotateY(-a);
      b.translate(Math.cos(a) * ring, y, Math.sin(a) * ring);
      (accent.has('merlons') ? acc : main).push(prep(b));
    }
  }
  if (d.head) {
    const shape = new THREE.Shape(d.head.map(([x, y]) => new THREE.Vector2(x, y)));
    const depth = d.headDepth ?? 0.2;
    const ex = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: detail === 'high' ? 3 : 1, curveSegments: 4,
    });
    ex.translate(0, 0, -depth / 2);
    ex.computeVertexNormals();
    main.push(prep(ex));
  }

  const out: PieceGeometry = { main: mergeGeometries(main) ?? lathe };
  if (acc.length) out.accent = mergeGeometries(acc) ?? undefined;
  out.main.computeBoundingSphere();
  cache.set(key, out);
  return out;
}
