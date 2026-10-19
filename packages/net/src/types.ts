import type { NetError } from "./errors";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ActionMessage {
  type: "action";
  action: string;
  payload?: JsonValue;
}

export interface ChatMessage {
  type: "chat";
  text: string;
}

export interface DataMessage {
  type: "data";
  data: JsonValue;
}

export type RoomMessage = ActionMessage | ChatMessage | DataMessage;

export interface RoomOptions {
  password?: string;
  rtcConfiguration?: RTCConfiguration;
}

export interface HostRoomEvents {
  connect: (peerId: string) => void;
  disconnect: (peerId: string) => void;
  message: (peerId: string, message: RoomMessage) => void;
  action: (peerId: string, message: ActionMessage) => void;
  chat: (peerId: string, message: ChatMessage) => void;
  error: (error: NetError, peerId: string) => void;
}

export interface GuestRoomEvents {
  connect: () => void;
  disconnect: () => void;
  message: (message: RoomMessage) => void;
  action: (message: ActionMessage) => void;
  chat: (message: ChatMessage) => void;
  error: (error: NetError) => void;
}
