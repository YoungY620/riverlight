import type { DeckReveal, GameSnapshot, PlayerAction } from "@riverlight/engine";
import type { DataMessage, JsonValue, RoomMessage } from "@riverlight/net";

export const HOST_PLAYER_ID = "host";
export const MAX_ONLINE_CHAT_LENGTH = 280;

export interface OnlinePlayer {
  id: string;
  name: string;
  avatar: string;
}

export interface OnlineChat {
  id: string;
  author: string;
  text: string;
  system?: boolean;
}

export interface OnlineFairness {
  handNumber: number;
  commitment: string;
  reveal?: DeckReveal;
}

export type GuestToHostMessage =
  | { kind: "hello"; name: string; avatar: string }
  | { kind: "action"; action: PlayerAction }
  | { kind: "chat"; text: string };

export type HostToGuestMessage =
  | { kind: "lobby"; players: OnlinePlayer[] }
  | { kind: "snapshot"; snapshot: GameSnapshot }
  | ({ kind: "fairness" } & OnlineFairness)
  | { kind: "chat"; message: OnlineChat }
  | { kind: "log"; entries: string[] }
  | { kind: "error"; message: string };

export function toJsonValue(value: unknown, ancestors = new Set<object>()): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot encode a non-finite number");
    return value;
  }
  if (typeof value !== "object") throw new Error("Cannot encode a non-JSON value");
  if (ancestors.has(value)) throw new Error("Cannot encode a cyclic value");

  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.map((entry) => toJsonValue(entry, ancestors));
    const prototype = Object.getPrototypeOf(value) as object | null;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("Cannot encode a non-plain object");
    }
    const result: Record<string, JsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = toJsonValue(entry, ancestors);
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

export function encodeGuestMessage(message: GuestToHostMessage): DataMessage {
  return { type: "data", data: toJsonValue(message) };
}

export function encodeHostMessage(message: HostToGuestMessage): DataMessage {
  return { type: "data", data: toJsonValue(message) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function isActionType(value: unknown): boolean {
  return value === "fold" || value === "check" || value === "call" || value === "bet" || value === "raise" || value === "all-in";
}

function isPlayerAction(value: unknown): value is PlayerAction {
  if (!isRecord(value) || !isActionType(value.type)) return false;
  if (value.type === "bet" || value.type === "raise") return isPositiveInteger(value.amount);
  return value.type === "fold" || value.type === "check" || value.type === "call" || value.type === "all-in";
}

function isCard(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isPositiveInteger(value.rank) && value.rank >= 2 && value.rank <= 14
    && (value.suit === "c" || value.suit === "d" || value.suit === "h" || value.suit === "s");
}

function isPlayerSnapshot(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0
    && typeof value.name === "string"
    && isNonNegativeInteger(value.stack)
    && isNonNegativeInteger(value.bet)
    && isNonNegativeInteger(value.totalCommitted)
    && Array.isArray(value.holeCards) && value.holeCards.length <= 2 && value.holeCards.every(isCard)
    && typeof value.inHand === "boolean"
    && typeof value.folded === "boolean"
    && typeof value.allIn === "boolean"
    && typeof value.eliminated === "boolean"
    && typeof value.hasActed === "boolean"
    && (value.lastAction === null || isActionType(value.lastAction));
}

function isLegalActions(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.playerId === "string" && value.playerId.length > 0
    && typeof value.canAct === "boolean"
    && typeof value.canFold === "boolean"
    && typeof value.canCheck === "boolean"
    && typeof value.canCall === "boolean"
    && typeof value.canBet === "boolean"
    && typeof value.canRaise === "boolean"
    && typeof value.canAllIn === "boolean"
    && isNonNegativeInteger(value.amountToCall)
    && isNonNegativeInteger(value.callAmount)
    && (value.minBet === null || isPositiveInteger(value.minBet))
    && (value.minRaiseTo === null || isPositiveInteger(value.minRaiseTo))
    && isNonNegativeInteger(value.maxBetTo)
    && isNonNegativeInteger(value.allInAmount);
}

function isPotResult(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const stringArrays = [value.contributorIds, value.eligiblePlayerIds, value.winnerIds];
  return isNonNegativeInteger(value.amount)
    && stringArrays.every((entry) => Array.isArray(entry) && entry.length <= 9 && entry.every((id) => typeof id === "string"));
}

function isHandResult(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (value.reason === "fold" || value.reason === "showdown")
    && Array.isArray(value.winnerIds) && value.winnerIds.length <= 9 && value.winnerIds.every((id) => typeof id === "string")
    && isRecord(value.payouts) && Object.values(value.payouts).every(isNonNegativeInteger)
    && Array.isArray(value.pots) && value.pots.every(isPotResult);
}

function isGameSnapshot(value: unknown): value is GameSnapshot {
  if (!isRecord(value)) return false;
  return isPositiveInteger(value.handNumber)
    && (value.phase === "preflop" || value.phase === "flop" || value.phase === "turn" || value.phase === "river" || value.phase === "showdown" || value.phase === "complete")
    && isNonNegativeInteger(value.buttonIndex)
    && isNonNegativeInteger(value.smallBlindIndex)
    && isNonNegativeInteger(value.bigBlindIndex)
    && (value.currentPlayerId === null || typeof value.currentPlayerId === "string")
    && isNonNegativeInteger(value.currentBet)
    && isNonNegativeInteger(value.minimumRaise)
    && isNonNegativeInteger(value.pot)
    && Array.isArray(value.community) && value.community.length <= 5 && value.community.every(isCard)
    && Array.isArray(value.players) && value.players.length >= 2 && value.players.length <= 9 && value.players.every(isPlayerSnapshot)
    && (value.result === null || isHandResult(value.result))
    && (value.viewerId === null || typeof value.viewerId === "string")
    && (value.legalActions === null || isLegalActions(value.legalActions));
}

function isDeckReveal(value: unknown): value is DeckReveal {
  if (!isRecord(value) || typeof value.secret !== "string" || !value.secret.trim() || value.secret.length > 256) return false;
  if (!Array.isArray(value.deck) || value.deck.length !== 52) return false;
  const cards = value.deck.map((card) => typeof card === "string" ? card.toLowerCase() : "");
  return cards.every((card) => /^(10|[2-9tjqka])[cdhs]$/.test(card)) && new Set(cards).size === 52;
}

function isOnlinePlayer(value: unknown): value is OnlinePlayer {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0 && value.id.length <= 128
    && typeof value.name === "string" && value.name.trim().length > 0 && value.name.length <= 64
    && typeof value.avatar === "string" && value.avatar.length > 0 && value.avatar.length <= 32;
}

function isOnlineChat(value: unknown): value is OnlineChat {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0 && value.id.length <= 128
    && typeof value.author === "string" && value.author.trim().length > 0 && value.author.length <= 64
    && typeof value.text === "string" && value.text.trim().length > 0 && value.text.length <= MAX_ONLINE_CHAT_LENGTH
    && (value.system === undefined || typeof value.system === "boolean");
}

function readFairness(value: Record<string, unknown>): OnlineFairness | null {
  if (!isPositiveInteger(value.handNumber) || typeof value.commitment !== "string" || !/^[0-9a-f]{64}$/i.test(value.commitment)) {
    return null;
  }
  const reveal = value.reveal;
  if (reveal !== undefined && !isDeckReveal(reveal)) return null;
  return {
    handNumber: value.handNumber,
    commitment: value.commitment,
    ...(reveal === undefined ? {} : { reveal }),
  };
}

export function decodeGuestMessage(message: RoomMessage): GuestToHostMessage | null {
  if (message.type !== "data" || !isRecord(message.data)) return null;
  const data = message.data;
  if (data.kind === "hello") {
    if (typeof data.name !== "string" || !data.name.trim() || data.name.length > 64
      || typeof data.avatar !== "string" || !data.avatar || data.avatar.length > 32) return null;
    return { kind: "hello", name: data.name, avatar: data.avatar };
  }
  if (data.kind === "action") {
    if (!isPlayerAction(data.action)) return null;
    return { kind: "action", action: data.action };
  }
  if (data.kind === "chat") {
    if (typeof data.text !== "string" || !data.text.trim() || data.text.length > MAX_ONLINE_CHAT_LENGTH) return null;
    return { kind: "chat", text: data.text };
  }
  return null;
}

export function decodeHostMessage(message: RoomMessage): HostToGuestMessage | null {
  if (message.type !== "data" || !isRecord(message.data)) return null;
  const data = message.data;
  if (data.kind === "lobby") {
    if (!Array.isArray(data.players) || data.players.length < 1 || data.players.length > 9) return null;
    const players: OnlinePlayer[] = [];
    for (const player of data.players) {
      if (!isOnlinePlayer(player)) return null;
      players.push(player);
    }
    return { kind: "lobby", players };
  }
  if (data.kind === "snapshot") {
    if (!isGameSnapshot(data.snapshot)) return null;
    return { kind: "snapshot", snapshot: data.snapshot };
  }
  if (data.kind === "fairness") {
    const fairness = readFairness(data);
    return fairness === null ? null : { kind: "fairness", ...fairness };
  }
  if (data.kind === "chat") {
    if (!isOnlineChat(data.message)) return null;
    return { kind: "chat", message: data.message };
  }
  if (data.kind === "log") {
    if (!Array.isArray(data.entries) || data.entries.length > 80
      || !data.entries.every((entry) => typeof entry === "string" && entry.length <= 500)) return null;
    return { kind: "log", entries: data.entries.filter((entry): entry is string => typeof entry === "string") };
  }
  if (data.kind === "error") {
    if (typeof data.message !== "string" || !data.message || data.message.length > 500) return null;
    return { kind: "error", message: data.message };
  }
  return null;
}
