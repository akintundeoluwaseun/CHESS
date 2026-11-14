import React, { Component, ReactNode, Suspense, lazy } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { BoardProps } from './types';
import { Board2D } from '@/render2d/Board2D';
import { useSettings } from '@/data/settings';
import { getBoardTheme } from './boardThemes';
import { usePalette } from '@/ui/theme';
import { Txt } from '@/ui/kit';

const Board3D = lazy(() => import('@/render3d/Board3D'));

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Picks the 2D or 3D renderer. 3D falls back to 2D automatically if the device can't render it. */
export function BoardView(props: BoardProps & { force2d?: boolean; mode?: '2d' | '3d' }) {
  const setting = useSettings((s) => s.renderMode);
  const mode = props.mode ?? setting;
  const p = usePalette();
  const themeId = useSettings((s) => s.boardTheme);
  const use3d = mode === '3d' && !props.force2d;
  if (!use3d) {
    // A real board has a frame: wood/stone border with a soft drop shadow.
    const t = getBoardTheme(themeId);
    const pad = Math.max(4, Math.round(props.size * 0.014));
    return (
      <View style={{ padding: pad, borderRadius: 10, backgroundColor: t.frame, borderWidth: 1, borderColor: t.frameDark,
        shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 10 }}>
        <Board2D {...props} size={props.size - pad * 2} />
      </View>
    );
  }
  const h = Math.round(props.size * 1.04);
  const flat = <Board2D {...props} />;
  return (
    <Boundary fallback={<View>{flat}<Txt variant="caption" muted style={{ textAlign: 'center', marginTop: 6 }}>3D isn't supported on this device — showing 2D.</Txt></View>}
      onError={() => useSettings.getState().set({ renderMode: '2d' })}>
      <Suspense fallback={<View style={{ width: props.size, height: h, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={p.accent} /></View>}>
        <Board3D {...props} bg={p.bg} bgTop={p.bgElevated} height={h} />
      </Suspense>
    </Boundary>
  );
}
