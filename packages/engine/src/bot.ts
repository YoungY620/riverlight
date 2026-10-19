import { estimatePlayerEquity, type EquityEstimate } from './equity';
import type { HoldemGame } from './game';
import { createSeededRandom } from './random';
import type {
  GameSnapshot,
  LegalActions,
  PlayerAction,
  PlayerId,
  PlayerSnapshot,
  Street,
} from './types';

export const BOT_STYLES = ['TAG', 'LAG', 'TP', 'LP'] as const;
export type BotStyle = (typeof BOT_STYLES)[number];

export const BOT_DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
export type BotDifficulty = (typeof BOT_DIFFICULTIES)[number];

export interface BotDifficultyProfile {
  defaultSamples: number;
  callDiscipline: number;
  valueBetOffset: number;
  valueRaiseOffset: number;
  mistakeRate: number;
}

export const DIFFICULTY_PROFILES: Readonly<Record<BotDifficulty, Readonly<BotDifficultyProfile>>> = {
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
};

export const BOT_POSITIONS = ['button', 'blinds', 'early', 'late'] as const;
export type BotPosition = (typeof BOT_POSITIONS)[number];

export const PREFLOP_POSITION_ADJUSTMENTS: Readonly<Record<BotPosition, number>> = {
  button: -0.02,
  blinds: 0.01,
  early: 0.02,
  late: -0.01,
};

export interface BotSuggestionOptions {
  style?: BotStyle;
  difficulty?: BotDifficulty;
  samples?: number;
  seed?: string;
}

interface StyleProfile {
  callMargin: number;
  valueBet: number;
  valueRaise: number;
  bluffRate: number;
  betFraction: number;
  raiseFraction: number;
  preflopRaiseFactor: number;
}

const PROFILES: Record<BotStyle, StyleProfile> = {
  TAG: {
    callMargin: 0.05,
    valueBet: 0.62,
    valueRaise: 0.68,
    bluffRate: 0,
    betFraction: 0.66,
    raiseFraction: 0.66,
    preflopRaiseFactor: 2.5,
  },
  LAG: {
    callMargin: -0.03,
    valueBet: 0.5,
    valueRaise: 0.58,
    bluffRate: 0.28,
    betFraction: 0.75,
    raiseFraction: 0.75,
    preflopRaiseFactor: 3,
  },
  TP: {
    callMargin: 0.05,
    valueBet: 0.82,
    valueRaise: 0.9,
    bluffRate: 0,
    betFraction: 0.5,
    raiseFraction: 0.5,
    preflopRaiseFactor: 2,
  },
  LP: {
    callMargin: -0.03,
    valueBet: 0.88,
    valueRaise: 0.94,
    bluffRate: 0,
    betFraction: 0.5,
    raiseFraction: 0.5,
    preflopRaiseFactor: 2,
  },
};

export function calculatePotOdds(pot: number, callAmount: number): number {
  if (!Number.isFinite(pot) || !Number.isFinite(callAmount) || pot < 0 || callAmount < 0) {
    throw new Error('Pot and call amount must be non-negative finite numbers');
  }
  return callAmount === 0 ? 0 : callAmount / (pot + callAmount);
}

export function getBotPosition(snapshot: GameSnapshot, playerId: PlayerId): BotPosition {
  const playerIndex = snapshot.players.findIndex((player) => player.id === playerId);
  if (playerIndex < 0) throw new Error(`Unknown player: ${playerId}`);
  if (!snapshot.players[playerIndex]?.inHand) throw new Error(`Player ${playerId} is not in this hand`);
  if (playerIndex === snapshot.buttonIndex) return 'button';
  if (playerIndex === snapshot.smallBlindIndex || playerIndex === snapshot.bigBlindIndex) return 'blinds';
  const activeCount = snapshot.players.filter((player) => player.inHand).length;
  let distance = 0;
  for (let offset = 0; offset < snapshot.players.length; offset += 1) {
    const index = (snapshot.buttonIndex + offset) % snapshot.players.length;
    if (!snapshot.players[index]?.inHand) continue;
    if (index === playerIndex) {
      if (activeCount >= 5 && distance === activeCount - 1) return 'late';
      if (activeCount >= 6 && distance === activeCount - 2) return 'late';
      return 'early';
    }
    distance += 1;
  }
  throw new Error(`Unable to determine position for ${playerId}`);
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function streetAdjustment(street: Street): number {
  if (street === 'preflop') return 0.03;
  if (street === 'turn') return 0.02;
  if (street === 'river') return 0.04;
  return 0;
}

function aggressiveAction(
  snapshot: GameSnapshot,
  player: PlayerSnapshot,
  legal: LegalActions,
  style: BotStyle,
  street: Street,
): PlayerAction | null {
  const profile = PROFILES[style];
  if (legal.canBet && legal.minBet !== null) {
    const desired = Math.max(legal.minBet, Math.round(snapshot.pot * profile.betFraction));
    const amount = Math.min(legal.maxBetTo, desired);
    if (amount >= legal.minBet) return { type: 'bet', amount };
  }
  if (legal.canRaise && legal.minRaiseTo !== null) {
    const desired = street === 'preflop'
      ? Math.round(snapshot.currentBet * profile.preflopRaiseFactor)
      : snapshot.currentBet + Math.round((snapshot.pot + legal.callAmount) * profile.raiseFraction);
    const amount = Math.min(legal.maxBetTo, Math.max(legal.minRaiseTo, desired));
    if (amount >= legal.minRaiseTo) return { type: 'raise', amount };
  }
  const shortStack = player.stack <= Math.max(snapshot.minimumRaise, legal.amountToCall * 2);
  if (legal.canAllIn && shortStack) return { type: 'all-in' };
  return null;
}

function sameAction(left: PlayerAction, right: PlayerAction): boolean {
  if (left.type !== right.type) return false;
  if ((left.type === 'bet' || left.type === 'raise') && (right.type === 'bet' || right.type === 'raise')) {
    return left.amount === right.amount;
  }
  return true;
}

function mistakeAction(
  legal: LegalActions,
  optimal: PlayerAction,
  profile: BotDifficultyProfile,
  randomValue: number,
): PlayerAction {
  if (profile.mistakeRate <= 0 || randomValue >= profile.mistakeRate) return optimal;
  const candidates: PlayerAction[] = [];
  if (legal.canCheck) candidates.push({ type: 'check' });
  if (legal.canCall) candidates.push({ type: 'call' });
  if (legal.canFold) candidates.push({ type: 'fold' });
  if (legal.canBet && legal.minBet !== null) candidates.push({ type: 'bet', amount: legal.minBet });
  if (legal.canRaise && legal.minRaiseTo !== null) candidates.push({ type: 'raise', amount: legal.minRaiseTo });
  const alternatives = candidates.filter((candidate) => !sameAction(candidate, optimal));
  if (alternatives.length === 0) return optimal;
  const selection = randomValue / profile.mistakeRate;
  const index = Math.min(alternatives.length - 1, Math.floor(selection * alternatives.length));
  return alternatives[index] ?? optimal;
}

export function decideBotAction(
  snapshot: GameSnapshot,
  playerId: PlayerId,
  estimate: EquityEstimate,
  style: BotStyle = 'TAG',
  randomValue = 0.5,
  difficulty: BotDifficulty = 'intermediate',
  mistakeRandomValue = 1,
): PlayerAction | null {
  const legal = snapshot.legalActions;
  const player = snapshot.players.find((candidate) => candidate.id === playerId);
  if (legal === null || player === undefined || !legal.canAct) return null;
  if (!BOT_STYLES.includes(style)) throw new Error(`Unknown bot style: ${String(style)}`);
  if (!BOT_DIFFICULTIES.includes(difficulty)) throw new Error(`Unknown bot difficulty: ${String(difficulty)}`);
  if (!Number.isFinite(estimate.equity) || estimate.equity < 0 || estimate.equity > 1) {
    throw new Error('Equity estimate must be between 0 and 1');
  }
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue > 1) {
    throw new Error('Random value must be between 0 and 1');
  }
  if (!Number.isFinite(mistakeRandomValue) || mistakeRandomValue < 0 || mistakeRandomValue > 1) {
    throw new Error('Mistake random value must be between 0 and 1');
  }
  if (snapshot.phase !== 'preflop' && snapshot.phase !== 'flop' && snapshot.phase !== 'turn' && snapshot.phase !== 'river') {
    return null;
  }
  const street = snapshot.phase;
  const profile = PROFILES[style];
  const difficultyProfile = DIFFICULTY_PROFILES[difficulty];
  const adjustment = streetAdjustment(street);
  const positionAdjustment = street === 'preflop'
    ? PREFLOP_POSITION_ADJUSTMENTS[getBotPosition(snapshot, playerId)]
    : 0;
  const potOdds = calculatePotOdds(snapshot.pot, legal.canCall ? legal.callAmount : 0);
  let callMargin = profile.callMargin + difficultyProfile.callDiscipline;
  if (street === 'river') callMargin = Math.max(0, callMargin);
  if (legal.canCall && legal.callAmount >= player.stack / 2) {
    callMargin += style === 'TAG' || style === 'TP' ? 0.04 : 0.02;
  }
  const callThreshold = clamp(potOdds + callMargin);
  const bluffMultiplier = street === 'flop' || street === 'turn' ? 1 : street === 'preflop' ? 0.5 : 0.2;
  const semiBluff = profile.bluffRate > 0 && randomValue < profile.bluffRate * bluffMultiplier;
  let optimal: PlayerAction = { type: 'fold' };

  if (legal.canCheck) {
    const valueBet = estimate.equity >= profile.valueBet + adjustment + positionAdjustment + difficultyProfile.valueBetOffset;
    const bluff = semiBluff && estimate.equity >= 0.24;
    optimal = { type: 'check' };
    if (valueBet || bluff) {
      optimal = aggressiveAction(snapshot, player, legal, style, street) ?? optimal;
    }
  } else if (legal.canCall) {
    const valueRaise = estimate.equity >= profile.valueRaise + adjustment + positionAdjustment + difficultyProfile.valueRaiseOffset;
    const bluffRaise = semiBluff && estimate.equity >= 0.34;
    if (valueRaise || bluffRaise) {
      const action = aggressiveAction(snapshot, player, legal, style, street);
      if (action !== null) return mistakeAction(legal, action, difficultyProfile, mistakeRandomValue);
    }
    if (estimate.equity >= callThreshold) optimal = { type: 'call' };
  }
  return mistakeAction(legal, optimal, difficultyProfile, mistakeRandomValue);
}

export function suggestAction(
  game: HoldemGame,
  playerId: PlayerId,
  options: BotSuggestionOptions = {},
): PlayerAction | null {
  const snapshot = game.getSnapshot(playerId);
  if (snapshot.legalActions?.canAct !== true) return null;
  const style = options.style ?? 'TAG';
  const difficulty = options.difficulty ?? 'intermediate';
  if (!BOT_DIFFICULTIES.includes(difficulty)) throw new Error(`Unknown bot difficulty: ${String(difficulty)}`);
  const seed = options.seed ?? 'riverlight-bot';
  const estimate = estimatePlayerEquity(game, playerId, {
    samples: options.samples ?? DIFFICULTY_PROFILES[difficulty].defaultSamples,
    seed,
  });
  const randomValue = createSeededRandom(`${seed}:action`)();
  const mistakeRandomValue = createSeededRandom(`${seed}:mistake`)();
  return decideBotAction(snapshot, playerId, estimate, style, randomValue, difficulty, mistakeRandomValue);
}
