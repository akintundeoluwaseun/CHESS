import React from 'react';
import { Card, EmptyState, Screen } from '@/ui/kit';
import { useGames } from '@/data/gamesStore';
import { GameRow } from '@/features/history/GameRow';

export default function History() {
  const games = useGames((s) => s.games);
  return (
    <Screen title="All games" back>
      <Card padded={false}>
        {games.length === 0
          ? <EmptyState icon="time-outline" title="No games yet" text="Finished games appear here." />
          : games.map((g, i) => <GameRow key={g.id} g={g} first={i === 0} />)}
      </Card>
    </Screen>
  );
}
