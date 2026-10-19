import { assertValidDeck, type Card } from './cards';
import { compareEvaluations, evaluateHand, type HandEvaluation } from './evaluator';
import { createShuffledDeck } from './shuffle';
import type {
  GamePhase,
  GameSnapshot,
  HandResult,
  HoldemGameOptions,
  LegalActions,
  PlayerAction,
  PlayerConfig,
  PlayerId,
  PlayerSnapshot,
  PotResult,
  Street,
} from './types';

interface InternalPlayer {
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
  lastAction: PlayerSnapshot['lastAction'];
}

function cloneCard(card: Card): Card {
  return { ...card };
}

function assertInteger(value: number, label: string, allowZero = true): void {
  if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new Error(`${label} must be ${allowZero ? 'a non-negative' : 'a positive'} integer`);
  }
}

export class HoldemGame {
  private readonly players: InternalPlayer[];
  private readonly smallBlind: number;
  private readonly bigBlind: number;
  private readonly seed: string;
  private readonly initialDeck: Card[] | undefined;
  private deck: Card[] = [];
  private deckPosition = 0;
  private community: Card[] = [];
  private handNumber = 0;
  private phase: GamePhase = 'complete';
  private buttonIndex: number;
  private smallBlindIndex = 0;
  private bigBlindIndex = 0;
  private currentPlayerIndex: number | null = null;
  private currentBet = 0;
  private minimumRaise: number;
  private result: HandResult | null = null;

  constructor(options: HoldemGameOptions) {
    if (options.players.length < 2 || options.players.length > 9) {
      throw new Error('Texas Hold’em requires between 2 and 9 players');
    }
    const ids = new Set<string>();
    for (const player of options.players) {
      if (!player.id || ids.has(player.id)) throw new Error('Player ids must be non-empty and unique');
      assertInteger(player.chips, `Chips for ${player.id}`);
      ids.add(player.id);
    }
    this.smallBlind = options.smallBlind ?? 5;
    this.bigBlind = options.bigBlind ?? 10;
    assertInteger(this.smallBlind, 'Small blind', false);
    assertInteger(this.bigBlind, 'Big blind', false);
    if (this.bigBlind < this.smallBlind) throw new Error('Big blind cannot be smaller than small blind');
    this.seed = options.seed ?? 'riverlight';
    this.buttonIndex = options.buttonIndex ?? 0;
    assertInteger(this.buttonIndex, 'Button index');
    if (this.buttonIndex >= options.players.length) throw new Error('Button index is out of range');
    if (options.deck !== undefined) {
      assertValidDeck(options.deck);
      this.initialDeck = options.deck.map(cloneCard);
    }
    this.minimumRaise = this.bigBlind;
    this.players = options.players.map((player: PlayerConfig) => ({
      id: player.id,
      name: player.name ?? player.id,
      stack: player.chips,
      bet: 0,
      totalCommitted: 0,
      holeCards: [],
      inHand: false,
      folded: false,
      allIn: false,
      eliminated: player.chips === 0,
      hasActed: false,
      lastAction: null,
    }));
    if (this.activePlayerCount() < 2) throw new Error('At least two players need chips');
    this.buttonIndex = this.findActiveFrom(this.buttonIndex, true);
    this.startHand();
  }

  getSnapshot(viewerId?: PlayerId): GameSnapshot {
    if (viewerId !== undefined) this.playerIndex(viewerId);
    const currentPlayerId = this.currentPlayerIndex === null
      ? null
      : this.players[this.currentPlayerIndex]?.id ?? null;
    const players = this.players.map((player) => this.playerSnapshot(player, viewerId));
    return {
      handNumber: this.handNumber,
      phase: this.phase,
      buttonIndex: this.buttonIndex,
      smallBlindIndex: this.smallBlindIndex,
      bigBlindIndex: this.bigBlindIndex,
      currentPlayerId,
      currentBet: this.currentBet,
      minimumRaise: this.minimumRaise,
      pot: this.pot(),
      community: this.community.map(cloneCard),
      players,
      result: this.result === null ? null : {
        reason: this.result.reason,
        winnerIds: [...this.result.winnerIds],
        payouts: { ...this.result.payouts },
        pots: this.result.pots.map((pot) => ({
          amount: pot.amount,
          contributorIds: [...pot.contributorIds],
          eligiblePlayerIds: [...pot.eligiblePlayerIds],
          winnerIds: [...pot.winnerIds],
        })),
      },
      viewerId: viewerId ?? null,
      legalActions: viewerId === undefined ? null : this.legalActions(viewerId),
    };
  }

  legalActions(playerId: PlayerId): LegalActions {
    const index = this.playerIndex(playerId);
    const player = this.players[index];
    if (player === undefined) throw new Error(`Unknown player: ${playerId}`);
    const amountToCall = Math.max(0, this.currentBet - player.bet);
    const callAmount = Math.min(player.stack, amountToCall);
    const canAct = this.currentPlayerIndex === index && this.isBettingPhase();
    const hasOpponentWhoCanRespond = this.players.some((other) =>
      other.id !== player.id && other.inHand && !other.folded && !other.allIn && other.stack > 0,
    );
    const maxBetTo = player.bet + player.stack;
    const minimumRaiseTo = this.currentBet + this.minimumRaise;
    return {
      playerId,
      canAct,
      canFold: canAct,
      canCheck: canAct && amountToCall === 0,
      canCall: canAct && amountToCall > 0,
      canBet: canAct && this.currentBet === 0 && player.stack >= this.bigBlind && hasOpponentWhoCanRespond,
      canRaise: canAct && this.currentBet > 0 && !player.hasActed && maxBetTo >= minimumRaiseTo && hasOpponentWhoCanRespond,
      canAllIn: canAct && player.stack > 0,
      amountToCall,
      callAmount,
      minBet: canAct && this.currentBet === 0 ? this.bigBlind : null,
      minRaiseTo: canAct && this.currentBet > 0 ? minimumRaiseTo : null,
      maxBetTo,
      allInAmount: player.stack,
    };
  }

  act(playerId: PlayerId, action: PlayerAction): GameSnapshot {
    const index = this.playerIndex(playerId);
    const player = this.players[index];
    if (player === undefined) throw new Error(`Unknown player: ${playerId}`);
    const legal = this.legalActions(playerId);
    if (!legal.canAct) throw new Error(`Player ${playerId} cannot act now`);

    switch (action.type) {
      case 'fold':
        player.folded = true;
        break;
      case 'check':
        if (!legal.canCheck) throw new Error('Check is not legal when chips are owed');
        break;
      case 'call': {
        if (!legal.canCall) throw new Error('Call is not legal when no chips are owed');
        this.applyWager(player, player.bet + legal.callAmount);
        break;
      }
      case 'bet': {
        this.assertActionAmount(action.amount);
        if (!legal.canBet) throw new Error('Bet is not legal in the current betting state');
        if (action.amount < this.bigBlind || action.amount > legal.maxBetTo) {
          throw new Error(`Bet must be between ${this.bigBlind} and ${legal.maxBetTo}`);
        }
        this.applyWager(player, action.amount);
        this.currentBet = action.amount;
        this.minimumRaise = action.amount;
        this.resetOtherPlayersActions(player.id);
        break;
      }
      case 'raise': {
        this.assertActionAmount(action.amount);
        if (!legal.canRaise) throw new Error('Raise is not legal in the current betting state');
        if (legal.minRaiseTo === null || action.amount < legal.minRaiseTo || action.amount > legal.maxBetTo) {
          throw new Error(`Raise must be between ${String(legal.minRaiseTo)} and ${legal.maxBetTo}`);
        }
        const raiseSize = action.amount - this.currentBet;
        this.applyWager(player, action.amount);
        this.currentBet = action.amount;
        this.minimumRaise = raiseSize;
        this.resetOtherPlayersActions(player.id);
        break;
      }
      case 'all-in': {
        if (!legal.canAllIn) throw new Error('All-in is not legal in the current betting state');
        const target = player.bet + player.stack;
        const previousBet = this.currentBet;
        this.applyWager(player, target);
        if (target > previousBet) {
          const increase = target - previousBet;
          this.currentBet = target;
          if (previousBet === 0) {
            if (target >= this.bigBlind) this.minimumRaise = target;
            this.resetOtherPlayersActions(player.id);
          } else if (increase >= this.minimumRaise) {
            this.minimumRaise = increase;
            this.resetOtherPlayersActions(player.id);
          }
        }
        break;
      }
    }
    player.hasActed = true;
    player.lastAction = action.type;
    this.advanceAfterAction(index);
    return this.getSnapshot(playerId);
  }

  startNextHand(viewerId?: PlayerId, deck?: Card[]): GameSnapshot {
    if (viewerId !== undefined) this.playerIndex(viewerId);
    if (deck !== undefined) assertValidDeck(deck);
    if (this.result === null) throw new Error('The current hand is still in progress');
    if (this.activePlayerCount() < 2) throw new Error('At least two players with chips are required');
    this.buttonIndex = this.findActiveFrom(this.buttonIndex, false);
    this.startHand(deck);
    return this.getSnapshot(viewerId);
  }

  private playerSnapshot(player: InternalPlayer, viewerId: PlayerId | undefined): PlayerSnapshot {
    const revealAtShowdown = this.result?.reason === 'showdown' && player.inHand && !player.folded;
    return {
      id: player.id,
      name: player.name,
      stack: player.stack,
      bet: player.bet,
      totalCommitted: player.totalCommitted,
      holeCards: player.id === viewerId || revealAtShowdown ? player.holeCards.map(cloneCard) : [],
      inHand: player.inHand,
      folded: player.folded,
      allIn: player.allIn,
      eliminated: player.eliminated,
      hasActed: player.hasActed,
      lastAction: player.lastAction,
    };
  }

  private playerIndex(playerId: PlayerId): number {
    const index = this.players.findIndex((player) => player.id === playerId);
    if (index < 0) throw new Error(`Unknown player: ${playerId}`);
    return index;
  }

  private activePlayerCount(): number {
    return this.players.filter((player) => player.stack > 0).length;
  }

  private findActiveFrom(index: number, includeCurrent: boolean): number {
    const firstOffset = includeCurrent ? 0 : 1;
    for (let offset = firstOffset; offset < this.players.length + firstOffset; offset += 1) {
      const candidate = (index + offset) % this.players.length;
      if ((this.players[candidate]?.stack ?? 0) > 0) return candidate;
    }
    throw new Error('No active player found');
  }

  private startHand(injectedDeck?: Card[]): void {
    this.handNumber += 1;
    this.phase = 'preflop';
    this.result = null;
    this.community = [];
    this.deck = injectedDeck !== undefined
      ? injectedDeck.map(cloneCard)
      : this.handNumber === 1 && this.initialDeck !== undefined
        ? this.initialDeck.map(cloneCard)
        : createShuffledDeck(`${this.seed}:hand:${this.handNumber}`);
    this.deckPosition = 0;
    this.currentBet = this.bigBlind;
    this.minimumRaise = this.bigBlind;
    this.currentPlayerIndex = null;

    for (const player of this.players) {
      player.eliminated = player.stack === 0;
      player.inHand = !player.eliminated;
      player.bet = 0;
      player.totalCommitted = 0;
      player.holeCards = [];
      player.folded = false;
      player.allIn = false;
      player.hasActed = false;
      player.lastAction = null;
    }

    this.smallBlindIndex = this.activePlayerCount() === 2
      ? this.buttonIndex
      : this.findActiveFrom(this.buttonIndex, false);
    this.bigBlindIndex = this.findActiveFrom(this.smallBlindIndex, false);
    for (let round = 0; round < 2; round += 1) {
      for (let offset = 0; offset < this.players.length; offset += 1) {
        const index = (this.smallBlindIndex + offset) % this.players.length;
        const player = this.players[index];
        if (player?.inHand) player.holeCards.push(this.draw());
      }
    }
    const smallBlindPlayer = this.players[this.smallBlindIndex];
    const bigBlindPlayer = this.players[this.bigBlindIndex];
    if (smallBlindPlayer === undefined || bigBlindPlayer === undefined) throw new Error('Unable to assign blinds');
    this.postBlind(smallBlindPlayer, this.smallBlind);
    this.postBlind(bigBlindPlayer, this.bigBlind);

    const next = this.findNextActor(this.bigBlindIndex);
    if (next === null) this.advanceStreet();
    else this.currentPlayerIndex = next;
  }

  private postBlind(player: InternalPlayer, blind: number): void {
    const amount = Math.min(player.stack, blind);
    this.applyWager(player, amount);
  }

  private draw(): Card {
    const card = this.deck[this.deckPosition];
    if (card === undefined) throw new Error('Deck exhausted');
    this.deckPosition += 1;
    return card;
  }

  private burn(): void {
    this.draw();
  }

  private applyWager(player: InternalPlayer, target: number): void {
    const amount = target - player.bet;
    if (amount < 0 || amount > player.stack) throw new Error('Invalid wager amount');
    player.stack -= amount;
    player.bet = target;
    player.totalCommitted += amount;
    if (player.stack === 0) player.allIn = true;
  }

  private resetOtherPlayersActions(playerId: PlayerId): void {
    for (const player of this.players) {
      if (player.id !== playerId && player.inHand && !player.folded && !player.allIn) {
        player.hasActed = false;
      }
    }
  }

  private assertActionAmount(amount: number): void {
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Action amount must be a positive integer');
  }

  private isBettingPhase(): boolean {
    return this.phase === 'preflop' || this.phase === 'flop' || this.phase === 'turn' || this.phase === 'river';
  }

  private livePlayers(): InternalPlayer[] {
    return this.players.filter((player) => player.inHand && !player.folded);
  }

  private findNextActor(afterIndex: number): number | null {
    const live = this.livePlayers();
    const actionable = live.filter((player) => !player.allIn && player.stack > 0);
    if (actionable.length === 0) return null;
    if (actionable.length === 1) {
      const only = actionable[0];
      if (only === undefined || only.bet >= this.currentBet) return null;
      return this.playerIndex(only.id);
    }
    for (let offset = 1; offset <= this.players.length; offset += 1) {
      const index = (afterIndex + offset) % this.players.length;
      const player = this.players[index];
      if (player !== undefined && player.inHand && !player.folded && !player.allIn && player.stack > 0) {
        if (!player.hasActed || player.bet < this.currentBet) return index;
      }
    }
    return null;
  }

  private advanceAfterAction(actorIndex: number): void {
    if (this.livePlayers().length === 1) {
      this.phase = 'complete';
      this.awardPots('fold');
      return;
    }
    const next = this.findNextActor(actorIndex);
    if (next === null) this.advanceStreet();
    else this.currentPlayerIndex = next;
  }

  private advanceStreet(): void {
    for (const player of this.players) {
      player.bet = 0;
      player.hasActed = false;
    }
    this.currentBet = 0;
    this.minimumRaise = this.bigBlind;
    this.currentPlayerIndex = null;

    if (this.phase === 'river') {
      this.phase = 'showdown';
      this.awardPots('showdown');
      return;
    }
    if (this.phase === 'preflop') {
      this.phase = 'flop';
      this.burn();
      this.community.push(this.draw(), this.draw(), this.draw());
    } else if (this.phase === 'flop') {
      this.phase = 'turn';
      this.burn();
      this.community.push(this.draw());
    } else if (this.phase === 'turn') {
      this.phase = 'river';
      this.burn();
      this.community.push(this.draw());
    } else {
      throw new Error('Cannot advance the current phase');
    }

    const next = this.findNextActor(this.buttonIndex);
    if (next === null) this.advanceStreet();
    else this.currentPlayerIndex = next;
  }

  private buildPots(): PotResult[] {
    const contributors = this.players.filter((player) => player.inHand && player.totalCommitted > 0);
    const levels = [...new Set(contributors.map((player) => player.totalCommitted))].sort((a, b) => a - b);
    const pots: PotResult[] = [];
    let previous = 0;
    for (const level of levels) {
      const levelContributors = contributors.filter((player) => player.totalCommitted >= level);
      const amount = (level - previous) * levelContributors.length;
      const eligiblePlayerIds = levelContributors.filter((player) => !player.folded).map((player) => player.id);
      if (amount > 0) {
        pots.push({
          amount,
          contributorIds: levelContributors.map((player) => player.id),
          eligiblePlayerIds,
          winnerIds: [],
        });
      }
      previous = level;
    }
    return pots;
  }

  private awardPots(reason: HandResult['reason']): void {
    const pots = this.buildPots();
    const evaluations = new Map<PlayerId, HandEvaluation>();
    if (reason === 'showdown') {
      for (const player of this.livePlayers()) {
        evaluations.set(player.id, evaluateHand([...player.holeCards, ...this.community]));
      }
    }
    const payouts: Record<PlayerId, number> = {};
    const addPayout = (playerId: PlayerId, amount: number): void => {
      payouts[playerId] = (payouts[playerId] ?? 0) + amount;
      const player = this.players[this.playerIndex(playerId)];
      if (player !== undefined) player.stack += amount;
    };

    for (const pot of pots) {
      let winners: PlayerId[];
      if (reason === 'fold') {
        winners = [...pot.eligiblePlayerIds];
      } else {
        let best: HandEvaluation | null = null;
        winners = [];
        for (const playerId of pot.eligiblePlayerIds) {
          const evaluation = evaluations.get(playerId);
          if (evaluation === undefined) continue;
          const comparison = best === null ? 1 : compareEvaluations(evaluation, best);
          if (comparison > 0) {
            best = evaluation;
            winners = [playerId];
          } else if (comparison === 0) {
            winners.push(playerId);
          }
        }
      }
      if (winners.length === 0) throw new Error('A pot has no eligible winner');
      pot.winnerIds = winners;
      const share = Math.floor(pot.amount / winners.length);
      for (const winner of winners) addPayout(winner, share);
      const remainder = pot.amount % winners.length;
      const oddChipOrder = this.clockwiseFromButton().filter((playerId) => winners.includes(playerId));
      for (let index = 0; index < remainder; index += 1) {
        const winner = oddChipOrder[index];
        if (winner !== undefined) addPayout(winner, 1);
      }
    }

    this.currentPlayerIndex = null;
    for (const player of this.players) {
      if (player.stack === 0) player.eliminated = true;
    }
    this.result = {
      reason,
      winnerIds: this.players.filter((player) => (payouts[player.id] ?? 0) > 0).map((player) => player.id),
      payouts,
      pots,
    };
  }

  private clockwiseFromButton(): PlayerId[] {
    const ids: PlayerId[] = [];
    for (let offset = 1; offset <= this.players.length; offset += 1) {
      const player = this.players[(this.buttonIndex + offset) % this.players.length];
      if (player !== undefined) ids.push(player.id);
    }
    return ids;
  }

  private pot(): number {
    return this.players.reduce((sum, player) => sum + player.totalCommitted, 0);
  }
}
