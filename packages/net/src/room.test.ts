import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GuestRoom, HostRoom, MAX_GUESTS, decodeInviteCode } from "./index";
import type { ActionMessage, ChatMessage, RoomMessage, RoomOptions } from "./index";

interface FakeDescription {
  type: RTCSdpType;
  sdp: string;
}

class FakeDataChannel {
  readonly ordered: boolean;
  readyState: RTCDataChannelState = "connecting";
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  peer: FakeDataChannel | null = null;

  constructor(readonly label: string, init: RTCDataChannelInit = {}) {
    this.ordered = init.ordered ?? true;
  }

  send(data: string): void {
    if (this.readyState !== "open") {
      throw new Error("Channel is not open");
    }
    const peer = this.peer;
    queueMicrotask(() => {
      if (peer?.readyState === "open") {
        peer.onmessage?.({ data } as MessageEvent);
      }
    });
  }

  close(): void {
    const targets = this.peer ? [this, this.peer] : [this];
    for (const target of targets) {
      target.readyState = "closed";
    }
    queueMicrotask(() => {
      for (const target of targets) {
        target.onclose?.({ type: "close" } as Event);
      }
    });
  }
}

class FakePeerConnection {
  static instances: FakePeerConnection[] = [];
  private static offers = new Map<string, FakePeerConnection>();
  private static answers = new Map<string, FakePeerConnection>();
  private static nextId = 0;

  readonly id = ++FakePeerConnection.nextId;
  readonly configuration: RTCConfiguration | undefined;
  localDescription: FakeDescription | null = null;
  remoteDescription: FakeDescription | null = null;
  iceGatheringState: RTCIceGatheringState = "new";
  connectionState: RTCPeerConnectionState = "new";
  channel: FakeDataChannel | null = null;
  remote: FakePeerConnection | null = null;
  ondatachannel: ((event: { channel: FakeDataChannel }) => void) | null = null;
  private readonly listeners = new Map<string, Set<EventListener>>();

  constructor(configuration?: RTCConfiguration) {
    this.configuration = configuration;
    FakePeerConnection.instances.push(this);
  }

  static reset(): void {
    FakePeerConnection.instances = [];
    FakePeerConnection.offers.clear();
    FakePeerConnection.answers.clear();
    FakePeerConnection.nextId = 0;
  }

  createDataChannel(label: string, init: RTCDataChannelInit = {}): FakeDataChannel {
    this.channel = new FakeDataChannel(label, init);
    return this.channel;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: `offer-${this.id}` };
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: "answer", sdp: `answer-${this.id}-for-${this.remote?.id ?? "none"}` };
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!description.sdp) {
      throw new Error("Missing SDP");
    }
    const local = { type: description.type, sdp: `${description.sdp}\na=candidate:local-${this.id}` };
    this.localDescription = local;
    if (description.type === "offer") {
      FakePeerConnection.offers.set(local.sdp, this);
    } else if (description.type === "answer") {
      FakePeerConnection.answers.set(local.sdp, this);
    }
    this.iceGatheringState = "complete";
    this.dispatch("icegatheringstatechange");
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!description.sdp) {
      throw new Error("Missing SDP");
    }
    this.remoteDescription = { type: description.type, sdp: description.sdp };
    if (description.type === "offer") {
      const host = FakePeerConnection.offers.get(description.sdp);
      if (!host) {
        throw new Error("Unknown offer");
      }
      this.remote = host;
      return;
    }
    if (description.type === "answer") {
      const guest = FakePeerConnection.answers.get(description.sdp);
      if (!guest) {
        throw new Error("Unknown answer");
      }
      this.remote = guest;
      guest.remote = this;
      this.openChannels(guest);
    }
  }

  addEventListener(type: string, listener: EventListener): void {
    let listeners = this.listeners.get(type);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(type, listeners);
    }
    listeners.add(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    if (this.connectionState === "closed") {
      return;
    }
    this.connectionState = "closed";
    this.dispatch("connectionstatechange");
    this.channel?.close();
  }

  private dispatch(type: string): void {
    const event = { type } as Event;
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener(event);
    }
  }

  private openChannels(guest: FakePeerConnection): void {
    const hostChannel = this.channel;
    if (!hostChannel) {
      throw new Error("Host channel is missing");
    }
    const guestChannel = new FakeDataChannel(hostChannel.label, { ordered: hostChannel.ordered });
    guest.channel = guestChannel;
    hostChannel.peer = guestChannel;
    guestChannel.peer = hostChannel;
    guest.ondatachannel?.({ channel: guestChannel });
    queueMicrotask(() => {
      if (hostChannel.readyState === "closed" || guestChannel.readyState === "closed") {
        return;
      }
      hostChannel.readyState = "open";
      guestChannel.readyState = "open";
      hostChannel.onopen?.({ type: "open" } as Event);
      guestChannel.onopen?.({ type: "open" } as Event);
    });
  }
}

const rooms: Array<{ close: () => void }> = [];

function track<Room extends { close: () => void }>(room: Room): Room {
  rooms.push(room);
  return room;
}

function host(options: RoomOptions = {}): HostRoom {
  return track(new HostRoom(options));
}

function guest(options: RoomOptions = {}): GuestRoom {
  return track(new GuestRoom(options));
}

async function connect(hostRoom: HostRoom, guestRoom: GuestRoom) {
  const hostConnected = new Promise<string>((resolve) => {
    const off = hostRoom.on("connect", (peerId) => {
      off();
      resolve(peerId);
    });
  });
  const guestConnected = new Promise<void>((resolve) => {
    const off = guestRoom.on("connect", () => {
      off();
      resolve();
    });
  });
  const invite = await hostRoom.createInvite();
  const answer = await guestRoom.createAnswer(invite);
  const peerId = await hostRoom.acceptAnswer(answer);
  await Promise.all([hostConnected, guestConnected]);
  return { invite, answer, peerId };
}

function nextGuestMessage(room: GuestRoom): Promise<RoomMessage> {
  return new Promise((resolve) => {
    const off = room.on("message", (message) => {
      off();
      resolve(message);
    });
  });
}

beforeEach(() => {
  FakePeerConnection.reset();
  vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
});

afterEach(() => {
  for (const room of rooms.splice(0)) {
    room.close();
  }
  vi.unstubAllGlobals();
});

describe("WebRTC rooms", () => {
  it("completes manual signaling with gathered ICE and an ordered channel", async () => {
    const hostRoom = host();
    const guestRoom = guest();
    const { invite } = await connect(hostRoom, guestRoom);
    expect(decodeInviteCode(invite).sdp).toContain("a=candidate:local");
    expect(guestRoom.connected).toBe(true);
    expect(FakePeerConnection.instances.every((peer) => peer.configuration === undefined)).toBe(true);
    expect(FakePeerConnection.instances[0]?.channel?.ordered).toBe(true);
  });

  it("forwards a caller RTCConfiguration", async () => {
    const rtcConfiguration: RTCConfiguration = {
      iceServers: [{ urls: "stun:stun.example.test:3478" }],
    };
    const hostRoom = host({ rtcConfiguration });
    await hostRoom.createInvite();
    expect(FakePeerConnection.instances[0]?.configuration).toBe(rtcConfiguration);
  });

  it("sends privately and broadcasts JSON messages", async () => {
    const hostRoom = host();
    const first = guest();
    const second = guest();
    const firstConnection = await connect(hostRoom, first);
    await connect(hostRoom, second);
    const secondMessages: RoomMessage[] = [];
    second.on("message", (message) => secondMessages.push(message));

    const privateMessage = nextGuestMessage(first);
    hostRoom.send(firstConnection.peerId, { type: "chat", text: "private" });
    await expect(privateMessage).resolves.toEqual({ type: "chat", text: "private" });
    expect(secondMessages).toEqual([]);

    const firstBroadcast = nextGuestMessage(first);
    const secondBroadcast = nextGuestMessage(second);
    expect(hostRoom.broadcast({ type: "data", data: { dealer: 2, scores: [3, 5] } })).toBe(2);
    await expect(firstBroadcast).resolves.toEqual({ type: "data", data: { dealer: 2, scores: [3, 5] } });
    await expect(secondBroadcast).resolves.toEqual({ type: "data", data: { dealer: 2, scores: [3, 5] } });
  });

  it("routes guest actions and host chats", async () => {
    const hostRoom = host();
    const guestRoom = guest();
    const { peerId } = await connect(hostRoom, guestRoom);
    const action = new Promise<ActionMessage>((resolve) => {
      const off = hostRoom.on("action", (sender, message) => {
        off();
        expect(sender).toBe(peerId);
        resolve(message);
      });
    });
    guestRoom.send({ type: "action", action: "place-bet", payload: { amount: 25 } });
    await expect(action).resolves.toEqual({ type: "action", action: "place-bet", payload: { amount: 25 } });

    const chat = new Promise<ChatMessage>((resolve) => {
      const off = guestRoom.on("chat", (message) => {
        off();
        resolve(message);
      });
    });
    hostRoom.send(peerId, { type: "chat", text: "Bet accepted" });
    await expect(chat).resolves.toEqual({ type: "chat", text: "Bet accepted" });
  });

  it("rejects a wrong password without consuming the invite", async () => {
    const hostRoom = host({ password: "secret" });
    const wrongGuest = guest({ password: "wrong" });
    const invite = await hostRoom.createInvite();
    const answer = await wrongGuest.createAnswer(invite);
    await expect(hostRoom.acceptAnswer(answer)).rejects.toMatchObject({ code: "INVALID_PASSWORD" });
    expect(hostRoom.guestCount).toBe(1);

    const rightGuest = guest({ password: "secret" });
    const rightAnswer = await rightGuest.createAnswer(invite);
    const connected = new Promise<void>((resolve) => {
      const off = rightGuest.on("connect", () => {
        off();
        resolve();
      });
    });
    await hostRoom.acceptAnswer(rightAnswer);
    await connected;
    expect(rightGuest.connected).toBe(true);
  });

  it("requires a password when the invite is protected", async () => {
    const hostRoom = host({ password: "secret" });
    const guestRoom = guest();
    const invite = await hostRoom.createInvite();
    await expect(guestRoom.createAnswer(invite)).rejects.toMatchObject({ code: "PASSWORD_REQUIRED" });
  });

  it("cleans up the host peer when a guest disconnects", async () => {
    const hostRoom = host();
    const guestRoom = guest();
    const { peerId } = await connect(hostRoom, guestRoom);
    const disconnected = new Promise<string>((resolve) => {
      const off = hostRoom.on("disconnect", (id) => {
        off();
        resolve(id);
      });
    });
    guestRoom.close();
    await expect(disconnected).resolves.toBe(peerId);
    expect(hostRoom.guestCount).toBe(0);
    expect(guestRoom.connected).toBe(false);
    expect(() => hostRoom.send(peerId, { type: "chat", text: "gone" })).toThrowError(
      expect.objectContaining({ code: "UNKNOWN_PEER" }),
    );
  });

  it("limits pending peers and prevents answer reuse", async () => {
    const hostRoom = host();
    const guestRoom = guest();
    const { answer } = await connect(hostRoom, guestRoom);
    await expect(hostRoom.acceptAnswer(answer)).rejects.toMatchObject({ code: "INVITE_ALREADY_USED" });
    guestRoom.close();
    await vi.waitFor(() => expect(hostRoom.guestCount).toBe(0));

    for (let index = 0; index < MAX_GUESTS; index += 1) {
      await hostRoom.createInvite();
    }
    await expect(hostRoom.createInvite()).rejects.toMatchObject({ code: "ROOM_FULL" });
  });

  it("atomically consumes an invite across concurrent answers", async () => {
    const hostRoom = host({ password: "secret" });
    const guestRoom = guest({ password: "secret" });
    const invite = await hostRoom.createInvite();
    const answer = await guestRoom.createAnswer(invite);
    const results = await Promise.allSettled([
      hostRoom.acceptAnswer(answer),
      hostRoom.acceptAnswer(answer),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      reason: expect.objectContaining({ code: "INVITE_ALREADY_USED" }),
    });
  });
});
