import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MusicIcon, UsersIcon } from "@/components/icons";
import { TableBackground } from "@/components/game/TableBackground";

interface HomeScreenProps {
  initialName: string;
  musicEnabled: boolean;
  busy?: boolean;
  error?: string;
  onMusicToggle: () => void;
  onPractice: (name: string) => void;
  onHost: (name: string, password: string) => void;
  onJoin: (name: string, invite: string, password: string) => void;
}

export function HomeScreen({
  initialName,
  musicEnabled,
  busy = false,
  error,
  onMusicToggle,
  onPractice,
  onHost,
  onJoin,
}: HomeScreenProps) {
  const [name, setName] = useState(initialName || "新玩家");
  const [hostOpen, setHostOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [formError, setFormError] = useState("");
  const [hostError, setHostError] = useState("");
  const [joinNameError, setJoinNameError] = useState("");
  const [joinError, setJoinError] = useState("");

  const validName = () => {
    const trimmed = name.trim();
    return trimmed ? trimmed.slice(0, 16) : null;
  };

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <TableBackground theme="river" />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col p-4 sm:p-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="assets/emblem.png" alt="Riverlight 标志" className="pixelated size-10" />
            <span className="text-lg font-bold">Riverlight</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={musicEnabled ? "关闭音乐" : "开启音乐"}
            aria-pressed={musicEnabled}
            onClick={onMusicToggle}
          >
            <MusicIcon className={musicEnabled ? "size-5 text-primary" : "size-5 opacity-40"} />
          </Button>
        </header>

        <div className="grid flex-1 items-center gap-8 py-10 md:grid-cols-[1fr_380px]">
          <section className="max-w-xl">
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl">和朋友，开一桌。</h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-foreground/75">
              原创像素德州扑克。无需账号或游戏服务器，任意玩家都能做房主。
            </p>
            <div className="mt-8 hidden items-center gap-3 text-sm text-foreground/65 md:flex">
              <UsersIcon className="size-5 text-primary" />
              <span>2–9 人 · 练习 Bot · 可验证发牌</span>
            </div>
          </section>

          <Card className="w-full border border-border bg-card/95">
            <CardHeader>
              <CardTitle>入座</CardTitle>
              <CardDescription>名字只保存在这台设备上。</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const valid = validName();
                  if (valid) {
                    setFormError("");
                    onPractice(valid);
                  } else {
                    setFormError("请先填写玩家名称");
                  }
                }}
              >
                <div className="grid gap-2">
                  <label htmlFor="player-name" className="text-sm text-muted-foreground">玩家名称</label>
                  <Input
                    id="player-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={16}
                    autoComplete="nickname"
                    aria-invalid={Boolean(formError)}
                    aria-describedby={formError ? "home-error" : undefined}
                  />
                </div>
                {(formError || error) && (
                  <p id="home-error" role="alert" className="text-sm text-destructive">{formError || error}</p>
                )}
                <Button type="submit" variant="primary" size="lg" disabled={busy}>和 Bot 练习</Button>
                <div className="grid grid-cols-2 gap-3">
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => setHostOpen(true)}>创建房间</Button>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => setJoinOpen(true)}>加入房间</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={hostOpen} onOpenChange={setHostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建临时房间</DialogTitle>
            <DialogDescription>这台设备会成为房主，关闭页面后房间结束。</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const valid = validName();
              if (valid) {
                setHostError("");
                onHost(valid, password);
              } else {
                setHostError("请先填写玩家名称");
              }
            }}
          >
            <div className="grid gap-2">
              <label htmlFor="host-player-name" className="text-sm text-muted-foreground">玩家名称</label>
              <Input
                id="host-player-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={16}
                autoComplete="nickname"
                aria-invalid={Boolean(hostError)}
                aria-describedby={hostError ? "host-error" : undefined}
              />
              {hostError && <p id="host-error" role="alert" className="text-sm text-destructive">{hostError}</p>}
            </div>
            <div className="grid gap-2">
              <label htmlFor="room-password" className="text-sm text-muted-foreground">房间密码（可选）</label>
              <Input
                id="room-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="off"
                maxLength={64}
              />
            </div>
            <Button type="submit" variant="primary" disabled={busy}>创建并生成邀请</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>加入朋友房间</DialogTitle>
            <DialogDescription>粘贴房主发来的邀请码，再把应答码发回去。</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const valid = validName();
              if (!valid) {
                setJoinNameError("请先填写玩家名称");
                return;
              }
              setJoinNameError("");
              if (!invite.trim()) {
                setJoinError("请粘贴邀请码");
                return;
              }
              setJoinError("");
              onJoin(valid, invite.trim(), joinPassword);
            }}
          >
            <div className="grid gap-2">
              <label htmlFor="join-player-name" className="text-sm text-muted-foreground">玩家名称</label>
              <Input
                id="join-player-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={16}
                autoComplete="nickname"
                aria-invalid={Boolean(joinNameError)}
                aria-describedby={joinNameError ? "join-name-error" : undefined}
              />
              {joinNameError && <p id="join-name-error" role="alert" className="text-sm text-destructive">{joinNameError}</p>}
            </div>
            <div className="grid gap-2">
              <label htmlFor="invite-code" className="text-sm text-muted-foreground">邀请码</label>
              <Textarea
                id="invite-code"
                value={invite}
                onChange={(event) => setInvite(event.target.value)}
                className="min-h-28 font-mono text-xs"
                spellCheck={false}
                autoComplete="off"
                placeholder="粘贴以 RL 开头的邀请码…"
                aria-invalid={Boolean(joinError)}
                aria-describedby={joinError ? "join-error" : undefined}
              />
              {joinError && <p id="join-error" role="alert" className="text-sm text-destructive">{joinError}</p>}
            </div>
            <div className="grid gap-2">
              <label htmlFor="join-password" className="text-sm text-muted-foreground">房间密码（如已设置）</label>
              <Input
                id="join-password"
                type="password"
                value={joinPassword}
                onChange={(event) => setJoinPassword(event.target.value)}
                autoComplete="off"
                maxLength={64}
              />
            </div>
            <Button type="submit" variant="primary" disabled={busy}>生成应答码</Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
