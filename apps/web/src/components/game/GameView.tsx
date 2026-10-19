import type { ReactNode } from "react";
import type { Card, GameSnapshot, PlayerAction } from "@riverlight/engine";
import { Button } from "@/components/ui/button";
import { ActionBar, type LegalActionState } from "@/components/game/ActionBar";
import { PokerTable, type TablePlayer } from "@/components/game/PokerTable";
import type { PlayingCardData, CardSuit } from "@/components/game/PlayingCard";
import type { AvatarName } from "@/components/game/PixelAvatar";
import { SidePanel, type ChatMessage } from "@/components/game/SidePanel";
import type { TableTheme } from "@/components/game/TableBackground";
import type { CardBack } from "@/components/game/GameSettings";

const SUITS: Record<Card["suit"], CardSuit> = {
  c: "clubs",
  d: "diamonds",
  h: "hearts",
  s: "spades",
};

const ACTION_NAMES: Record<string, string> = {
  fold: "弃牌",
  check: "过牌",
  call: "跟注",
  bet: "下注",
  raise: "加注",
  "all-in": "全下",
};

export function toPlayingCard(card: Card): PlayingCardData {
  return { rank: card.rank === 10 ? "10" : ({ 11: "J", 12: "Q", 13: "K", 14: "A" } as Record<number, string>)[card.rank] ?? String(card.rank), suit: SUITS[card.suit] };
}

export function toLegalActionState(snapshot: GameSnapshot): LegalActionState | null {
  const legal = snapshot.legalActions;
  if (!legal?.canAct) return null;
  return {
    canFold: legal.canFold,
    canCheck: legal.canCheck,
    canCall: legal.canCall,
    callAmount: legal.callAmount,
    canRaise: legal.canBet || legal.canRaise,
    minRaiseTo: (legal.canBet ? legal.minBet : legal.minRaiseTo) ?? 0,
    maxRaiseTo: legal.maxBetTo,
    canAllIn: legal.canAllIn,
    allInTo: legal.maxBetTo,
  };
}

interface GameViewProps {
  snapshot: GameSnapshot;
  localPlayerId: string;
  avatars: Record<string, AvatarName>;
  playerStyles?: Record<string, string>;
  theme: TableTheme;
  cardBack: CardBack;
  messages: ChatMessage[];
  handLog: string[];
  fairness?: ReactNode;
  settings: ReactNode;
  onExit: () => void;
  onNextHand?: () => void;
  onAction: (action: PlayerAction) => void;
  onChat: (text: string) => void;
}

export function GameView({
  snapshot,
  localPlayerId,
  avatars,
  playerStyles,
  theme,
  cardBack,
  messages,
  handLog,
  fairness,
  settings,
  onExit,
  onNextHand,
  onAction,
  onChat,
}: GameViewProps) {
  const players: TablePlayer[] = snapshot.players.map((player, index) => ({
    id: player.id,
    name: player.name,
    avatar: avatars[player.id] ?? (["otter", "cat", "frog", "fox", "rabbit", "fish"] as const)[index % 6] ?? "otter",
    chips: player.stack,
    bet: player.bet,
    cards: player.holeCards.map(toPlayingCard),
    hiddenCards: player.holeCards.length === 0 && player.inHand && !player.folded ? 2 : 0,
    folded: player.folded,
    active: snapshot.currentPlayerId === player.id,
    dealer: snapshot.buttonIndex === index,
    smallBlind: snapshot.smallBlindIndex === index,
    bigBlind: snapshot.bigBlindIndex === index,
    action: player.lastAction ? ACTION_NAMES[player.lastAction] : undefined,
    style: playerStyles?.[player.id],
  }));
  const winners = snapshot.result?.winnerIds.map((id) => snapshot.players.find((player) => player.id === id)?.name ?? id) ?? [];

  return (
    <main className="flex min-h-dvh flex-col bg-background lg:h-dvh lg:overflow-hidden">
      <header className="z-20 flex items-center justify-between border-b border-border bg-background px-3 py-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onExit}>离开</Button>
          <img src="assets/emblem.png" alt="" className="pixelated size-7" />
          <span className="hidden text-sm font-bold sm:inline">Riverlight</span>
        </div>
        <div className="flex items-center gap-1">{settings}</div>
      </header>
      <div className="sr-only" role="status" aria-live="polite">
        {snapshot.currentPlayerId === null
          ? "等待下一阶段"
          : snapshot.currentPlayerId === localPlayerId
            ? "轮到你行动"
            : `${snapshot.players.find((player) => player.id === snapshot.currentPlayerId)?.name ?? "其他玩家"} 行动中`}
      </div>

      <div className="grid flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-h-0 flex-col" aria-label="扑克牌桌">
          <PokerTable
            players={players}
            localPlayerId={localPlayerId}
            community={snapshot.community.map(toPlayingCard)}
            pot={snapshot.pot}
            stage={snapshot.phase}
            handNumber={snapshot.handNumber}
            theme={theme}
            cardBack={cardBack}
          />
          {snapshot.result && (
            <div className="flex items-center justify-center gap-3 border-t border-primary/30 bg-primary px-4 py-2 text-center text-sm font-bold text-primary-foreground" role="status">
              <span>{winners.join("、")} 赢得本手</span>
              {onNextHand && <Button variant="secondary" size="sm" onClick={onNextHand}>下一手</Button>}
            </div>
          )}
          <ActionBar
            legal={toLegalActionState(snapshot)}
            onAction={(type, amount) => {
              if (type === "raise") {
                onAction({ type: snapshot.currentBet === 0 ? "bet" : "raise", amount: amount ?? 0 });
              } else {
                onAction({ type });
              }
            }}
          />
        </section>
        <SidePanel messages={messages} handLog={handLog} fairness={fairness} onChat={onChat} />
      </div>
    </main>
  );
}
