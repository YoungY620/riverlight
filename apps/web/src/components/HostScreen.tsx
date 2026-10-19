import { useEffect, useMemo, useRef, useState } from "react";
import {
  HoldemGame,
  createDeckCommitment,
  createShuffledDeck,
  type Card as EngineCard,
  type DeckCommitmentMaterial,
  type GameSnapshot,
  type PlayerAction,
} from "@riverlight/engine";
import { HostRoom, type DataMessage, type RoomMessage } from "@riverlight/net";
import { GameView } from "@/components/game/GameView";
import { GameSettings, type CardBack } from "@/components/game/GameSettings";
import { AVATARS, PixelAvatar, type AvatarName } from "@/components/game/PixelAvatar";
import type { TableTheme } from "@/components/game/TableBackground";
import { TableBackground } from "@/components/game/TableBackground";
import type { ChatMessage } from "@/components/game/SidePanel";
import { OnlineFairnessPanel } from "@/components/OnlineFairnessPanel";
import {
  HOST_PLAYER_ID,
  MAX_ONLINE_CHAT_LENGTH,
  decodeGuestMessage,
  encodeHostMessage,
  type HostToGuestMessage,
  type OnlineFairness,
  type OnlinePlayer,
} from "@/components/game/online";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CopyIcon } from "@/components/icons";
import { EntropyPool } from "@/lib/entropy";

interface GuestState extends OnlinePlayer {
  connected: boolean;
  ready: boolean;
}

interface HandMaterial extends DeckCommitmentMaterial {
  deck: EngineCard[];
}

export interface HostScreenProps {
  name: string;
  avatar: AvatarName;
  theme: TableTheme;
  cardBack: CardBack;
  musicEnabled: boolean;
  password: string;
  onSettingsChange: (settings: { avatar?: AvatarName; theme?: TableTheme; cardBack?: CardBack }) => void;
  onMusicToggle: () => void;
  onExit: () => void;
}

const ACTION_NAMES: Record<PlayerAction["type"], string> = {
  fold: "弃牌",
  check: "过牌",
  call: "跟注",
  bet: "下注",
  raise: "加注",
  "all-in": "全下",
};

async function createHandMaterial(entropyPool: EntropyPool, purpose: string): Promise<HandMaterial> {
  const secret = await entropyPool.nextSecret(purpose);
  const deck = createShuffledDeck(secret);
  return { deck, ...createDeckCommitment(deck, secret) };
}

function asAvatar(value: string): AvatarName {
  return (AVATARS as readonly string[]).includes(value) ? value as AvatarName : "otter";
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "联机操作失败，请重试。";
}

export function HostScreen({
  name,
  avatar,
  theme,
  cardBack,
  musicEnabled,
  password,
  onSettingsChange,
  onMusicToggle,
  onExit,
}: HostScreenProps) {
  const roomRef = useRef<HostRoom | null>(null);
  const gameRef = useRef<HoldemGame | null>(null);
  const handTransitionRef = useRef(false);
  const [entropyPool] = useState(() => new EntropyPool());
  const guestsRef = useRef(new Map<string, GuestState>());
  const activePlayerIdsRef = useRef(new Set<string>());
  const fairnessRef = useRef(new Map<number, HandMaterial>());
  const nameRef = useRef(name);
  const avatarRef = useRef(avatar);
  const [players, setPlayers] = useState<OnlinePlayer[]>([{ id: HOST_PLAYER_ID, name, avatar }]);
  const playersRef = useRef(players);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const snapshotRef = useRef<GameSnapshot | null>(null);
  const [fairness, setFairness] = useState<OnlineFairness | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", author: "系统", text: "房间已创建，等待朋友入座。", system: true },
  ]);
  const messagesRef = useRef(messages);
  const [handLog, setHandLog] = useState<string[]>([]);
  const handLogRef = useRef(handLog);
  const [inviteCode, setInviteCode] = useState("");
  const [answerCode, setAnswerCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const eventsRef = useRef<{
    connect: (peerId: string) => void;
    disconnect: (peerId: string) => void;
    message: (peerId: string, message: RoomMessage) => void;
    error: (error: Error, peerId: string) => void;
  } | null>(null);

  nameRef.current = name;
  avatarRef.current = avatar;

  function sendToGuest(peerId: string, message: DataMessage): boolean {
    const room = roomRef.current;
    if (!room) return false;
    try {
      room.send(peerId, message);
      return true;
    } catch {
      return false;
    }
  }

  function sendGuestError(peerId: string, message: string) {
    sendToGuest(peerId, encodeHostMessage({ kind: "error", message }));
  }

  function sendPublic(message: HostToGuestMessage) {
    const encoded = encodeHostMessage(message);
    for (const player of playersRef.current) {
      if (player.id === HOST_PLAYER_ID) continue;
      const guest = guestsRef.current.get(player.id);
      if (guest?.connected) sendToGuest(player.id, encoded);
    }
  }

  function refreshPlayers() {
    const inGame = gameRef.current !== null;
    const guests = [...guestsRef.current.values()]
      .filter((guest) => guest.ready && (inGame ? activePlayerIdsRef.current.has(guest.id) : guest.connected))
      .map(({ id, name: playerName, avatar: playerAvatar }) => ({ id, name: playerName, avatar: playerAvatar }));
    const next: OnlinePlayer[] = [
      { id: HOST_PLAYER_ID, name: nameRef.current, avatar: avatarRef.current },
      ...guests,
    ];
    playersRef.current = next;
    setPlayers(next);
    sendPublic({ kind: "lobby", players: next });
  }

  function appendMessage(message: ChatMessage, relay = true) {
    const next = [...messagesRef.current, message].slice(-80);
    messagesRef.current = next;
    setMessages(next);
    if (relay) sendPublic({ kind: "chat", message });
  }

  function appendLog(entry: string) {
    const next = [...handLogRef.current, entry].slice(-80);
    handLogRef.current = next;
    setHandLog(next);
    sendPublic({ kind: "log", entries: next });
  }

  function publishFairness(handNumber: number, includeReveal: boolean) {
    const material = fairnessRef.current.get(handNumber);
    if (!material) return;
    const update: OnlineFairness = {
      handNumber,
      commitment: material.commitment,
      ...(includeReveal ? { reveal: material.reveal } : {}),
    };
    setFairness(update);
    sendPublic({ kind: "fairness", ...update });
  }

  function publishSnapshots(): GameSnapshot | null {
    const game = gameRef.current;
    if (!game) return null;
    try {
      const hostSnapshot = game.getSnapshot(HOST_PLAYER_ID);
      snapshotRef.current = hostSnapshot;
      setSnapshot(hostSnapshot);
      for (const player of playersRef.current) {
        if (player.id === HOST_PLAYER_ID) continue;
        const guest = guestsRef.current.get(player.id);
        if (!guest?.connected) continue;
        const privateSnapshot = game.getSnapshot(player.id);
        const sent = sendToGuest(player.id, encodeHostMessage({ kind: "snapshot", snapshot: privateSnapshot }));
        if (!sent) setError(`无法向 ${player.name} 发送最新牌局状态。`);
      }
      return hostSnapshot;
    } catch (caught) {
      setError(errorText(caught));
      return null;
    }
  }

  function performAction(playerId: string, action: PlayerAction) {
    const game = gameRef.current;
    if (!game || !activePlayerIdsRef.current.has(playerId)) {
      if (playerId === HOST_PLAYER_ID) setError("牌局尚未开始。");
      else sendGuestError(playerId, "牌局尚未开始，或你不在本桌。");
      return;
    }
    try {
      setError("");
      const acted = game.act(playerId, action);
      const player = acted.players.find((candidate) => candidate.id === playerId);
      appendLog(`${player?.name ?? playerId} ${ACTION_NAMES[action.type]}${"amount" in action ? ` ${action.amount}` : ""}`);
      const next = publishSnapshots();
      if (next?.result) publishFairness(next.handNumber, true);
    } catch (caught) {
      if (playerId === HOST_PLAYER_ID) setError(errorText(caught));
      else sendGuestError(playerId, errorText(caught));
    }
  }

  async function startGame() {
    if (gameRef.current || handTransitionRef.current) return;
    const participants = playersRef.current.filter((player) =>
      player.id === HOST_PLAYER_ID || guestsRef.current.get(player.id)?.connected);
    if (participants.length < 2) {
      setError("至少需要两位已连接的玩家才能开始。");
      return;
    }
    const room = roomRef.current;
    handTransitionRef.current = true;
    setBusy(true);
    try {
      setError("");
      const material = await createHandMaterial(entropyPool, "hand:1");
      if (roomRef.current !== room || gameRef.current) return;
      const seatedPlayers = playersRef.current.filter((player) =>
        player.id === HOST_PLAYER_ID || guestsRef.current.get(player.id)?.connected);
      if (seatedPlayers.length < 2) {
        setError("至少需要两位已连接的玩家才能开始。");
        return;
      }
      const game = new HoldemGame({
        players: seatedPlayers.map((player) => ({ id: player.id, name: player.name, chips: 1000 })),
        smallBlind: 5,
        bigBlind: 10,
        deck: material.deck,
      });
      gameRef.current = game;
      activePlayerIdsRef.current = new Set(seatedPlayers.map((player) => player.id));
      fairnessRef.current.clear();
      const firstSnapshot = game.getSnapshot(HOST_PLAYER_ID);
      fairnessRef.current.set(firstSnapshot.handNumber, material);
      setInviteCode("");
      setAnswerCode("");
      setError("");
      appendLog(`第 ${firstSnapshot.handNumber} 手开始，盲注 5 / 10`);
      appendMessage({ id: crypto.randomUUID(), author: "系统", text: "牌局开始。", system: true });
      publishFairness(firstSnapshot.handNumber, false);
      publishSnapshots();
    } catch (caught) {
      if (roomRef.current === room) {
        gameRef.current = null;
        setError(errorText(caught));
      }
    } finally {
      handTransitionRef.current = false;
      if (roomRef.current === room) setBusy(false);
    }
  }

  async function startNextHand() {
    const game = gameRef.current;
    const completed = snapshotRef.current;
    if (!game || !completed?.result || handTransitionRef.current) return;
    const room = roomRef.current;
    handTransitionRef.current = true;
    try {
      setError("");
      const material = await createHandMaterial(entropyPool, `hand:${completed.handNumber + 1}`);
      if (roomRef.current !== room || gameRef.current !== game
        || snapshotRef.current?.handNumber !== completed.handNumber || !snapshotRef.current.result) return;
      const next = game.startNextHand(HOST_PLAYER_ID, material.deck);
      fairnessRef.current.set(next.handNumber, material);
      appendLog(`第 ${next.handNumber} 手开始`);
      publishFairness(next.handNumber, false);
      publishSnapshots();
    } catch (caught) {
      if (roomRef.current === room && gameRef.current === game) setError(errorText(caught));
    } finally {
      handTransitionRef.current = false;
    }
  }

  function handleConnect(peerId: string) {
    void entropyPool.mix(`network:connect:${peerId}`).catch(() => undefined);
    const previous = guestsRef.current.get(peerId);
    guestsRef.current.set(peerId, {
      id: peerId,
      name: previous?.name ?? "",
      avatar: previous?.avatar ?? "otter",
      connected: true,
      ready: previous?.ready ?? false,
    });
  }

  function handleDisconnect(peerId: string) {
    void entropyPool.mix(`network:disconnect:${peerId}`).catch(() => undefined);
    const guest = guestsRef.current.get(peerId);
    if (!guest) return;
    if (gameRef.current) guest.connected = false;
    else guestsRef.current.delete(peerId);
    refreshPlayers();
    if (guest.ready) {
      const text = `${guest.name} 已断开连接。`;
      appendMessage({ id: crypto.randomUUID(), author: "系统", text, system: true });
      setError(gameRef.current ? `${text} 若轮到对方行动，牌局会等待。` : text);
    }
  }

  function handleMessage(peerId: string, roomMessage: RoomMessage) {
    void entropyPool.mix(`network:message:${peerId}:${roomMessage.type}`).catch(() => undefined);
    const message = decodeGuestMessage(roomMessage);
    if (!message) {
      sendGuestError(peerId, "收到无效的联机数据。");
      return;
    }
    if (message.kind === "hello") {
      if (gameRef.current && !activePlayerIdsRef.current.has(peerId)) {
        sendGuestError(peerId, "牌局已经开始，不能再加入。");
        return;
      }
      const playerName = message.name.trim().slice(0, 16);
      if (!playerName) {
        sendGuestError(peerId, "玩家名称不能为空。");
        return;
      }
      guestsRef.current.set(peerId, {
        id: peerId,
        name: playerName,
        avatar: asAvatar(message.avatar),
        connected: true,
        ready: true,
      });
      refreshPlayers();
      return;
    }
    const guest = guestsRef.current.get(peerId);
    if (!guest?.ready) {
      sendGuestError(peerId, "请先发送玩家信息。");
      return;
    }
    if (message.kind === "action") {
      performAction(peerId, message.action);
      return;
    }
    appendMessage({
      id: crypto.randomUUID(),
      author: guest.name,
      text: message.text.trim().slice(0, MAX_ONLINE_CHAT_LENGTH),
    });
  }

  eventsRef.current = {
    connect: handleConnect,
    disconnect: handleDisconnect,
    message: handleMessage,
    error: (caught, peerId) => setError(`客人 ${peerId} 数据异常：${errorText(caught)}`),
  };

  useEffect(() => {
    const room = new HostRoom({ password });
    roomRef.current = room;
    const subscriptions = [
      room.on("connect", (peerId) => eventsRef.current?.connect(peerId)),
      room.on("disconnect", (peerId) => eventsRef.current?.disconnect(peerId)),
      room.on("message", (peerId, message) => eventsRef.current?.message(peerId, message)),
      room.on("error", (caught, peerId) => eventsRef.current?.error(caught, peerId)),
    ];
    return () => {
      for (const unsubscribe of subscriptions) unsubscribe();
      if (roomRef.current === room) roomRef.current = null;
      room.close();
    };
  }, [password]);

  useEffect(() => {
    if (!gameRef.current) refreshPlayers();
  }, [name, avatar]);

  async function generateInvite() {
    const room = roomRef.current;
    if (!room) {
      setError("房间尚未准备好，请稍候。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const code = await room.createInvite();
      if (roomRef.current === room) {
        setInviteCode(code);
        setCopied(false);
      }
    } catch (caught) {
      if (roomRef.current === room) setError(errorText(caught));
    } finally {
      if (roomRef.current === room) setBusy(false);
    }
  }

  async function acceptAnswer() {
    const room = roomRef.current;
    const code = answerCode.trim();
    if (!room) {
      setError("房间尚未准备好，请稍候。");
      return;
    }
    if (!code) {
      setError("请粘贴客人的应答码。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await room.acceptAnswer(code);
      if (roomRef.current === room) {
        setInviteCode("");
        setAnswerCode("");
      }
    } catch (caught) {
      if (roomRef.current === room) setError(errorText(caught));
    } finally {
      if (roomRef.current === room) setBusy(false);
    }
  }

  function leave() {
    roomRef.current?.close();
    roomRef.current = null;
    onExit();
  }

  const avatars = useMemo<Record<string, AvatarName>>(() => {
    const result: Record<string, AvatarName> = {};
    for (const player of players) result[player.id] = asAvatar(player.avatar);
    result[HOST_PLAYER_ID] = avatar;
    return result;
  }, [players, avatar]);

  const settings = (
    <GameSettings
      avatar={avatar}
      theme={theme}
      cardBack={cardBack}
      musicEnabled={musicEnabled}
      onChange={onSettingsChange}
      onMusicToggle={onMusicToggle}
    />
  );

  if (snapshot) {
    const currentFairness = fairness?.handNumber === snapshot.handNumber ? fairness : null;
    return (
      <>
        <GameView
          snapshot={snapshot}
          localPlayerId={HOST_PLAYER_ID}
          avatars={avatars}
          theme={theme}
          cardBack={cardBack}
          messages={messages}
          handLog={handLog}
          fairness={currentFairness ? (
            <OnlineFairnessPanel
              handNumber={currentFairness.handNumber}
              commitment={currentFairness.commitment}
              reveal={currentFairness.reveal}
            />
          ) : undefined}
          settings={settings}
          onExit={leave}
          onNextHand={() => void startNextHand()}
          onAction={(action) => performAction(HOST_PLAYER_ID, action)}
          onChat={(text) => appendMessage({ id: crypto.randomUUID(), author: name, text })}
        />
        {error && (
          <Card className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md border border-destructive/40">
            <CardContent className="flex items-center gap-3 p-3">
              <p role="alert" className="flex-1 text-sm text-destructive"><span className="sr-only">错误：</span>{error}</p>
              <Button className="min-h-11" variant="ghost" size="sm" onClick={() => setError("")}>关闭</Button>
            </CardContent>
          </Card>
        )}
      </>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <TableBackground theme={theme} />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-5xl flex-col p-4 sm:p-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="assets/emblem.png" alt="Riverlight 标志" className="pixelated size-10" />
            <span className="text-lg font-bold">Riverlight</span>
          </div>
          <Button className="min-h-11" variant="ghost" size="sm" onClick={leave}>离开</Button>
        </header>

        <section className="py-8">
          <h1 className="text-3xl font-bold">联机大厅</h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">交换邀请与应答码，至少两人即可开局。</p>
        </section>

        {error && <p role="alert" className="mb-4 text-sm text-destructive"><span className="sr-only">错误：</span>{error}</p>}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="border border-border bg-card/95">
            <CardHeader>
              <CardTitle>邀请一位朋友</CardTitle>
              <CardDescription>每条邀请码对应一位客人，接受应答后可再邀请下一位。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {!inviteCode && (
                <Button className="min-h-11" variant="secondary" disabled={busy} onClick={generateInvite}>
                  {busy ? "正在生成…" : "生成邀请码"}
                </Button>
              )}
              {inviteCode && (
                <>
                  <div className="grid gap-2">
                    <label htmlFor="host-invite" className="text-sm text-muted-foreground">邀请码</label>
                    <Textarea
                      id="host-invite"
                      value={inviteCode}
                      readOnly
                      onFocus={(event) => event.currentTarget.select()}
                      className="min-h-28 font-mono text-xs"
                      spellCheck={false}
                    />
                  </div>
                  <Button className="min-h-11"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(inviteCode);
                        setCopied(true);
                        setError("");
                      } catch {
                        setError("复制失败，请手动选择邀请码。");
                      }
                    }}
                  >
                    <CopyIcon className="size-4" />{copied ? "已复制" : "复制邀请码"}
                  </Button>
                  <form
                    className="grid gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void acceptAnswer();
                    }}
                  >
                    <div className="grid gap-2">
                      <label htmlFor="host-answer" className="text-sm text-muted-foreground">客人的应答码</label>
                      <Textarea
                        id="host-answer"
                        value={answerCode}
                        onChange={(event) => setAnswerCode(event.target.value)}
                        className="min-h-28 font-mono text-xs"
                        spellCheck={false}
                        autoComplete="off"
                        placeholder="粘贴客人发回的应答码…"
                      />
                    </div>
                    <Button className="min-h-11" type="submit" variant="primary" disabled={busy || !answerCode.trim()}>
                      {busy ? "正在接受…" : "接受应答"}
                    </Button>
                  </form>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border bg-card/95">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>牌桌玩家</CardTitle>
                <Badge variant="primary">{players.length} / 9</Badge>
              </div>
              <CardDescription>客人连接并报到后会出现在这里。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <p role="status" className="sr-only">
                {players.length >= 2
                  ? `已有 ${players.length} 位玩家入座，可以开始牌局。`
                  : `已有 ${players.length} 位玩家入座，等待至少一位客人加入。`}
              </p>
              <ul className="grid gap-3" aria-label="已入座玩家">
                {players.map((player) => (
                  <li key={player.id} className="flex items-center gap-3">
                    <PixelAvatar name={asAvatar(player.avatar)} label={`${player.name}的头像`} />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{player.name}</span>
                    <Badge variant={player.id === HOST_PLAYER_ID ? "primary" : "secondary"}>
                      {player.id === HOST_PLAYER_ID ? "房主" : "客人"}
                    </Badge>
                  </li>
                ))}
              </ul>
              {players.length >= 2 ? (
                <Button className="min-h-11" variant="primary" size="lg" disabled={busy} onClick={() => void startGame()}>
                  开始牌局
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">等待至少一位客人加入。</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
