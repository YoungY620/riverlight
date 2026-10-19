import { cardKey, type Card } from './cards';

export const HAND_CATEGORIES = [
  'high-card',
  'pair',
  'two-pair',
  'three-of-a-kind',
  'straight',
  'flush',
  'full-house',
  'four-of-a-kind',
  'straight-flush',
] as const;

export type HandCategory = (typeof HAND_CATEGORIES)[number];

export interface HandEvaluation {
  category: HandCategory;
  categoryRank: number;
  ranks: number[];
  name: string;
  cards: Card[];
}

function straightHighCard(ranks: readonly number[]): number | null {
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  if (unique.includes(14)) unique.push(1);
  for (let index = 0; index <= unique.length - 5; index += 1) {
    const high = unique[index];
    if (high === undefined) continue;
    let sequential = true;
    for (let offset = 1; offset < 5; offset += 1) {
      if (unique[index + offset] !== high - offset) {
        sequential = false;
        break;
      }
    }
    if (sequential) return high;
  }
  return null;
}

function evaluateFive(cards: readonly Card[]): HandEvaluation {
  const ranks = cards.map((card) => card.rank).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((card) => card.suit === cards[0]?.suit);
  const straight = straightHighCard(ranks);

  let category: HandCategory;
  let tiebreak: number[];
  if (flush && straight !== null) {
    category = 'straight-flush';
    tiebreak = [straight];
  } else if (groups[0]?.[1] === 4) {
    category = 'four-of-a-kind';
    tiebreak = [groups[0][0], groups[1]?.[0] ?? 0];
  } else if (groups[0]?.[1] === 3 && groups[1]?.[1] === 2) {
    category = 'full-house';
    tiebreak = [groups[0][0], groups[1][0]];
  } else if (flush) {
    category = 'flush';
    tiebreak = ranks;
  } else if (straight !== null) {
    category = 'straight';
    tiebreak = [straight];
  } else if (groups[0]?.[1] === 3) {
    category = 'three-of-a-kind';
    tiebreak = [groups[0][0], ...groups.slice(1).map(([rank]) => rank).sort((a, b) => b - a)];
  } else if (groups[0]?.[1] === 2 && groups[1]?.[1] === 2) {
    category = 'two-pair';
    const pairs = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    tiebreak = [...pairs, groups[2]?.[0] ?? 0];
  } else if (groups[0]?.[1] === 2) {
    category = 'pair';
    tiebreak = [groups[0][0], ...groups.slice(1).map(([rank]) => rank).sort((a, b) => b - a)];
  } else {
    category = 'high-card';
    tiebreak = ranks;
  }

  const names: Record<HandCategory, string> = {
    'high-card': 'High card',
    pair: 'Pair',
    'two-pair': 'Two pair',
    'three-of-a-kind': 'Three of a kind',
    straight: 'Straight',
    flush: 'Flush',
    'full-house': 'Full house',
    'four-of-a-kind': 'Four of a kind',
    'straight-flush': straight === 14 ? 'Royal flush' : 'Straight flush',
  };
  return {
    category,
    categoryRank: HAND_CATEGORIES.indexOf(category),
    ranks: tiebreak,
    name: names[category],
    cards: cards.map((card) => ({ ...card })),
  };
}

export function compareEvaluations(left: HandEvaluation, right: HandEvaluation): number {
  if (left.categoryRank !== right.categoryRank) return left.categoryRank - right.categoryRank;
  const length = Math.max(left.ranks.length, right.ranks.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left.ranks[index] ?? 0) - (right.ranks[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function evaluateHand(cards: readonly Card[]): HandEvaluation {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error('Hand evaluation requires between 5 and 7 cards');
  }
  if (new Set(cards.map(cardKey)).size !== cards.length) {
    throw new Error('Hand evaluation cannot contain duplicate cards');
  }
  let best: HandEvaluation | null = null;
  for (let a = 0; a < cards.length - 4; a += 1) {
    for (let b = a + 1; b < cards.length - 3; b += 1) {
      for (let c = b + 1; c < cards.length - 2; c += 1) {
        for (let d = c + 1; d < cards.length - 1; d += 1) {
          for (let e = d + 1; e < cards.length; e += 1) {
            const selected = [cards[a], cards[b], cards[c], cards[d], cards[e]];
            if (selected.some((card) => card === undefined)) continue;
            const evaluation = evaluateFive(selected as Card[]);
            if (best === null || compareEvaluations(evaluation, best) > 0) best = evaluation;
          }
        }
      }
    }
  }
  if (best === null) throw new Error('Unable to evaluate hand');
  return best;
}

export function compareHands(left: readonly Card[], right: readonly Card[]): number {
  return compareEvaluations(evaluateHand(left), evaluateHand(right));
}
