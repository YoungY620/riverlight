import { useEffect, useMemo, useRef, useState } from "react";
import type { GameSnapshot } from "@riverlight/engine";
import { GuestRoom, type RoomMessage } from "@riverlight/net";
import { GameView } from "@/components/game/GameView";
import { GameSettings, type CardBack } from "@/components/game/GameSettings";
import { AVATARS, PixelAvatar, type AvatarName } from "@/components/game/PixelAvatar";
import { TableBackground, type TableTheme } from "@/components/game/TableBackground";
import type { ChatMessage } from "@/components/game/SidePanel";
import { OnlineFairnessPanel } from "@/components/OnlineFairnessPanel";
import {
  HOST_PLAYER_ID,
  decodeHostMessage,
  encodeGuestMessage,
  type GuestToHostMessage,
  type OnlineFairness,
  type OnlinePlayer,
} from "@/components/game/online";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CopyIcon } from "@/components/icons";

export interface GuestScreenProps {
  name: string;
  avatar: AvatarName;
  theme: TableTheme;
  cardBack: CardBack;
  musicEnabled: boolean;
  invite: string;
  password: string;
  onSettingsChange: (settings: { avatar?: AvatarName; theme?: TableTheme; cardBack?: CardBack }) => void;
  onMusicToggle: () => void;
  onExit: () => void;
}

function asAvatar(value: string): AvatarName {
  return (AVATARS as readonly string[]).includes(value) ? value as AvatarName : "otter";
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "联机操作失败，请重试。";
}

export function GuestScreen({
  name,
  avatar,
  theme,
  cardBack,
  musicEnabled,
  invite,
  password,
  onSettingsChange,
  onMusicToggle,
  onExit,
}: GuestScreenProps) {
  const roomRef = useRef<GuestRoom | null>(null);
  const connectedRef = useRef(false);
  const nameRef = useRef(name);
  const avatarRef = useRef(avatar);
  const [answerCode, setAnswerCode] = useState("");
  const [preparing, setPreparing] = useState(true);
  const [connected, setConnected] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [players, setPlayers] = useState<OnlinePlayer[]>([{ id: "local", name, avatar }]);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [fairness, setFairness] = useState<OnlineFairness | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", author: "系统", text: "正在与房主建立连接。", system: true },
  ]);
  const messagesRef = useRef(messages);
  const [handLog, setHandLog] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const eventsRef = useRef<{
    connect: () => void;
    disconnect: () => void;
    message: (message: RoomMessage) => void;
    error: (error: Error) => void;
  } | null>(null);

  nameRef.current = name;
  avatarRef.current = avatar;

  function appendMessage(message: ChatMessage) {
    const next = [...messagesRef.current, message].slice(-80);
    messagesRef.current = next;
    setMessages(next);
  }

  function handleConnect() {
    connectedRef.current = true;
    setConnected(true);
    setDisconnected(false);
    setError("");
    try {
      roomRef.current?.send(encodeGuestMessage({
        kind: "hello",
        name: nameRef.current.trim().slice(0, 16) || "客人",
        avatar: avatarRef.current,
      }));
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  function handleDisconnect() {
    connectedRef.current = false;
    setConnected(false);
    setDisconnected(true);
  }

  function handleMessage(roomMessage: RoomMessage) {
    const message = decodeHostMessage(roomMessage);
    if (!message) {
      setError("收到无效的联机数据。");
      return;
    }
    if (message.kind === "lobby") {
      setPlayers(message.players);
      return;
    }
    if (message.kind === "snapshot") {
      if (!message.snapshot.viewerId) {
        setError("房主没有提供私人牌局视图。");
        return;
      }
      setSnapshot(message.snapshot);
      setFairness((current) => current && current.handNumber !== message.snapshot.handNumber ? null : current);
      setError("");
      return;
    }
    if (message.kind === "fairness") {
      setFairness({
        handNumber: message.handNumber,
        commitment: message.commitment,
        ...(message.reveal === undefined ? {} : { reveal: message.reveal }),
      });
      return;
    }
    if (message.kind === "chat") {
      appendMessage(message.message);
      return;
    }
    if (message.kind === "log") {
      setHandLog(message.entries);
      return;
    }
    setError(message.message);
  }

  eventsRef.current = {
    connect: handleConnect,
    disconnect: handleDisconnect,
    message: handleMessage,
    error: (caught) => setError(errorText(caught)),
  };

  useEffect(() => {
    let cancelled = false;
    const room = new GuestRoom({ password });
    roomRef.current = room;
    connectedRef.current = false;
    setPreparing(true);
    setAnswerCode("");
    setConnected(false);
    setDisconnected(false);
    setSnapshot(null);
    setFairness(null);
    setError("");
    const subscriptions = [
      room.on("connect", () => eventsRef.current?.connect()),
      room.on("disconnect", () => eventsRef.current?.disconnect()),
      room.on("message", (message) => eventsRef.current?.message(message)),
      room.on("error", (caught) => eventsRef.current?.error(caught)),
    ];
    void (async () => {
      try {
        const answer = await room.createAnswer(invite);
        if (!cancelled && roomRef.current === room) setAnswerCode(answer);
      } catch (caught) {
        if (!cancelled && roomRef.current === room) setError(errorText(caught));
      } finally {
        if (!cancelled && roomRef.current === room) setPreparing(false);
      }
    })();
    return () => {
      cancelled = true;
      for (const unsubscribe of subscriptions) unsubscribe();
      if (roomRef.current === room) roomRef.current = null;
      connectedRef.current = false;
      room.close();
    };
  }, [invite, password]);

  function sendToHost(message: GuestToHostMessage) {
    const room = roomRef.current;
    if (!room || !connectedRef.current) {
      setError("与房主的连接尚未就绪。");
      return;
    }
    try {
      room.send(encodeGuestMessage(message));
      setError("");
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  function leave() {
    roomRef.current?.close();
    roomRef.current = null;
    connectedRef.current = false;
    onExit();
  }

  const avatars = useMemo<Record<string, AvatarName>>(() => {
    const result: Record<string, AvatarName> = {};
    for (const player of players) result[player.id] = asAvatar(player.avatar);
    if (snapshot?.viewerId) result[snapshot.viewerId] = avatar;
    return result;
  }, [players, snapshot?.viewerId, avatar]);

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

  if (disconnected) {
    return (
      <main className="relative min-h-dvh overflow-hidden">
        <TableBackground theme={theme} />
        <div className="relative z-10 flex min-h-dvh items-center justify-center p-4">
          <Card className="w-full max-w-md border border-destructive/40 bg-card/95">
            <CardHeader>
              <Badge role="status" variant="destructive" className="w-fit">连接已断开</Badge>
              <CardTitle>与房主失去连接</CardTitle>
              <CardDescription>当前应答码不能重复使用，请返回后重新加入房间。</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="min-h-11" variant="primary" onClick={leave}>离开房间</Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (snapshot) {
    const currentFairness = fairness?.handNumber === snapshot.handNumber ? fairness : null;
    return (
      <>
        <GameView
          snapshot={snapshot}
          localPlayerId={snapshot.viewerId ?? ""}
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
          onAction={(action) => sendToHost({ kind: "action", action })}
          onChat={(text) => sendToHost({ kind: "chat", text })}
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
          <div className="flex items-center gap-1">
            {settings}
            <Button className="min-h-11" variant="ghost" size="sm" onClick={leave}>离开</Button>
          </div>
        </header>

        <section className="py-8">
          <h1 className="text-3xl font-bold">加入朋友牌桌</h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">把应答码发回房主，连接后等待开局。</p>
        </section>

        {error && <p role="alert" className="mb-4 text-sm text-destructive"><span className="sr-only">错误：</span>{error}</p>}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="border border-border bg-card/95">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>你的应答码</CardTitle>
                <Badge role="status" variant={connected ? "success" : "warning"}>
                  {connected ? "已连接" : preparing ? "正在生成" : "等待房主"}
                </Badge>
              </div>
              <CardDescription>复制给房主；对方接受后，此页面会自动连接。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {answerCode ? (
                <>
                  <div className="grid gap-2">
                    <label htmlFor="guest-answer" className="text-sm text-muted-foreground">应答码</label>
                    <Textarea
                      id="guest-answer"
                      value={answerCode}
                      readOnly
                      onFocus={(event) => event.currentTarget.select()}
                      className="min-h-32 font-mono text-xs"
                      spellCheck={false}
                    />
                  </div>
                  <Button className="min-h-11"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(answerCode);
                        setCopied(true);
                        setError("");
                      } catch {
                        setError("复制失败，请手动选择应答码。");
                      }
                    }}
                  >
                    <CopyIcon className="size-4" />{copied ? "已复制" : "复制应答码"}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {preparing ? "正在收集连接信息，请稍候。" : "尚未生成应答码，请检查错误信息后重新加入。"}
                </p>
              )}
              {connected && <p className="text-sm text-muted-foreground">已向房主报到，等待房主开始牌局。</p>}
            </CardContent>
          </Card>

          <Card className="border border-border bg-card/95">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>牌桌玩家</CardTitle>
                <Badge variant="primary">{players.length} / 9</Badge>
              </div>
              <CardDescription>房主开始后会在这里显示完整牌桌。</CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
