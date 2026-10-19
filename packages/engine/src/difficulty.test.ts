import { describe, expect, it } from 'vitest';
import {
  BOT_DIFFICULTIES,
  BOT_STYLES,
  DIFFICULTY_PROFILES,
  HoldemGame,
  PREFLOP_POSITION_ADJUSTMENTS,
  decideBotAction,
  getBotPosition,
  suggestAction,
  type EquityEstimate,
} from './index';

function headsUp(): HoldemGame {
  return new HoldemGame({
    players: [{ id: 'a', chips: 100 }, { id: 'b', chips: 100 }],
    seed: 'difficulty-bot',
  });
}

function estimate(equity: number): EquityEstimate {
  return { win: equity, tie: 0, loss: 1 - equity, equity, samples: 100, opponents: 1 };
}

describe('bot difficulty profiles', () => {
  it('exports ordered data-driven samples, discipline, thresholds, and mistake rates', () => {
    expect(BOT_DIFFICULTIES).toEqual(['beginner', 'intermediate', 'advanced', 'expert']);
    expect(DIFFICULTY_PROFILES).toEqual({
      beginner: {
        defaultSamples: 120,
        callDiscipline: -0.06,
        valueBetOffset: 0.08,
        valueRaiseOffset: 0.08,
        mistakeRate: 0.22,
      },
      intermediate: {
        defaultSamples: 400,
        callDiscipline: 0,
        valueBetOffset: 0,
        valueRaiseOffset: 0,
        mistakeRate: 0.08,
      },
      advanced: {
        defaultSamples: 800,
        callDiscipline: 0.02,
        valueBetOffset: -0.02,
        valueRaiseOffset: -0.02,
        mistakeRate: 0.03,
      },
      expert: {
        defaultSamples: 1200,
        callDiscipline: 0.04,
        valueBetOffset: -0.04,
        valueRaiseOffset: -0.04,
        mistakeRate: 0,
      },
    });
    expect(DIFFICULTY_PROFILES.beginner.mistakeRate).toBeGreaterThan(DIFFICULTY_PROFILES.intermediate.mistakeRate);
    expect(DIFFICULTY_PROFILES.intermediate.mistakeRate).toBeGreaterThan(DIFFICULTY_PROFILES.advanced.mistakeRate);
    expect(DIFFICULTY_PROFILES.advanced.mistakeRate).toBeGreaterThan(DIFFICULTY_PROFILES.expert.mistakeRate);
  });

  it('changes call discipline and value thresholds independently of style', () => {
    const snapshot = headsUp().getSnapshot('a');
    expect(decideBotAction(snapshot, 'a', estimate(0.27), 'TAG', 0.99, 'beginner', 1)).toEqual({ type: 'call' });
    expect(decideBotAction(snapshot, 'a', estimate(0.27), 'TAG', 0.99, 'intermediate', 1)).toEqual({ type: 'fold' });
    expect(decideBotAction(snapshot, 'a', estimate(0.27), 'TAG', 0.99, 'expert', 1)).toEqual({ type: 'fold' });

    expect(decideBotAction(snapshot, 'a', estimate(0.7), 'TAG', 0.99, 'beginner', 1)).toEqual({ type: 'call' });
    expect(decideBotAction(snapshot, 'a', estimate(0.7), 'TAG', 0.99, 'intermediate', 1)?.type).toBe('raise');
    expect(decideBotAction(snapshot, 'a', estimate(0.66), 'TAG', 0.99, 'advanced', 1)).toEqual({ type: 'call' });
    expect(decideBotAction(snapshot, 'a', estimate(0.66), 'TAG', 0.99, 'expert', 1)?.type).toBe('raise');
  });

  it('injects deterministic legal mistakes for beginners and none for experts', () => {
    const game = headsUp();
    const snapshot = game.getSnapshot('a');
    const optimal = decideBotAction(snapshot, 'a', estimate(0.28), 'TAG', 0.99, 'beginner', 1);
    const mistake = decideBotAction(snapshot, 'a', estimate(0.28), 'TAG', 0.99, 'beginner', 0);
    expect(optimal).toEqual({ type: 'call' });
    expect(mistake).toEqual({ type: 'fold' });
    expect(decideBotAction(snapshot, 'a', estimate(0.28), 'TAG', 0.99, 'beginner', 0)).toEqual(mistake);
    expect(decideBotAction(snapshot, 'a', estimate(0.28), 'TAG', 0.99, 'expert', 0)).toEqual({ type: 'fold' });
    expect(mistake).not.toEqual(optimal);
    if (mistake === null) throw new Error('Expected a legal mistake action');
    expect(() => game.act('a', mistake)).not.toThrow();
  });

  it('defaults high-level decisions to intermediate and keeps every style and difficulty legal', () => {
    const game = headsUp();
    const implicit = suggestAction(game, 'a', { samples: 8, seed: 'default-difficulty' });
    const explicit = suggestAction(game, 'a', { samples: 8, seed: 'default-difficulty', difficulty: 'intermediate' });
    expect(implicit).toEqual(explicit);

    for (const difficulty of BOT_DIFFICULTIES) {
      for (const style of BOT_STYLES) {
        const styledGame = headsUp();
        const options = { difficulty, style, samples: 8, seed: `${difficulty}-${style}` };
        const action = suggestAction(styledGame, 'a', options);
        expect(suggestAction(styledGame, 'a', options)).toEqual(action);
        expect(action).not.toBeNull();
        if (action !== null) expect(() => styledGame.act('a', action)).not.toThrow();
      }
    }
  });
});

describe('preflop position script', () => {
  it('classifies button, blinds, early, and late positions', () => {
    const game = new HoldemGame({
      players: ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'].map((id) => ({ id, chips: 100 })),
      buttonIndex: 0,
    });
    const snapshot = game.getSnapshot('p3');
    expect(getBotPosition(snapshot, 'p0')).toBe('button');
    expect(getBotPosition(snapshot, 'p1')).toBe('blinds');
    expect(getBotPosition(snapshot, 'p2')).toBe('blinds');
    expect(getBotPosition(snapshot, 'p3')).toBe('early');
    expect(getBotPosition(snapshot, 'p4')).toBe('late');
    expect(getBotPosition(snapshot, 'p5')).toBe('late');
    expect(PREFLOP_POSITION_ADJUSTMENTS).toEqual({ button: -0.02, blinds: 0.01, early: 0.02, late: -0.01 });
  });

  it('makes a small preflop-only threshold adjustment without changing legality', () => {
    const game = new HoldemGame({
      players: ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'].map((id) => ({ id, chips: 100 })),
      buttonIndex: 0,
    });
    const early = game.getSnapshot('p3');
    const onButton = { ...early, buttonIndex: 3 };
    expect(getBotPosition(early, 'p3')).toBe('early');
    expect(getBotPosition(onButton, 'p3')).toBe('button');
    expect(decideBotAction(early, 'p3', estimate(0.71), 'TAG', 0.99)).toEqual({ type: 'call' });
    expect(decideBotAction(onButton, 'p3', estimate(0.71), 'TAG', 0.99)?.type).toBe('raise');
    expect(onButton.legalActions).toEqual(early.legalActions);
  });
});
