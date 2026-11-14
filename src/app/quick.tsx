import { useEffect } from 'react';
import { router } from 'expo-router';
import { useProgress } from '@/data/progressStore';
import { quickGameConfig } from '@/modes/modes';
import { useSession } from '@/features/game/session';
import { useActiveGame } from '@/data/activeGame';

/** Deep-link target for Quick Game: starts immediately (resumes an unfinished game if one exists). */
export default function Quick() {
  useEffect(() => {
    const saved = useActiveGame.getState().saved;
    if (saved) useSession.getState().resume(saved);
    else useSession.getState().start(quickGameConfig(useProgress.getState().rating));
    router.replace('/game');
  }, []);
  return null;
}
