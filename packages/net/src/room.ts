import {
  createPeerId,
  createRoomPasswordProof,
  decodeAnswerCode,
  decodeInviteCode,
  encodeAnswerCode,
  encodeInviteCode,
  verifyRoomPasswordProof,
} from "./codec";
import { NetError } from "./errors";
import { decodeRoomMessage, encodeRoomMessage } from "./protocol";
import type {
  GuestRoomEvents,
  HostRoomEvents,
  RoomMessage,
  RoomOptions,
} from "./types";

export const MAX_GUESTS = 8;

type Handler = (...args: any[]) => void;

class Emitter<Events extends Record<keyof Events, Handler>> {
  private readonly listeners = new Map<keyof Events, Set<Handler>>();

  on<Event extends keyof Events>(event: Event, listener: Events[Event]): () => void {
    let listeners = this.listeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(event, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  emit<Event extends keyof Events>(
    event: Event,
    ...args: Events[Event] extends (...args: infer Parameters) => void ? Parameters : never
  ): void {
    const listeners = this.listeners.get(event);
    if (!listeners) {
      return;
    }
    for (const listener of [...listeners]) {
      listener(...args);
    }
  }
}

interface Peer {
  id: string;
  connection: RTCPeerConnection;
  channel: RTCDataChannel;
  status: "pending" | "connecting" | "connected";
  connected: boolean;
  disposed: boolean;
}

interface GuestState {
  id: string;
  connection: RTCPeerConnection;
  channel: RTCDataChannel | null;
  connected: boolean;
  disposed: boolean;
}

function createConnection(configuration: RTCConfiguration | undefined): RTCPeerConnection {
  if (typeof globalThis.RTCPeerConnection === "undefined") {
    throw new NetError("WEBRTC_UNAVAILABLE", "RTCPeerConnection is unavailable");
  }
  return configuration === undefined
    ? new RTCPeerConnection()
    : new RTCPeerConnection(configuration);
}

function localSdp(connection: RTCPeerConnection): string {
  const description = connection.localDescription;
  if (!description?.sdp) {
    throw new NetError("SIGNALING_FAILED", "Missing local session description");
  }
  return description.sdp;
}

async function waitForIceGathering(connection: RTCPeerConnection): Promise<void> {
  if (connection.iceGatheringState === "complete") {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      connection.removeEventListener("icegatheringstatechange", checkGathering);
      connection.removeEventListener("connectionstatechange", checkConnection);
    };
    const checkGathering = () => {
      if (connection.iceGatheringState === "complete") {
        cleanup();
        resolve();
      }
    };
    const checkConnection = () => {
      if (connection.connectionState === "closed" || connection.connectionState === "failed") {
        cleanup();
        reject(new NetError("SIGNALING_FAILED", "Peer connection closed during ICE gathering"));
      }
    };
    connection.addEventListener("icegatheringstatechange", checkGathering);
    connection.addEventListener("connectionstatechange", checkConnection);
    checkGathering();
  });
}

function asNetError(error: unknown): NetError {
  return error instanceof NetError
    ? error
    : new NetError("INVALID_MESSAGE", "Invalid room message");
}

export class HostRoom {
  private readonly emitter = new Emitter<HostRoomEvents>();
  private readonly peers = new Map<string, Peer>();
  private readonly password: string | undefined;
  private readonly rtcConfiguration: RTCConfiguration | undefined;
  private closed = false;

  constructor(options: RoomOptions = {}) {
    this.password = options.password || undefined;
    this.rtcConfiguration = options.rtcConfiguration;
  }

  get guestCount(): number {
    return this.peers.size;
  }

  on<Event extends keyof HostRoomEvents>(event: Event, listener: HostRoomEvents[Event]): () => void {
    return this.emitter.on(event, listener);
  }

  async createInvite(): Promise<string> {
    this.assertOpen();
    if (this.peers.size >= MAX_GUESTS) {
      throw new NetError("ROOM_FULL", `A room supports at most ${MAX_GUESTS} guests`);
    }

    const id = createPeerId();
    const connection = createConnection(this.rtcConfiguration);
    const channel = connection.createDataChannel("riverlight", { ordered: true });
    const peer: Peer = {
      id,
      connection,
      channel,
      status: "pending",
      connected: false,
      disposed: false,
    };
    this.peers.set(id, peer);
    this.attachPeer(peer);

    try {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      await waitForIceGathering(connection);
      this.assertOpen();
      return encodeInviteCode({
        v: 1,
        kind: "invite",
        id,
        protected: this.password !== undefined,
        sdp: localSdp(connection),
      });
    } catch (error) {
      this.disposePeer(peer, false);
      throw error;
    }
  }

  async acceptAnswer(code: string): Promise<string> {
    this.assertOpen();
    const answer = decodeAnswerCode(code);
    const peer = this.peers.get(answer.id);
    if (!peer) {
      throw new NetError("UNKNOWN_PEER", "Answer does not match a pending invite");
    }
    if (peer.status !== "pending") {
      throw new NetError("INVITE_ALREADY_USED", "Invite has already been accepted");
    }
    if (this.password !== undefined) {
      if (!answer.proof || !(await verifyRoomPasswordProof(answer.id, this.password, answer.proof))) {
        throw new NetError("INVALID_PASSWORD", "Room password proof does not match");
      }
    } else if (answer.proof) {
      throw new NetError("INVALID_PASSWORD", "Unexpected password proof for an open room");
    }

    this.assertOpen();
    if (peer.disposed) {
      throw new NetError("UNKNOWN_PEER", "Answer does not match a pending invite");
    }
    if (peer.status !== "pending") {
      throw new NetError("INVITE_ALREADY_USED", "Invite has already been accepted");
    }
    peer.status = "connecting";
    try {
      await peer.connection.setRemoteDescription({ type: "answer", sdp: answer.sdp });
      return peer.id;
    } catch (error) {
      this.disposePeer(peer, false);
      throw error;
    }
  }

  send(peerId: string, message: RoomMessage): void {
    this.assertOpen();
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new NetError("UNKNOWN_PEER", "Unknown guest");
    }
    const encoded = encodeRoomMessage(message);
    if (peer.channel.readyState !== "open") {
      throw new NetError("NOT_CONNECTED", "Guest data channel is not open");
    }
    peer.channel.send(encoded);
  }

  broadcast(message: RoomMessage): number {
    this.assertOpen();
    const encoded = encodeRoomMessage(message);
    let sent = 0;
    for (const peer of this.peers.values()) {
      if (peer.channel.readyState === "open") {
        peer.channel.send(encoded);
        sent += 1;
      }
    }
    return sent;
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const peer of [...this.peers.values()]) {
      this.disposePeer(peer, true);
    }
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new NetError("CLOSED", "Room is closed");
    }
  }

  private attachPeer(peer: Peer): void {
    peer.channel.onopen = () => {
      if (peer.disposed) {
        return;
      }
      peer.status = "connected";
      peer.connected = true;
      this.emitter.emit("connect", peer.id);
    };
    peer.channel.onclose = () => {
      this.disposePeer(peer, true);
    };
    peer.channel.onmessage = (event) => {
      if (peer.disposed) {
        return;
      }
      try {
        const message = decodeRoomMessage(event.data as string);
        this.emitter.emit("message", peer.id, message);
        if (message.type === "action") {
          this.emitter.emit("action", peer.id, message);
        } else if (message.type === "chat") {
          this.emitter.emit("chat", peer.id, message);
        }
      } catch (error) {
        this.emitter.emit("error", asNetError(error), peer.id);
      }
    };
    peer.connection.addEventListener("connectionstatechange", () => {
      if (peer.connection.connectionState === "failed" || peer.connection.connectionState === "closed") {
        this.disposePeer(peer, true);
      }
    });
  }

  private disposePeer(peer: Peer, notify: boolean): void {
    if (peer.disposed) {
      return;
    }
    peer.disposed = true;
    peer.channel.onopen = null;
    peer.channel.onclose = null;
    peer.channel.onmessage = null;
    this.peers.delete(peer.id);
    const wasConnected = peer.connected;
    peer.connected = false;
    try {
      peer.channel.close();
    } finally {
      peer.connection.close();
    }
    if (notify && wasConnected) {
      this.emitter.emit("disconnect", peer.id);
    }
  }
}

export class GuestRoom {
  private readonly emitter = new Emitter<GuestRoomEvents>();
  private readonly password: string | undefined;
  private readonly rtcConfiguration: RTCConfiguration | undefined;
  private state: GuestState | null = null;
  private closed = false;

  constructor(options: RoomOptions = {}) {
    this.password = options.password || undefined;
    this.rtcConfiguration = options.rtcConfiguration;
  }

  get connected(): boolean {
    return this.state?.connected ?? false;
  }

  on<Event extends keyof GuestRoomEvents>(event: Event, listener: GuestRoomEvents[Event]): () => void {
    return this.emitter.on(event, listener);
  }

  async createAnswer(inviteCode: string): Promise<string> {
    this.assertOpen();
    if (this.state) {
      throw new NetError("ALREADY_ACTIVE", "Guest already has a pending or active connection");
    }
    const invite = decodeInviteCode(inviteCode);
    if (invite.protected && this.password === undefined) {
      throw new NetError("PASSWORD_REQUIRED", "This room requires a password");
    }

    const connection = createConnection(this.rtcConfiguration);
    const state: GuestState = {
      id: invite.id,
      connection,
      channel: null,
      connected: false,
      disposed: false,
    };
    this.state = state;
    connection.ondatachannel = (event) => {
      this.attachChannel(state, event.channel);
    };
    connection.addEventListener("connectionstatechange", () => {
      if (connection.connectionState === "failed" || connection.connectionState === "closed") {
        this.dispose(state, true);
      }
    });

    try {
      const proof = this.password === undefined
        ? undefined
        : await createRoomPasswordProof(invite.id, this.password);
      await connection.setRemoteDescription({ type: "offer", sdp: invite.sdp });
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      await waitForIceGathering(connection);
      this.assertOpen();
      return encodeAnswerCode({
        v: 1,
        kind: "answer",
        id: invite.id,
        ...(proof === undefined ? {} : { proof }),
        sdp: localSdp(connection),
      });
    } catch (error) {
      this.dispose(state, false);
      throw error;
    }
  }

  send(message: RoomMessage): void {
    this.assertOpen();
    const encoded = encodeRoomMessage(message);
    const channel = this.state?.channel;
    if (!channel || channel.readyState !== "open") {
      throw new NetError("NOT_CONNECTED", "Host data channel is not open");
    }
    channel.send(encoded);
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    if (this.state) {
      this.dispose(this.state, true);
    }
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new NetError("CLOSED", "Room is closed");
    }
  }

  private attachChannel(state: GuestState, channel: RTCDataChannel): void {
    if (state.disposed || this.state !== state) {
      channel.close();
      return;
    }
    if (state.channel && state.channel !== channel) {
      channel.close();
      return;
    }
    state.channel = channel;
    channel.onopen = () => {
      if (state.disposed) {
        return;
      }
      state.connected = true;
      this.emitter.emit("connect");
    };
    channel.onclose = () => {
      this.dispose(state, true);
    };
    channel.onmessage = (event) => {
      if (state.disposed) {
        return;
      }
      try {
        const message = decodeRoomMessage(event.data as string);
        this.emitter.emit("message", message);
        if (message.type === "action") {
          this.emitter.emit("action", message);
        } else if (message.type === "chat") {
          this.emitter.emit("chat", message);
        }
      } catch (error) {
        this.emitter.emit("error", asNetError(error));
      }
    };
  }

  private dispose(state: GuestState, notify: boolean): void {
    if (state.disposed) {
      return;
    }
    state.disposed = true;
    if (state.channel) {
      state.channel.onopen = null;
      state.channel.onclose = null;
      state.channel.onmessage = null;
    }
    if (this.state === state) {
      this.state = null;
    }
    const wasConnected = state.connected;
    state.connected = false;
    try {
      state.channel?.close();
    } finally {
      state.connection.close();
    }
    if (notify && wasConnected) {
      this.emitter.emit("disconnect");
    }
  }
}
