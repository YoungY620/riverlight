import { describe, expect, it } from 'vitest';
import { DEFAULT_EQUITY_SAMPLES, estimateEquity, parseCards } from './index';

describe('Monte Carlo equity estimation', () => {
  it('estimates AA above 72o heads-up without claiming an exact probability', () => {
    const aces = estimateEquity(parseCards('As Ah'), [], 1, { samples: 240, seed: 'aa-72' });
    const sevenDeuce = estimateEquity(parseCards('7c 2d'), [], 1, { samples: 240, seed: 'aa-72' });
    expect(aces.equity).toBeGreaterThan(sevenDeuce.equity);
    expect(aces.equity).toBeGreaterThan(0.65);
    expect(sevenDeuce.equity).toBeLessThan(0.45);
    expect(aces.samples).toBe(240);
    expect(aces.opponents).toBe(1);
  });

  it('is deterministic for a seed and honors low sample counts', () => {
    const options = { samples: 40, seed: 'repeatable-equity' };
    const first = estimateEquity(parseCards('As Ah'), parseCards('Ks 7d 2c'), 1, options);
    const second = estimateEquity(parseCards('As Ah'), parseCards('Ks 7d 2c'), 1, options);
    expect(first).toEqual(second);
    expect(first.samples).toBe(40);
    expect(first.win + first.tie + first.loss).toBeCloseTo(1, 12);
    expect(first.equity).toBe(first.win + first.tie / 2);
  });

  it('uses the browser-sized default and reduces AA equity against more opponents', () => {
    const headsUp = estimateEquity(parseCards('As Ah'), [], 1, { seed: 'multiway' });
    const multiway = estimateEquity(parseCards('As Ah'), [], 3, { seed: 'multiway' });
    expect(headsUp.samples).toBe(DEFAULT_EQUITY_SAMPLES);
    expect(multiway.samples).toBe(DEFAULT_EQUITY_SAMPLES);
    expect(multiway.opponents).toBe(3);
    expect(multiway.equity).toBeLessThan(headsUp.equity);
  });

  it('approaches a certain river result and recognizes a board tie', () => {
    const royal = estimateEquity(parseCards('As Ks'), parseCards('Qs Js Ts 2d 3c'), 1, {
      samples: 40,
      seed: 'river-royal',
    });
    expect(royal).toMatchObject({ win: 1, tie: 0, loss: 0, equity: 1 });
    const boardRoyal = estimateEquity(parseCards('2c 3d'), parseCards('As Ks Qs Js Ts'), 1, {
      samples: 40,
      seed: 'river-tie',
    });
    expect(boardRoyal).toMatchObject({ win: 0, tie: 1, loss: 0, equity: 0.5 });
  });

  it('rejects invalid samples and duplicate known cards', () => {
    expect(() => estimateEquity(parseCards('As Ah'), [], 1, { samples: 0 })).toThrow(/positive/);
    expect(() => estimateEquity(parseCards('As Ah'), parseCards('As Kd Qc'), 1, { samples: 1 })).toThrow(/duplicate/);
  });
});
