import React, { useState } from 'react';
import { router } from 'expo-router';
import { ConfirmDialog } from '@/ui/kit';
import { useActiveGame } from '@/data/activeGame';
import type { GameConfig } from '@/modes/modes';
import { useSession } from './session';

/**
 * Starting a game while another is in progress asks for confirmation. An
 * abandoned *ranked* game counts as a resignation so ratings can't be gamed.
 */
export function useLaunchGame() {
  const [pending, setPending] = useState<GameConfig | null>(null);
  const saved = useActiveGame((s) => s.saved);

  const go = (config: GameConfig) => {
    const cur = useActiveGame.getState().saved;
    if (cur && cur.config.mode === 'ranked' && cur.uci.length >= 2) {
      // Record the abandoned ranked game as a loss.
      const s = useSession.getState();
      if (s.resume(cur)) s.resign();
    }
    useActiveGame.getState().clear();
    useSession.getState().start(config);
    router.push('/game');
  };

  const launch = (config: GameConfig) => {
    if (saved && saved.config.id !== config.id && saved.uci.length > 0) setPending(config);
    else go(config);
  };

  const resume = () => {
    const cur = useActiveGame.getState().saved;
    if (!cur) return;
    if (useSession.getState().config?.id !== cur.config.id || useSession.getState().result) {
      if (!useSession.getState().resume(cur)) return;
    }
    router.push('/game');
  };

  const dialog = (
    <ConfirmDialog
      visible={!!pending}
      title="Abandon current game?"
      text={saved?.config.mode === 'ranked' ? 'You have a ranked game in progress. Starting a new game will count it as a loss.' : 'You have a game in progress. Starting a new game will discard it.'}
      confirm="Start new"
      danger
      onCancel={() => setPending(null)}
      onConfirm={() => { const c = pending!; setPending(null); go(c); }}
    />
  );
  return { launch, resume, dialog, saved };
}
