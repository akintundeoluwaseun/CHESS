import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { PixelRatio, View } from 'react-native';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { BoardProps } from '@/board/types';
import type { Color, Square } from '@/chess/types';
import { coordsToSquare, squareToCoords } from '@/chess/types';
import type { TrackedPiece } from '@/chess/pieceIds';
import { BoardTheme, getBoardTheme } from '@/board/boardThemes';
import { getPieceSet, Mat } from '@/board/pieceDesign';
import { useSettings, Quality, CameraView } from '@/data/settings';
import { backdropTexture, blobTexture, coordTexture, frameTexture, grainTexture, squaresTexture } from './textures';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { pieceGeometry } from './geometry';

const FRAME = 8.9;
const sqPos = (sq: Square): [number, number] => {
  const { file, rank } = squareToCoords(sq);
  return [file - 3.5, 3.5 - rank];
};

/* ------------------------------- materials ------------------------------ */

const matCache = new Map<string, THREE.Material>();
function material(m: Mat, quality: Quality, key: string, grain = false): THREE.Material {
  const k = `${key}-${quality}-${grain}`;
  const hit = matCache.get(k);
  if (hit) return hit;
  let mat: THREE.Material;
  // Subtle turned-wood grain breaks up the "plastic CG" look on wooden sets.
  const g = grain ? grainTexture() : null;
  if (quality === 'high') {
    mat = new THREE.MeshPhysicalMaterial({ color: m.color, roughness: m.roughness, metalness: m.metalness, clearcoat: m.clearcoat ?? 0, clearcoatRoughness: 0.18,
      sheen: 0.2, sheenRoughness: 0.6, ...(g ? { bumpMap: g, bumpScale: 0.6, roughnessMap: g } : {}) });
  } else if (quality === 'balanced') {
    mat = new THREE.MeshStandardMaterial({ color: m.color, roughness: m.roughness, metalness: m.metalness, ...(g ? { bumpMap: g, bumpScale: 0.5 } : {}) });
  } else {
    mat = new THREE.MeshLambertMaterial({ color: m.color });
  }
  matCache.set(k, mat);
  return mat;
}

/* --------------------------------- pieces ------------------------------- */

interface PieceAnim { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; arc: number }

function Piece3D({ piece, setId, quality, duration, lifted, onPick }: { piece: TrackedPiece; setId: string; quality: Quality; duration: number; lifted: boolean; onPick?: (sq: Square) => void }) {
  const ref = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const set = getPieceSet(setId);
  const geo = pieceGeometry(setId, piece.type, quality === 'low' ? 'low' : 'high');
  const mat = material(piece.color === 'w' ? set.material.light : set.material.dark, quality, `${setId}-${piece.color}`, setId === 'staunton');
  const accentMat = set.material.accent ? material(set.material.accent, quality, `${setId}-acc`) : mat;
  const [x, z] = sqPos(piece.square);
  const anim = useRef<PieceAnim | null>(null);
  const first = useRef(true);
  const liftY = lifted ? 0.18 : 0;

  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    const to = new THREE.Vector3(x, liftY, z);
    if (first.current || duration <= 0) {
      g.position.copy(to);
      first.current = false;
      invalidate();
      return;
    }
    const dist = g.position.distanceTo(to);
    anim.current = { from: g.position.clone(), to, t: 0, dur: Math.max(0.08, (duration / 1000) * (0.75 + Math.min(1, dist / 4) * 0.5)), arc: piece.type === 'n' && dist > 1 ? 0.55 : dist > 0.5 ? 0.08 : 0 };
    invalidate();
  }, [x, z, liftY, duration]);

  useFrame((_, delta) => {
    const a = anim.current;
    const g = ref.current;
    if (!a || !g) return;
    a.t = Math.min(1, a.t + delta / a.dur);
    const e = 1 - Math.pow(1 - a.t, 3);
    g.position.lerpVectors(a.from, a.to, e);
    g.position.y += Math.sin(Math.PI * e) * a.arc;
    if (a.t >= 1) anim.current = null;
    else invalidate();
  });

  // Knights face the opponent's side, turned slightly toward the viewer.
  const rotY = piece.type === 'n' ? (piece.color === 'w' ? -0.5 : Math.PI - 0.5) : 0;
  return (
    <group ref={ref} onClick={onPick ? (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPick(piece.square); } : undefined}>
      <mesh geometry={blobGeo} material={blobMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008 - liftY, 0]} renderOrder={1} />
      <group rotation={[0, rotY, 0]}>
        <mesh geometry={geo.main} material={mat} castShadow={quality !== 'low'} receiveShadow={quality === 'high'} />
        {geo.accent && <mesh geometry={geo.accent} material={accentMat} castShadow={quality !== 'low'} />}
      </group>
    </group>
  );
}

function CapturedPiece({ piece, setId, quality, duration }: { piece: TrackedPiece; setId: string; quality: Quality; duration: number }) {
  const ref = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const t = useRef(0);
  const set = getPieceSet(setId);
  const geo = pieceGeometry(setId, piece.type, quality === 'low' ? 'low' : 'high');
  const base = material(piece.color === 'w' ? set.material.light : set.material.dark, quality, `${setId}-${piece.color}`);
  const mat = useMemo(() => { const m = base.clone(); m.transparent = true; return m; }, [base]);
  const [x, z] = sqPos(piece.square);
  useEffect(() => { invalidate(); return () => mat.dispose(); }, []);
  useFrame((_, d) => {
    const g = ref.current;
    if (!g || t.current >= 1) return;
    t.current = Math.min(1, t.current + d / Math.max(0.15, (duration / 1000) * 1.6));
    const e = t.current;
    g.scale.setScalar(1 - e * 0.5);
    g.position.y = -e * 0.4;
    (mat as THREE.MeshStandardMaterial).opacity = 1 - e;
    g.visible = e < 1;
    if (e < 1) invalidate();
  });
  return (
    <group ref={ref} position={[x, 0, z]}>
      <mesh geometry={geo.main} material={mat} />
    </group>
  );
}

/* ------------------------------ board + marks ---------------------------- */

function BoardMesh({ theme, quality, flip, showCoords }: { theme: BoardTheme; quality: Quality; flip: boolean; showCoords: boolean }) {
  const size = quality === 'low' ? 256 : 512;
  const sq = useMemo(() => squaresTexture(theme, size), [theme, size]);
  const fr = useMemo(() => frameTexture(theme, quality === 'low' ? 128 : 256), [theme, quality]);
  const co = useMemo(() => coordTexture(theme, FRAME, flip, 512), [theme, flip]);
  const sqMat = useMemo(() => quality === 'high'
    ? new THREE.MeshPhysicalMaterial({ map: sq, roughness: theme.roughness, clearcoat: theme.clearcoat, clearcoatRoughness: 0.2 })
    : quality === 'balanced' ? new THREE.MeshStandardMaterial({ map: sq, roughness: theme.roughness })
      : new THREE.MeshLambertMaterial({ map: sq }), [sq, quality, theme]);
  const frMat = useMemo(() => quality === 'low' ? new THREE.MeshLambertMaterial({ map: fr })
    : quality === 'high' ? new THREE.MeshPhysicalMaterial({ map: fr, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.3 })
      : new THREE.MeshStandardMaterial({ map: fr, roughness: 0.5 }), [fr, quality]);
  const frameGeo = useMemo(() => new RoundedBoxGeometry(FRAME, 0.42, FRAME, 3, 0.12), []);
  const inlayMat = useMemo(() => new THREE.MeshStandardMaterial({ color: theme.inlay ?? '#B8924E', roughness: 0.3, metalness: quality === 'low' ? 0 : 0.85 }), [theme, quality]);
  return (
    <group>
      <mesh position={[0, -0.21, 0]} geometry={frameGeo} material={frMat} receiveShadow castShadow={quality !== 'low'} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} material={inlayMat}>
        <planeGeometry args={[8.14, 8.14]} />
      </mesh>
      {showCoords && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
          <planeGeometry args={[FRAME, FRAME]} />
          <meshBasicMaterial map={co} transparent depthWrite={false} />
        </mesh>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} material={sqMat} receiveShadow>
        <planeGeometry args={[8, 8]} />
      </mesh>
    </group>
  );
}

const planeGeo = new THREE.PlaneGeometry(1, 1);
const blobGeo = new THREE.PlaneGeometry(0.98, 0.98);
const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.75 });
const dotGeo = new THREE.CircleGeometry(0.15, 24);
const ringGeo = new THREE.RingGeometry(0.39, 0.47, 32);
const colorMats = new Map<string, THREE.MeshBasicMaterial>();
function colorMat(css: string): THREE.MeshBasicMaterial {
  let m = colorMats.get(css);
  if (!m) {
    const c = new THREE.Color();
    const match = css.match(/rgba?\(([^)]+)\)/);
    let opacity = 1;
    if (match) {
      const [r, g, b, a] = match[1].split(',').map((s) => parseFloat(s));
      c.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
      opacity = a ?? 1;
    } else c.set(css);
    m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity, depthWrite: false });
    colorMats.set(css, m);
  }
  return m;
}

function SquareMark({ sq, color, y = 0.006, geo = planeGeo }: { sq: Square; color: string; y?: number; geo?: THREE.BufferGeometry }) {
  const [x, z] = sqPos(sq);
  return <mesh geometry={geo} material={colorMat(color)} rotation={[-Math.PI / 2, 0, 0]} position={[x, y, z]} renderOrder={2} />;
}

/* --------------------------------- camera -------------------------------- */

function cameraTarget(view: CameraView, orientation: Color, aspect: number): { pos: THREE.Vector3; look: THREE.Vector3 } {
  const s = orientation === 'w' ? 1 : -1;
  // Pull back on narrow (portrait) canvases so the whole board stays in frame.
  const f = Math.max(0.9, 1.22 / Math.max(0.5, aspect));
  if (view === 'top') return { pos: new THREE.Vector3(0, 15.2 * f, 0.9 * s), look: new THREE.Vector3(0, 0, 0.12 * s) };
  if (view === 'low') return { pos: new THREE.Vector3(0, 5.4 * f, 10.6 * s * f), look: new THREE.Vector3(0, -0.9, 0.9 * s) };
  return { pos: new THREE.Vector3(0, 10.4 * f, 8.0 * s * f), look: new THREE.Vector3(0, -0.5, 1.15 * s) };
}

function CameraRig({ view, orientation, animate }: { view: CameraView; orientation: Color; animate: boolean }) {
  const { camera, invalidate, size } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  const cur = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null);
  const target = useRef(cameraTarget(view, orientation, aspect));
  const lastSide = useRef(orientation);
  // Cinematic orbit used when the board turns to the other player.
  const orbit = useRef<{ from: number; to: number; t: number; lookFrom: THREE.Vector3 } | null>(null);
  useEffect(() => {
    target.current = cameraTarget(view, orientation, aspect);
    if (!cur.current || !animate) {
      cur.current = { pos: target.current.pos.clone(), look: target.current.look.clone() };
      orbit.current = null;
      camera.position.copy(cur.current.pos);
      camera.lookAt(cur.current.look);
    } else if (lastSide.current !== orientation) {
      const from = Math.atan2(cur.current.pos.x, cur.current.pos.z);
      const want = orientation === 'w' ? 0 : Math.PI;
      let diff = want - from;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(Math.abs(diff) - Math.PI) < 0.05) diff = Math.PI; // always sweep the same way
      orbit.current = { from, to: from + diff, t: 0, lookFrom: cur.current.look.clone() };
    }
    lastSide.current = orientation;
    invalidate();
  }, [view, orientation, aspect]);
  useFrame((_, d) => {
    const c = cur.current;
    if (!c) return;
    const t = target.current;
    const o = orbit.current;
    if (o) {
      o.t = Math.min(1, o.t + d / 1.35);
      const e = o.t < 0.5 ? 4 * o.t * o.t * o.t : 1 - Math.pow(-2 * o.t + 2, 3) / 2;
      const a = o.from + (o.to - o.from) * e;
      const r = Math.hypot(t.pos.x, t.pos.z);
      c.pos.set(Math.sin(a) * r, t.pos.y + Math.sin(Math.PI * e) * 2.2, Math.cos(a) * r);
      c.look.lerpVectors(o.lookFrom, t.look, e);
      if (o.t >= 1) { orbit.current = null; c.pos.copy(t.pos); c.look.copy(t.look); }
    } else {
      const k = 1 - Math.exp(-d * 5);
      c.pos.lerp(t.pos, k);
      c.look.lerp(t.look, k);
    }
    camera.position.copy(c.pos);
    camera.lookAt(c.look);
    if (orbit.current || c.pos.distanceTo(t.pos) > 0.01 || c.look.distanceTo(t.look) > 0.01) invalidate();
  });
  return null;
}

function Environment({ enabled }: { enabled: boolean }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    if (!enabled) { scene.environment = null; return; }
    try {
      const pm = new THREE.PMREMGenerator(gl);
      const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = env;
      (scene as any).environmentIntensity = 0.45;
      pm.dispose();
      return () => { env.dispose(); scene.environment = null; };
    } catch {
      scene.environment = null;
    }
  }, [enabled]);
  return null;
}

/* ---------------------------------- scene -------------------------------- */

function Backdrop({ top, bottom }: { top: string; bottom: string }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => { scene.background = backdropTexture(top, bottom); }, [top, bottom]);
  return null;
}

function Scene(props: BoardProps & { bg: string; bgTop?: string }) {
  const s = useSettings();
  const theme = getBoardTheme(s.boardTheme);
  const quality = s.quality;
  const duration = s.animations === 'off' ? 0 : s.animations === 'reduced' ? 160 : 320;
  const flip = props.orientation === 'b';
  const occupied = useMemo(() => new Set(props.pieces.map((p) => p.square)), [props.pieces]);

  const onPick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!props.interactive) return;
    const file = Math.floor(e.point.x + 4);
    const rank = Math.floor(4 - e.point.z);
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return;
    props.onSquarePress?.(coordsToSquare(file, rank));
  };

  return (
    <>
      <Backdrop top={props.bgTop ?? props.bg} bottom={props.bg} />
      <Environment enabled={quality !== 'low'} />
      <hemisphereLight args={['#fff6e8', '#2a2622', quality === 'low' ? 0.95 : 0.4]} />
      <directionalLight
        position={[4.5, 11, 6.5]} intensity={quality === 'low' ? 1.35 : 1.75} color="#fff1dc"
        castShadow={quality !== 'low'}
        shadow-mapSize-width={quality === 'high' ? 2048 : 1024} shadow-mapSize-height={quality === 'high' ? 2048 : 1024}
        shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-camera-near={2} shadow-camera-far={30}
        shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={quality === 'high' ? 5 : 3}
      />
      <directionalLight position={[-6, 5, -5]} intensity={0.45} color="#c9d6ff" />
      <CameraRig view={s.camera} orientation={props.orientation} animate={duration > 0} />

      <BoardMesh theme={theme} quality={quality} flip={flip} showCoords={s.showCoords} />

      {s.showLastMove && props.lastMove && <>
        <SquareMark sq={props.lastMove.from} color={theme.lastMove} />
        <SquareMark sq={props.lastMove.to} color={theme.lastMove} />
      </>}
      {props.highlights?.map((h) => <SquareMark key={'h' + h} sq={h} color={theme.lastMove} />)}
      {props.selected && <SquareMark sq={props.selected} color={theme.selected} y={0.007} />}
      {props.checkSquare && <SquareMark sq={props.checkSquare} color={theme.check} y={0.008} />}
      {props.hint && <>
        <SquareMark sq={props.hint.from} color={theme.hint} y={0.008} />
        <SquareMark sq={props.hint.to} color={theme.hint} y={0.008} />
      </>}
      {props.markers?.map((m) => <SquareMark key={'m' + m.square} sq={m.square} y={0.009}
        color={m.kind === 'good' ? 'rgba(80,190,120,0.6)' : m.kind === 'bad' ? 'rgba(220,70,60,0.6)' : 'rgba(90,150,230,0.5)'} />)}
      {s.showLegal && props.targets?.map((t) => occupied.has(t)
        ? <SquareMark key={'t' + t} sq={t} color="rgba(15,15,15,0.45)" y={0.01} geo={ringGeo} />
        : <SquareMark key={'t' + t} sq={t} color="rgba(15,15,15,0.4)" y={0.01} geo={dotGeo} />)}

      {props.pieces.map((p) => (
        <Piece3D key={p.id} piece={p} setId={s.pieceSet} quality={quality} duration={duration} lifted={props.selected === p.square}
          onPick={props.interactive ? (sq) => props.onSquarePress?.(sq) : undefined} />
      ))}
      {props.captured && duration > 0 && (
        <CapturedPiece key={props.captured.id + (props.lastMove?.to ?? '')} piece={props.captured} setId={s.pieceSet} quality={quality} duration={duration} />
      )}

      {/* Invisible pick plane above the board for taps */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} onClick={onPick}>
        <planeGeometry args={[8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </>
  );
}

export default function Board3D(props: BoardProps & { bg: string; bgTop?: string; height: number }) {
  const quality = useSettings((s) => s.quality);
  const pr = PixelRatio.get();
  const dpr = quality === 'low' ? 1 : quality === 'balanced' ? Math.min(1.5, pr) : Math.min(2, pr);
  return (
    <View style={{ width: props.size, height: props.height }}>
      <Canvas
        frameloop="demand"
        shadows={quality !== 'low' ? { type: THREE.PCFShadowMap } : false}
        dpr={dpr}
        gl={{ antialias: quality !== 'low', powerPreference: quality === 'high' ? 'high-performance' : 'default', toneMappingExposure: 1.05 } as any}
        camera={{ fov: 36, near: 0.5, far: 80, position: [0, 10.6, 8.6] }}
      >
        <Suspense fallback={null}>
          <Scene {...props} />
        </Suspense>
      </Canvas>
    </View>
  );
}
