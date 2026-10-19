import { describe, expect, it } from 'vitest';
import { cardToString, createShuffledDeck, HoldemGame, type Card, type GameSnapshot } from './index';

function ownCards(game: HoldemGame, id: string): string[] {
  const snapshot: GameSnapshot = game.getSnapshot(id);
  const player = snapshot.players.find((candidate) => candidate.id === id);
  if (player === undefined) throw new Error(`Missing player ${id}`);
  return player.holeCards.map(cardToString);
}

function codes(cards: readonly Card[]): string[] {
  return cards.map(cardToString);
}

describe('per-hand deck injection and showdown visibility', () => {
  it('preserves first-hand deck injection and accepts a fresh deck for the next hand', () => {
    const firstDeck = createShuffledDeck('first-injected');
    const secondDeck = createShuffledDeck('second-injected');
    const game = new HoldemGame({
      players: [
        { id: 'p0', chips: 100 },
        { id: 'p1', chips: 100 },
        { id: 'p2', chips: 100 },
      ],
      deck: firstDeck,
    });
    expect(ownCards(game, 'p0')).toEqual(codes([firstDeck[2], firstDeck[5]] as Card[]));
    expect(ownCards(game, 'p1')).toEqual(codes([firstDeck[0], firstDeck[3]] as Card[]));
    expect(ownCards(game, 'p2')).toEqual(codes([firstDeck[1], firstDeck[4]] as Card[]));

    game.act('p0', { type: 'fold' });
    game.act('p1', { type: 'fold' });
    expect(() => game.startNextHand(undefined, secondDeck.slice(1))).toThrow(/52/);
    const next = game.startNextHand('p0', secondDeck);
    expect(next.handNumber).toBe(2);
    expect(next.buttonIndex).toBe(1);
    expect(ownCards(game, 'p0')).toEqual(codes([secondDeck[1], secondDeck[4]] as Card[]));
    expect(ownCards(game, 'p1')).toEqual(codes([secondDeck[2], secondDeck[5]] as Card[]));
    expect(ownCards(game, 'p2')).toEqual(codes([secondDeck[0], secondDeck[3]] as Card[]));
  });

  it('reveals every non-folded showdown hand while hiding other folded cards', () => {
    const game = new HoldemGame({
      players: [
        { id: 'p0', chips: 100 },
        { id: 'p1', chips: 100 },
        { id: 'p2', chips: 10 },
      ],
      seed: 'showdown-visibility',
    });
    game.act('p0', { type: 'fold' });
    game.act('p1', { type: 'call' });
    const snapshot = game.getSnapshot('p1');
    expect(snapshot.phase).toBe('showdown');
    expect(snapshot.players.find((player) => player.id === 'p0')).toMatchObject({ folded: true, holeCards: [] });
    expect(snapshot.players.find((player) => player.id === 'p1')?.holeCards).toHaveLength(2);
    expect(snapshot.players.find((player) => player.id === 'p2')?.holeCards).toHaveLength(2);
  });
});
