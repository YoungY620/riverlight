import type { Card } from './cards';

export type PlayerId = string;
export type Street = 'preflop' | 'flop' | 'turn' | 'river';
export type GamePhase = Street | 'showdown' | 'complete';
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in';

export interface PlayerConfig {
  id: PlayerId;
  name?: string;
  chips: number;
}

export interface HoldemGameOptions {
  players: PlayerConfig[];
  smallBlind?: number;
  bigBlind?: number;
  seed?: string;
  buttonIndex?: number;
  deck?: Card[];
}

export type PlayerAction =
  | { type: 'fold' | 'check' | 'call' | 'all-in' }
  | { type: 'bet' | 'raise'; amount: number };

export interface PlayerSnapshot {
  id: PlayerId;
  name: string;
  stack: number;
  bet: number;
  totalCommitted: number;
  holeCards: Card[];
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  eliminated: boolean;
  hasActed: boolean;
  lastAction: ActionType | null;
}

export interface LegalActions {
  playerId: PlayerId;
  canAct: boolean;
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  canBet: boolean;
  canRaise: boolean;
  canAllIn: boolean;
  amountToCall: number;
  callAmount: number;
  minBet: number | null;
  minRaiseTo: number | null;
  maxBetTo: number;
  allInAmount: number;
}

export interface PotResult {
  amount: number;
  contributorIds: PlayerId[];
  eligiblePlayerIds: PlayerId[];
  winnerIds: PlayerId[];
}

export interface HandResult {
  reason: 'fold' | 'showdown';
  winnerIds: PlayerId[];
  payouts: Record<PlayerId, number>;
  pots: PotResult[];
}

export interface GameSnapshot {
  handNumber: number;
  phase: GamePhase;
  buttonIndex: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
  currentPlayerId: PlayerId | null;
  currentBet: number;
  minimumRaise: number;
  pot: number;
  community: Card[];
  players: PlayerSnapshot[];
  result: HandResult | null;
  viewerId: PlayerId | null;
  legalActions: LegalActions | null;
}
