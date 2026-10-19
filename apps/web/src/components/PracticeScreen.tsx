import { useEffect, useMemo, useRef, useState } from "react";
import { createShuffledDeck, HoldemGame, suggestAction, type BotDifficulty, type BotStyle, type GameSnapshot, type PlayerAction } from "@riverlight/engine";
import { EntropyPool } from "@/lib/entropy";
import { GameView } from "@/components/game/GameView";
import { GameSettings, type CardBack } from "@/components/game/GameSettings";
import type { AvatarName } from "@/components/game/PixelAvatar";
import type { TableTheme } from "@/components/game/TableBackground";
import type { ChatMessage } from "@/components/game/SidePanel";
import { FairnessPanel } from "@/components/game/FairnessPanel";
import { riverlightAudio } from "@/lib/audio";

const LOCAL_ID = "local";
const BOT_IDS = ["bot-river", "bot-moss", "bot-nori", "bot-sol", "bot-emo"];
const BOT_NAMES = ["阿溪", "苔苔", "诺里", "索尔", "小墨"];
const BOT_STYLES: BotStyle[] = ["TAG", "LAG", "TP", "LP", "TAG"];
const BOT_STYLE_NAMES: Record<BotStyle, string> = {
  TAG: "紧凶 TAG",
  LAG: "松凶 LAG",
  TP: "紧弱 TP",
  LP: "松弱 LP",
};
const ACTION_NAMES: Record<PlayerAction["type"], string> = {
  fold: "弃牌",
  check: "过牌",
  call: "跟注",
  bet: "下注",
  raise: "加注",
  "all-in": "全下",
};

function actionLog(action: PlayerAction) {
  return `${ACTION_NAMES[action.type]}${"amount" in action ? ` ${action.amount}` : ""}`;
}

function randomSeed() {
  const values = new Uint32Array(4);
  crypto.getRandomValues(values);
  const random = Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("");
  return `${Date.now().toString(36)}-${performance.now().toString(36)}-${random}`;
}

interface PracticeScreenProps {
  name: string;
  avatar: AvatarName;
  theme: TableTheme;
  cardBack: CardBack;
  musicEnabled: boolean;
  botDifficulty: BotDifficulty;
  onBotDifficultyChange: (difficulty: BotDifficulty) => void;
  onSettingsChange: (settings: { avatar?: AvatarName; theme?: TableTheme; cardBack?: CardBack }) => void;
  onMusicToggle: () => void;
  onExit: () => void;
}

export function PracticeScreen({
  name,
  avatar,
  theme,
  cardBack,
  musicEnabled,
  botDifficulty,
  onBotDifficultyChange,
  onSettingsChange,
  onMusicToggle,
  onExit,
}: PracticeScreenProps) {
  const handSecrets = useRef<Record<number, string>>({ 1: randomSeed() });
  const entropy = useRef(new EntropyPool()).current;
  const secretFor = (hand: number) => {
    handSecrets.current[hand] ??= randomSeed();
    return handSecrets.current[hand];
  };
  const [game] = useState(() => new HoldemGame({
    players: [
      { id: LOCAL_ID, name, chips: 1000 },
      ...BOT_IDS.map((id, index) => ({ id, name: BOT_NAMES[index], chips: 1000 })),
    ],
    smallBlind: 5,
    bigBlind: 10,
    deck: createShuffledDeck(secretFor(1)),
  }));
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => game.getSnapshot(LOCAL_ID));
  const [handLog, setHandLog] = useState([`第 ${snapshot.handNumber} 手开始，盲注 5 / 10`]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", author: "系统", text: "练习桌已创建，Bot 会自动行动。", system: true },
  ]);
  const previous = useRef({ street: snapshot.phase, hand: snapshot.handNumber, result: Boolean(snapshot.result) });
  const avatars = useMemo<Record<string, AvatarName>>(() => ({
    [LOCAL_ID]: avatar,
    "bot-river": "fish",
    "bot-moss": "frog",
    "bot-nori": "fox",
    "bot-sol": "rabbit",
    "bot-emo": "cat",
  }), [avatar]);

  useEffect(() => {
    const current = snapshot.currentPlayerId;
    if (!current || !BOT_IDS.includes(current)) return;
    const timer = setTimeout(() => {
      const style = BOT_STYLES[BOT_IDS.indexOf(current)] ?? "TAG";
      const action = suggestAction(game, current, {
        style,
        difficulty: botDifficulty,
        seed: `${secretFor(snapshot.handNumber)}:${snapshot.phase}:${current}`,
      });
      if (!action) return;
      void entropy.mix(`bot:${current}:${action.type}:${Date.now()}`);
      const next = game.act(current, action);
      const player = next.players.find((candidate) => candidate.id === current);
      setHandLog((log) => [...log.slice(-79), `${player?.name ?? current} ${actionLog(action)}`]);
      riverlightAudio.playChip();
      setSnapshot(game.getSnapshot(LOCAL_ID));
    }, 650);
    return () => clearTimeout(timer);
  }, [game, snapshot, botDifficulty]);

  useEffect(() => {
    if (!snapshot.result) return;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const nextHand = snapshot.handNumber + 1;
          const secret = await entropy.nextSecret(`next-hand:${nextHand}`);
          handSecrets.current[nextHand] = secret;
          const next = game.startNextHand(LOCAL_ID, createShuffledDeck(secret));
          setHandLog((log) => [...log.slice(-79), `第 ${next.handNumber} 手开始`]);
          setSnapshot(next);
        } catch {
          setHandLog((log) => [...log.slice(-79), "牌局结束或无法开始下一手"]);
        }
      })();
    }, 3200);
    return () => clearTimeout(timer);
  }, [game, snapshot.result, snapshot.handNumber]);

  useEffect(() => {
    const before = previous.current;
    if (before.hand !== snapshot.handNumber || before.street !== snapshot.phase) riverlightAudio.playCard();
    if (snapshot.result && !before.result) riverlightAudio.playWin();
    previous.current = { street: snapshot.phase, hand: snapshot.handNumber, result: Boolean(snapshot.result) };
  }, [snapshot]);

  const act = (action: PlayerAction) => {
    try {
      void entropy.mix(`player:${action.type}:${Date.now()}`);
      game.act(LOCAL_ID, action);
      setHandLog((log) => [...log.slice(-79), `${name} ${actionLog(action)}`]);
      riverlightAudio.playChip();
      setSnapshot(game.getSnapshot(LOCAL_ID));
    } catch (error) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), author: "系统", text: error instanceof Error ? error.message : "操作无效", system: true }]);
    }
  };

  return (
    <GameView
      snapshot={snapshot}
      localPlayerId={LOCAL_ID}
      avatars={avatars}
      playerStyles={Object.fromEntries(BOT_IDS.map((id, index) => [id, BOT_STYLE_NAMES[BOT_STYLES[index] ?? "TAG"]]))}
      theme={theme}
      cardBack={cardBack}
      messages={messages}
      handLog={handLog}
      fairness={<FairnessPanel seed={secretFor(snapshot.handNumber)} handNumber={snapshot.handNumber} complete={Boolean(snapshot.result)} />}
      settings={
        <GameSettings
          avatar={avatar}
          theme={theme}
          cardBack={cardBack}
          musicEnabled={musicEnabled}
          botDifficulty={botDifficulty}
          onBotDifficultyChange={onBotDifficultyChange}
          onChange={onSettingsChange}
          onMusicToggle={onMusicToggle}
        />
      }
      onExit={onExit}
      onAction={act}
      onChat={(text) => {
        setMessages((items) => [...items, { id: crypto.randomUUID(), author: name, text }]);
        const reply = text.includes("?") || text.includes("？") ? "这手我还在想。" : "坐好，牌还没完。";
        setTimeout(() => {
          setMessages((items) => [...items, { id: crypto.randomUUID(), author: "阿溪", text: reply }]);
        }, 700);
      }}
    />
  );
}
