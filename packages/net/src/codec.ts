import { NetError } from "./errors";

export const SIGNAL_VERSION = 1;
export const MAX_SIGNAL_CODE_LENGTH = 65_536;

export interface InviteSignal {
  v: typeof SIGNAL_VERSION;
  kind: "invite";
  id: string;
  protected: boolean;
  sdp: string;
}

export interface AnswerSignal {
  v: typeof SIGNAL_VERSION;
  kind: "answer";
  id: string;
  proof?: string;
  sdp: string;
}

export type Signal = InviteSignal | AnswerSignal;

function invalidCode(): never {
  throw new NetError("INVALID_CODE", "Malformed signaling code");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertKeys(record: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(record).some((key) => !allowed.includes(key))) {
    invalidCode();
  }
}

function assertCommon(value: Record<string, unknown>): void {
  if (value.v !== SIGNAL_VERSION) {
    if (typeof value.v === "number") {
      throw new NetError("UNSUPPORTED_VERSION", "Unsupported signaling code version");
    }
    invalidCode();
  }
  if (typeof value.id !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(value.id)) {
    invalidCode();
  }
  if (typeof value.sdp !== "string" || value.sdp.length === 0 || value.sdp.length > MAX_SIGNAL_CODE_LENGTH) {
    invalidCode();
  }
}

function normalizeInvite(value: unknown): InviteSignal {
  if (!isRecord(value) || value.kind !== "invite") {
    return invalidCode();
  }
  assertKeys(value, ["v", "kind", "id", "protected", "sdp"]);
  assertCommon(value);
  if (typeof value.protected !== "boolean") {
    invalidCode();
  }
  return {
    v: SIGNAL_VERSION,
    kind: "invite",
    id: value.id as string,
    protected: value.protected,
    sdp: value.sdp as string,
  };
}

function normalizeAnswer(value: unknown): AnswerSignal {
  if (!isRecord(value) || value.kind !== "answer") {
    return invalidCode();
  }
  assertKeys(value, ["v", "kind", "id", "proof", "sdp"]);
  assertCommon(value);
  if ("proof" in value && (typeof value.proof !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value.proof))) {
    invalidCode();
  }
  const answer: AnswerSignal = {
    v: SIGNAL_VERSION,
    kind: "answer",
    id: value.id as string,
    sdp: value.sdp as string,
  };
  if (typeof value.proof === "string") {
    answer.proof = value.proof;
  }
  return answer;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8_192) {
    const chunk = bytes.subarray(offset, offset + 8_192);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(encoded: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/u.test(encoded) || encoded.length % 4 === 1) {
    return invalidCode();
  }
  const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
  try {
    const binary = atob(base64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return invalidCode();
  }
}

function encodeSignal(signal: Signal): string {
  const normalized = signal.kind === "invite" ? normalizeInvite(signal) : normalizeAnswer(signal);
  const json = JSON.stringify(normalized);
  if (json.length > MAX_SIGNAL_CODE_LENGTH) {
    throw new NetError("CODE_TOO_LARGE", "Signaling code is too large");
  }
  const encoded = bytesToBase64Url(new TextEncoder().encode(json));
  if (encoded.length > MAX_SIGNAL_CODE_LENGTH) {
    throw new NetError("CODE_TOO_LARGE", "Signaling code is too large");
  }
  return encoded;
}

function decodeSignal(code: string): Record<string, unknown> {
  if (typeof code !== "string" || code.length === 0) {
    return invalidCode();
  }
  if (code.length > MAX_SIGNAL_CODE_LENGTH) {
    throw new NetError("CODE_TOO_LARGE", "Signaling code is too large");
  }
  try {
    const bytes = base64UrlToBytes(code);
    const json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const value: unknown = JSON.parse(json);
    if (!isRecord(value)) {
      return invalidCode();
    }
    return value;
  } catch (error) {
    if (error instanceof NetError) {
      throw error;
    }
    return invalidCode();
  }
}

export function encodeInviteCode(signal: InviteSignal): string {
  return encodeSignal(signal);
}

export function encodeAnswerCode(signal: AnswerSignal): string {
  return encodeSignal(signal);
}

export function decodeSignalCode(code: string, kind: "invite"): InviteSignal;
export function decodeSignalCode(code: string, kind: "answer"): AnswerSignal;
export function decodeSignalCode(code: string, kind: Signal["kind"]): Signal {
  const value = decodeSignal(code);
  if (value.kind !== "invite" && value.kind !== "answer") {
    return invalidCode();
  }
  if (value.kind !== kind) {
    throw new NetError("WRONG_SIGNAL_KIND", `Expected ${kind} code`);
  }
  return kind === "invite" ? normalizeInvite(value) : normalizeAnswer(value);
}

export function decodeInviteCode(code: string): InviteSignal {
  return decodeSignalCode(code, "invite");
}

export function decodeAnswerCode(code: string): AnswerSignal {
  return decodeSignalCode(code, "answer");
}

function cryptoApi(): Crypto {
  if (!globalThis.crypto?.subtle || !globalThis.crypto.getRandomValues) {
    throw new NetError("WEBCRYPTO_UNAVAILABLE", "WebCrypto is unavailable");
  }
  return globalThis.crypto;
}

export function createPeerId(): string {
  const bytes = new Uint8Array(16);
  cryptoApi().getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function createRoomPasswordProof(roomId: string, password: string): Promise<string> {
  const input = new TextEncoder().encode(`riverlight:room-password:v1\0${roomId}\0${password}`);
  const digest = await cryptoApi().subtle.digest("SHA-256", input);
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function verifyRoomPasswordProof(
  roomId: string,
  password: string,
  proof: string,
): Promise<boolean> {
  const expected = await createRoomPasswordProof(roomId, password);
  let difference = expected.length ^ proof.length;
  const length = Math.max(expected.length, proof.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (expected.charCodeAt(index) || 0) ^ (proof.charCodeAt(index) || 0);
  }
  return difference === 0;
}
