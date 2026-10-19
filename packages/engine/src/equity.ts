import { cardKey, createDeck, type Card } from './cards';
import { compareEvaluations, evaluateHand } from './evaluator';
import type { HoldemGame } from './game';
import { createSeededRandom } from './random';
import type { PlayerId } from './types';

export const DEFAULT_EQUITY_SAMPLES = 400;

export interface EquityEstimate {
  win: number;
  tie: number;
  loss: number;
  equity: number;
  samples: number;
  opponents: number;
}

export interface MonteCarloEquityOptions {
  samples?: number;
  seed?: string;
}

function drawCards(deck: Card[], count: number, random: () => number): Card[] {
  const drawn: Card[] = [];
  for (let index = 0; index < count; index += 1) {
    const remaining = deck.length - index;
    const selected = index + Math.floor(random() * remaining);
    const card = deck[selected];
    const current = deck[index];
    if (card === undefined || current === undefined) throw new Error('Unable to draw Monte Carlo cards');
    deck[selected] = current;
    deck[index] = card;
    drawn.push(card);
  }
  return drawn;
}

export function estimateEquity(
  holeCards: readonly Card[],
  community: readonly Card[],
  opponents: number,
  options: MonteCarloEquityOptions = {},
): EquityEstimate {
  if (holeCards.length !== 2) throw new Error('Equity estimation requires exactly two hole cards');
  if (![0, 3, 4, 5].includes(community.length)) {
    throw new Error('Community cards must contain 0, 3, 4, or 5 cards');
  }
  if (!Number.isSafeInteger(opponents) || opponents < 1 || opponents > 8) {
    throw new Error('Opponents must be an integer between 1 and 8');
  }
  const samples = options.samples ?? DEFAULT_EQUITY_SAMPLES;
  if (!Number.isSafeInteger(samples) || samples < 1) throw new Error('Samples must be a positive integer');
  const knownCards = [...holeCards, ...community];
  if (new Set(knownCards.map(cardKey)).size !== knownCards.length) {
    throw new Error('Equity estimation cannot use duplicate known cards');
  }
  const known = new Set(knownCards.map(cardKey));
  const available = createDeck().filter((card) => !known.has(cardKey(card)));
  const missingCommunity = 5 - community.length;
  const drawCount = opponents * 2 + missingCommunity;
  if (drawCount > available.length) throw new Error('Not enough cards for Monte Carlo simulation');
  const random = createSeededRandom(options.seed ?? 'riverlight-equity');
  let wins = 0;
  let ties = 0;
  let losses = 0;

  for (let sample = 0; sample < samples; sample += 1) {
    const drawn = drawCards([...available], drawCount, random);
    const opponentHands: Card[][] = [];
    for (let opponent = 0; opponent < opponents; opponent += 1) {
      const first = drawn[opponent * 2];
      const second = drawn[opponent * 2 + 1];
      if (first === undefined || second === undefined) throw new Error('Incomplete opponent hand');
      opponentHands.push([first, second]);
    }
    const fullCommunity = [...community, ...drawn.slice(opponents * 2)];
    const viewerEvaluation = evaluateHand([...holeCards, ...fullCommunity]);
    let tied = false;
    let lost = false;
    for (const opponentHand of opponentHands) {
      const comparison = compareEvaluations(
        evaluateHand([...opponentHand, ...fullCommunity]),
        viewerEvaluation,
      );
      if (comparison > 0) lost = true;
      else if (comparison === 0) tied = true;
    }
    if (lost) losses += 1;
    else if (tied) ties += 1;
    else wins += 1;
  }

  const win = wins / samples;
  const tie = ties / samples;
  const loss = losses / samples;
  return { win, tie, loss, equity: win + tie / 2, samples, opponents };
}

export function estimatePlayerEquity(
  game: HoldemGame,
  playerId: PlayerId,
  options: MonteCarloEquityOptions = {},
): EquityEstimate {
  const snapshot = game.getSnapshot(playerId);
  const player = snapshot.players.find((candidate) => candidate.id === playerId);
  if (player === undefined) throw new Error(`Unknown player: ${playerId}`);
  const opponents = snapshot.players.filter((candidate) =>
    candidate.id !== playerId && candidate.inHand && !candidate.folded,
  ).length;
  return estimateEquity(player.holeCards, snapshot.community, opponents, options);
}
