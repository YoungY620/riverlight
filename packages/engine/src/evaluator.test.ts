import { describe, expect, it } from 'vitest';
import { compareHands, evaluateHand, parseCards } from './index';

describe('hand evaluation', () => {
  it.each([
    ['royal flush', 'As Ks Qs Js Ts 2d 3c', 'straight-flush', [14], 'Royal flush'],
    ['straight flush', '9s 8s 7s 6s 5s Ad 2c', 'straight-flush', [9], 'Straight flush'],
    ['four of a kind', 'As Ah Ad Ac Kd 2c 3h', 'four-of-a-kind', [14, 13], 'Four of a kind'],
    ['full house', 'As Ah Ad Ks Kd 2c 3h', 'full-house', [14, 13], 'Full house'],
    ['flush', 'As Js 9s 5s 2s Kd Qh', 'flush', [14, 11, 9, 5, 2], 'Flush'],
    ['straight', '9s 8d 7h 6c 5s Ad 2c', 'straight', [9], 'Straight'],
    ['three of a kind', 'As Ah Ad Ks Qd 2c 3h', 'three-of-a-kind', [14, 13, 12], 'Three of a kind'],
    ['two pair', 'As Ah Ks Kd Qd 2c 3h', 'two-pair', [14, 13, 12], 'Two pair'],
    ['pair', 'As Ah Ks Qd Jd 2c 3h', 'pair', [14, 13, 12, 11], 'Pair'],
    ['high card', 'As Qh 9s 7d 5d 2c 3h', 'high-card', [14, 12, 9, 7, 5], 'High card'],
  ])('ranks %s', (_label, cards, category, ranks, name) => {
    const evaluation = evaluateHand(parseCards(cards));
    expect(evaluation.category).toBe(category);
    expect(evaluation.ranks).toEqual(ranks);
    expect(evaluation.name).toBe(name);
    expect(evaluation.cards).toHaveLength(5);
  });

  it('treats ace as low in a wheel but not below a six-high straight', () => {
    const wheel = evaluateHand(parseCards('As 2d 3h 4c 5s Kd Qh'));
    const sixHigh = evaluateHand(parseCards('2s 3d 4h 5c 6s Kd Qh'));
    expect(wheel.category).toBe('straight');
    expect(wheel.ranks).toEqual([5]);
    expect(sixHigh.ranks).toEqual([6]);
    expect(compareHands(parseCards('As 2d 3h 4c 5s Kd Qh'), parseCards('2s 3d 4h 5c 6s Kd Qh'))).toBeLessThan(0);
  });

  it('selects the best full house from two triplets', () => {
    const evaluation = evaluateHand(parseCards('As Ah Ad Ks Kh Kd 2c'));
    expect(evaluation.category).toBe('full-house');
    expect(evaluation.ranks).toEqual([14, 13]);
  });

  it('breaks equal categories with kickers and returns zero for exact ties', () => {
    const aceKing = parseCards('As Ah Kd Qs 9c 4d 2h');
    const aceQueen = parseCards('As Ad Qd Js 9h 4c 2d');
    expect(compareHands(aceKing, aceQueen)).toBeGreaterThan(0);
    expect(compareHands(aceKing, aceKing)).toBe(0);
  });

  it('supports five-card input and rejects duplicates', () => {
    expect(evaluateHand(parseCards('As Ks Qs Js Ts')).name).toBe('Royal flush');
    expect(() => evaluateHand(parseCards('As As Ks Qs Js'))).toThrow(/duplicate/);
    expect(() => evaluateHand(parseCards('As Ks Qs Js'))).toThrow(/between 5 and 7/);
  });
});
