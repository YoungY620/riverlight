import { describe, expect, it } from 'vitest';
import {
  BOT_STYLES,
  calculatePotOdds,
  decideBotAction,
  HoldemGame,
  suggestAction,
  type EquityEstimate,
  type GameSnapshot,
} from './index';

function headsUp(): HoldemGame {
  return new HoldemGame({
    players: [{ id: 'a', chips: 100 }, { id: 'b', chips: 100 }],
    seed: 'bot-strategy',
  });
}

function estimate(equity: number): EquityEstimate {
  return { win: equity, tie: 0, loss: 1 - equity, equity, samples: 100, opponents: 1 };
}

function flopSnapshot(game: HoldemGame): GameSnapshot {
  game.act('a', { type: 'call' });
  game.act('b', { type: 'check' });
  return game.getSnapshot('b');
}

describe('classical bot strategy', () => {
  it('calculates pot odds and treats equality according to style margins', () => {
    expect(calculatePotOdds(100, 25)).toBe(0.2);
    expect(calculatePotOdds(100, 0)).toBe(0);
    const game = headsUp();
    game.act('a', { type: 'call' });
    game.act('b', { type: 'check' });
    for (let street = 0; street < 2; street += 1) {
      game.act('b', { type: 'check' });
      game.act('a', { type: 'check' });
    }
    game.act('b', { type: 'bet', amount: 20 });
    const snapshot = game.getSnapshot('a');
    const legal = snapshot.legalActions;
    if (legal === null) throw new Error('Missing legal actions');
    const potOdds = calculatePotOdds(snapshot.pot, legal.callAmount);
    expect(potOdds).toBeCloseTo(1 / 3, 12);
    expect(decideBotAction(snapshot, 'a', estimate(potOdds), 'LP', 0.99)).toEqual({ type: 'call' });
    expect(decideBotAction(snapshot, 'a', estimate(potOdds), 'TAG', 0.99)).toEqual({ type: 'fold' });
  });

  it('separates tight from loose continuing ranges', () => {
    const snapshot = headsUp().getSnapshot('a');
    const marginal = estimate(0.28);
    expect(decideBotAction(snapshot, 'a', marginal, 'TAG', 0.99)).toEqual({ type: 'fold' });
    expect(decideBotAction(snapshot, 'a', marginal, 'TP', 0.99)).toEqual({ type: 'fold' });
    expect(decideBotAction(snapshot, 'a', marginal, 'LAG', 0.99)).toEqual({ type: 'call' });
    expect(decideBotAction(snapshot, 'a', marginal, 'LP', 0.99)).toEqual({ type: 'call' });
  });

  it('separates aggressive from passive value decisions', () => {
    const preflop = headsUp().getSnapshot('a');
    expect(decideBotAction(preflop, 'a', estimate(0.65), 'LAG', 0.99)?.type).toBe('raise');
    expect(decideBotAction(preflop, 'a', estimate(0.65), 'TAG', 0.99)).toEqual({ type: 'call' });

    const flop = flopSnapshot(headsUp());
    expect(decideBotAction(flop, 'b', estimate(0.7), 'TAG', 0.99)?.type).toBe('bet');
    expect(decideBotAction(flop, 'b', estimate(0.7), 'LAG', 0.99)?.type).toBe('bet');
    expect(decideBotAction(flop, 'b', estimate(0.7), 'TP', 0.99)).toEqual({ type: 'check' });
    expect(decideBotAction(flop, 'b', estimate(0.7), 'LP', 0.99)).toEqual({ type: 'check' });
  });

  it('uses deterministic randomness for LAG semi-bluffs only', () => {
    const flop = flopSnapshot(headsUp());
    expect(decideBotAction(flop, 'b', estimate(0.3), 'LAG', 0)?.type).toBe('bet');
    expect(decideBotAction(flop, 'b', estimate(0.3), 'LAG', 0.99)).toEqual({ type: 'check' });
    expect(decideBotAction(flop, 'b', estimate(0.3), 'TAG', 0)).toEqual({ type: 'check' });
  });

  it('is deterministic by default to TAG and returns only legal actions for every style', () => {
    const game = headsUp();
    const options = { samples: 24, seed: 'high-level-bot' };
    const implicit = suggestAction(game, 'a', options);
    const explicit = suggestAction(game, 'a', { ...options, style: 'TAG' as const });
    expect(implicit).toEqual(explicit);
    expect(suggestAction(game, 'a', options)).toEqual(implicit);

    for (const style of BOT_STYLES) {
      const styledGame = headsUp();
      const action = suggestAction(styledGame, 'a', { style, samples: 16, seed: `style-${style}` });
      expect(action).not.toBeNull();
      if (action !== null) expect(() => styledGame.act('a', action)).not.toThrow();
    }
  });
});
