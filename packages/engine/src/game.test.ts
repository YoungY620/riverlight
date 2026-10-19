import { describe, expect, it } from 'vitest';
import {
  cardToString,
  createDeck,
  HoldemGame,
  parseCard,
  parseCards,
  suggestAction,
  type Card,
  type GameSnapshot,
  type PlayerSnapshot,
} from './index';

interface DealSpec {
  playerIds: string[];
  buttonIndex: number;
  holeCards: Record<string, string>;
  board: string;
}

function dealingDeck(spec: DealSpec): Card[] {
  const count = spec.playerIds.length;
  const smallBlindIndex = count === 2 ? spec.buttonIndex : (spec.buttonIndex + 1) % count;
  const order = Array.from({ length: count }, (_, offset) => {
    const id = spec.playerIds[(smallBlindIndex + offset) % count];
    if (id === undefined) throw new Error('Missing player in deal order');
    return id;
  });
  const dealt: Card[] = [];
  for (let round = 0; round < 2; round += 1) {
    for (const id of order) {
      const cards = parseCards(spec.holeCards[id] ?? '');
      const card = cards[round];
      if (card === undefined) throw new Error(`Missing hole card for ${id}`);
      dealt.push(card);
    }
  }
  const board = parseCards(spec.board);
  if (board.length !== 5) throw new Error('A test board requires five cards');
  const used = new Set([...dealt, ...board].map(cardToString));
  const remaining = createDeck().filter((card) => !used.has(cardToString(card)));
  const take = (): Card => {
    const card = remaining.shift();
    if (card === undefined) throw new Error('Not enough cards for test deck');
    return card;
  };
  dealt.push(take(), ...board.slice(0, 3));
  dealt.push(take(), board[3] ?? take());
  dealt.push(take(), board[4] ?? take());
  return [...dealt, ...remaining];
}

function player(snapshot: GameSnapshot, id: string): PlayerSnapshot {
  const found = snapshot.players.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`Missing player ${id}`);
  return found;
}

function threePlayers(seed = 'game-seed'): HoldemGame {
  return new HoldemGame({
    players: [
      { id: 'p0', chips: 100 },
      { id: 'p1', chips: 100 },
      { id: 'p2', chips: 100 },
    ],
    seed,
  });
}

describe('table setup and private snapshots', () => {
  it('assigns blinds and reveals hole cards only to their viewer', () => {
    const game = threePlayers();
    const snapshot = game.getSnapshot('p0');
    expect(snapshot.buttonIndex).toBe(0);
    expect(snapshot.smallBlindIndex).toBe(1);
    expect(snapshot.bigBlindIndex).toBe(2);
    expect(snapshot.currentPlayerId).toBe('p0');
    expect(player(snapshot, 'p0').holeCards).toHaveLength(2);
    expect(player(snapshot, 'p1').holeCards).toEqual([]);
    expect(player(snapshot, 'p2').holeCards).toEqual([]);
    expect(player(snapshot, 'p1').bet).toBe(5);
    expect(player(snapshot, 'p2').bet).toBe(10);
  });

  it('uses button small blind and correct action order heads-up', () => {
    const game = new HoldemGame({ players: [{ id: 'a', chips: 100 }, { id: 'b', chips: 100 }] });
    const snapshot = game.getSnapshot();
    expect(snapshot.smallBlindIndex).toBe(0);
    expect(snapshot.bigBlindIndex).toBe(1);
    expect(snapshot.currentPlayerId).toBe('a');
    expect(player(snapshot, 'a').bet).toBe(5);
    expect(player(snapshot, 'b').bet).toBe(10);
  });

  it('deals identical private cards for identical seeds', () => {
    const first = threePlayers('repeatable');
    const second = threePlayers('repeatable');
    const different = threePlayers('different');
    for (const id of ['p0', 'p1', 'p2']) {
      const cards = (game: HoldemGame): string[] => player(game.getSnapshot(id), id).holeCards.map(cardToString);
      expect(cards(first)).toEqual(cards(second));
      expect(cards(first)).not.toEqual(cards(different));
    }
  });

  it('validates table size and player ids', () => {
    expect(() => new HoldemGame({ players: [{ id: 'only', chips: 100 }] })).toThrow(/2 and 9/);
    expect(() => new HoldemGame({
      players: [{ id: 'same', chips: 100 }, { id: 'same', chips: 100 }],
    })).toThrow(/unique/);
  });
});

describe('betting rules', () => {
  it('enforces minimum raises and minimum postflop bets', () => {
    const game = new HoldemGame({ players: [{ id: 'a', chips: 100 }, { id: 'b', chips: 100 }] });
    expect(game.legalActions('a')).toMatchObject({ amountToCall: 5, callAmount: 5, minRaiseTo: 20 });
    expect(() => game.act('a', { type: 'raise', amount: 19 })).toThrow(/Raise/);
    game.act('a', { type: 'raise', amount: 20 });
    expect(game.legalActions('b')).toMatchObject({ amountToCall: 10, callAmount: 10, minRaiseTo: 30 });
    expect(() => game.act('b', { type: 'raise', amount: 29 })).toThrow(/Raise/);
    game.act('b', { type: 'call' });
    expect(game.getSnapshot().phase).toBe('flop');
    expect(game.getSnapshot().currentPlayerId).toBe('b');
    expect(game.legalActions('b')).toMatchObject({ canCheck: true, canBet: true, minBet: 10 });
    expect(() => game.act('b', { type: 'bet', amount: 9 })).toThrow(/Bet/);
    game.act('b', { type: 'bet', amount: 10 });
    game.act('a', { type: 'raise', amount: 20 });
    game.act('b', { type: 'call' });
    expect(game.getSnapshot().phase).toBe('turn');
    expect(game.getSnapshot().community).toHaveLength(4);
  });

  it('allows a short all-in call without reopening raising', () => {
    const game = new HoldemGame({ players: [{ id: 'a', chips: 100 }, { id: 'b', chips: 25 }] });
    game.act('a', { type: 'raise', amount: 20 });
    game.act('b', { type: 'all-in' });
    const legal = game.legalActions('a');
    expect(legal).toMatchObject({ canCall: true, callAmount: 5, canRaise: false, minRaiseTo: 35 });
    expect(() => game.act('a', { type: 'raise', amount: 35 })).toThrow(/Raise/);
    game.act('a', { type: 'call' });
    const snapshot = game.getSnapshot();
    expect(snapshot.phase).toBe('showdown');
    expect(snapshot.pot).toBe(50);
    expect(snapshot.players.reduce((sum, entry) => sum + entry.stack, 0)).toBe(125);
  });

  it('awards the whole pot to the only player who has not folded', () => {
    const game = threePlayers();
    game.act('p0', { type: 'raise', amount: 20 });
    game.act('p1', { type: 'fold' });
    game.act('p2', { type: 'fold' });
    const snapshot = game.getSnapshot();
    expect(snapshot.phase).toBe('complete');
    expect(snapshot.result).toMatchObject({ reason: 'fold', winnerIds: ['p0'], payouts: { p0: 35 } });
    expect(player(snapshot, 'p0').stack).toBe(115);
    expect(snapshot.currentPlayerId).toBeNull();
  });

  it('returns only legal, deterministic bot suggestions', () => {
    const game = threePlayers('bot');
    expect(suggestAction(game, 'p1')).toBeNull();
    const suggestion = suggestAction(game, 'p0');
    expect(suggestion).not.toBeNull();
    if (suggestion !== null) {
      expect(() => game.act('p0', suggestion)).not.toThrow();
    }
  });
});

describe('showdown payouts', () => {
  it('settles multiple side pots with different eligible winners', () => {
    const playerIds = ['p0', 'p1', 'p2', 'p3'];
    const game = new HoldemGame({
      players: [
        { id: 'p0', chips: 100 },
        { id: 'p1', chips: 30 },
        { id: 'p2', chips: 60 },
        { id: 'p3', chips: 100 },
      ],
      deck: dealingDeck({
        playerIds,
        buttonIndex: 0,
        holeCards: {
          p0: '2c 3d',
          p1: 'As Kh',
          p2: 'Kd Qc',
          p3: 'Qh Qd',
        },
        board: 'Ah Ad Ac Ks 9c',
      }),
    });
    game.act('p3', { type: 'all-in' });
    game.act('p0', { type: 'all-in' });
    game.act('p1', { type: 'all-in' });
    game.act('p2', { type: 'all-in' });
    const snapshot = game.getSnapshot();
    expect(snapshot.phase).toBe('showdown');
    expect(snapshot.result?.pots.map((pot) => pot.amount)).toEqual([120, 90, 80]);
    expect(snapshot.result?.pots.map((pot) => pot.winnerIds)).toEqual([['p1'], ['p2'], ['p3']]);
    expect(snapshot.result?.payouts).toEqual({ p1: 120, p2: 90, p3: 80 });
    expect(player(snapshot, 'p1').stack).toBe(120);
    expect(player(snapshot, 'p2').stack).toBe(90);
    expect(player(snapshot, 'p3').stack).toBe(80);
    expect(player(snapshot, 'p0').stack).toBe(0);
  });

  it('splits tied pots and assigns the odd chip clockwise from the button', () => {
    const playerIds = ['p0', 'p1', 'p2'];
    const game = new HoldemGame({
      players: playerIds.map((id) => ({ id, chips: 100 })),
      deck: dealingDeck({
        playerIds,
        buttonIndex: 0,
        holeCards: { p0: '2c 3d', p1: '4d 5h', p2: '6h 7s' },
        board: 'As Ks Qh Jd Tc',
      }),
    });
    game.act('p0', { type: 'call' });
    game.act('p1', { type: 'fold' });
    game.act('p2', { type: 'check' });
    for (let street = 0; street < 3; street += 1) {
      game.act('p2', { type: 'check' });
      game.act('p0', { type: 'check' });
    }
    const snapshot = game.getSnapshot();
    expect(snapshot.phase).toBe('showdown');
    expect(snapshot.pot).toBe(25);
    expect(snapshot.result?.winnerIds).toEqual(['p0', 'p2']);
    expect(snapshot.result?.payouts).toEqual({ p0: 12, p2: 13 });
    expect(player(snapshot, 'p0').stack).toBe(102);
    expect(player(snapshot, 'p1').stack).toBe(95);
    expect(player(snapshot, 'p2').stack).toBe(103);
  });

  it('eliminates zero-chip players and rotates into heads-up blinds on the next hand', () => {
    const playerIds = ['p0', 'p1', 'p2'];
    const game = new HoldemGame({
      players: [
        { id: 'p0', chips: 100 },
        { id: 'p1', chips: 100 },
        { id: 'p2', chips: 10 },
      ],
      seed: 'next-hand',
      deck: dealingDeck({
        playerIds,
        buttonIndex: 0,
        holeCards: { p0: '2c 3d', p1: 'As Kh', p2: 'Kd Qc' },
        board: 'Ah Ad Ac 9s 8c',
      }),
    });
    game.act('p0', { type: 'fold' });
    game.act('p1', { type: 'call' });
    const finished = game.getSnapshot();
    expect(finished.result?.reason).toBe('showdown');
    expect(player(finished, 'p1').stack).toBe(110);
    expect(player(finished, 'p2').stack).toBe(0);

    const next = game.startNextHand('p0');
    expect(next.handNumber).toBe(2);
    expect(next.buttonIndex).toBe(1);
    expect(next.smallBlindIndex).toBe(1);
    expect(next.bigBlindIndex).toBe(0);
    expect(next.currentPlayerId).toBe('p1');
    expect(player(next, 'p2')).toMatchObject({ eliminated: true, inHand: false, holeCards: [] });
    expect(player(next, 'p0').holeCards).toHaveLength(2);
    expect(player(game.getSnapshot('p1'), 'p1').holeCards).toHaveLength(2);
  });
});
