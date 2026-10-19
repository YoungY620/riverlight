export const SUITS = ['c', 'd', 'h', 's'] as const;
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];

export interface Card {
  rank: Rank;
  suit: Suit;
}

const RANK_LABELS: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: 'T',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })));
}

export function cardToString(card: Card): string {
  return `${RANK_LABELS[card.rank]}${card.suit}`;
}

export function parseCard(value: string): Card {
  const match = /^(10|[2-9TJQKA])([CDHS])$/i.exec(value);
  if (!match) throw new Error(`Invalid card: ${value}`);
  const rankText = (match[1] ?? '').toUpperCase();
  const rank = rankText === 'T' || rankText === '10'
    ? 10
    : rankText === 'J'
      ? 11
      : rankText === 'Q'
        ? 12
        : rankText === 'K'
          ? 13
          : rankText === 'A'
            ? 14
            : Number(rankText);
  const suit = (match[2] ?? '').toLowerCase() as Suit;
  if (!RANKS.includes(rank as Rank) || !SUITS.includes(suit)) {
    throw new Error(`Invalid card: ${value}`);
  }
  return { rank: rank as Rank, suit };
}

export function parseCards(values: string): Card[] {
  const trimmed = values.trim();
  return trimmed ? trimmed.split(/\s+/).map(parseCard) : [];
}

export function cardKey(card: Card): string {
  return cardToString(card);
}

export function assertValidDeck(deck: readonly Card[]): void {
  if (deck.length !== 52) throw new Error('A deck must contain exactly 52 cards');
  const keys = new Set(deck.map(cardKey));
  if (keys.size !== 52) throw new Error('A deck cannot contain duplicate cards');
  for (const card of deck) {
    if (!RANKS.includes(card.rank) || !SUITS.includes(card.suit)) {
      throw new Error(`Invalid card in deck: ${String(card)}`);
    }
  }
}
