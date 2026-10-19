import { NetError } from "./errors";
import type { JsonValue, RoomMessage } from "./types";

export const MAX_ROOM_MESSAGE_LENGTH = 65_536;

function invalidMessage(): never {
  throw new NetError("INVALID_MESSAGE", "Invalid room message");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertKeys(record: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(record).some((key) => !allowed.includes(key))) {
    invalidMessage();
  }
}

function normalizeMessage(value: unknown): RoomMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    return invalidMessage();
  }

  if (value.type === "action") {
    assertKeys(value, ["type", "action", "payload"]);
    if (typeof value.action !== "string" || value.action.length === 0) {
      return invalidMessage();
    }
    if ("payload" in value) {
      return {
        type: "action",
        action: value.action,
        payload: value.payload as JsonValue,
      };
    }
    return { type: "action", action: value.action };
  }

  if (value.type === "chat") {
    assertKeys(value, ["type", "text"]);
    if (typeof value.text !== "string") {
      return invalidMessage();
    }
    return { type: "chat", text: value.text };
  }

  if (value.type === "data") {
    assertKeys(value, ["type", "data"]);
    if (!("data" in value)) {
      return invalidMessage();
    }
    return { type: "data", data: value.data as JsonValue };
  }

  return invalidMessage();
}

export function encodeRoomMessage(message: RoomMessage): string {
  const normalized = normalizeMessage(message);
  let encoded: string;
  try {
    encoded = JSON.stringify(normalized);
  } catch {
    return invalidMessage();
  }
  if (encoded.length > MAX_ROOM_MESSAGE_LENGTH) {
    throw new NetError("INVALID_MESSAGE", "Room message is too large");
  }
  return encoded;
}

export function decodeRoomMessage(encoded: string): RoomMessage {
  if (typeof encoded !== "string" || encoded.length > MAX_ROOM_MESSAGE_LENGTH) {
    return invalidMessage();
  }
  let value: unknown;
  try {
    value = JSON.parse(encoded);
  } catch {
    return invalidMessage();
  }
  return normalizeMessage(value);
}
