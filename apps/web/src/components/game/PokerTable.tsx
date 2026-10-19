import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AvatarName, PixelAvatar } from "@/components/game/PixelAvatar";
import { PlayingCard, type PlayingCardData } from "@/components/game/PlayingCard";
import { Chip } from "@/components/game/Chip";
import { TableBackground, type TableTheme } from "@/components/game/TableBackground";
import { cn } from "@/lib/utils";

export interface TablePlayer {
  id: string;
  name: string;
  avatar: AvatarName;
  chips: number;
  bet: number;
  cards: PlayingCardData[];
  hiddenCards: number;
  folded: boolean;
  active: boolean;
  dealer: boolean;
  smallBlind: boolean;
  bigBlind: boolean;
  action?: string;
  style?: string;
}

const POSITIONS = [
  [50, 86], [19, 79], [8, 54], [13, 25], [36, 9],
  [64, 9], [87, 25], [92, 54], [81, 79],
] as const;

const STAGE_NAMES: Record<string, string> = {
  preflop: "翻牌前",
  flop: "翻牌",
  turn: "转牌",
  river: "河牌",
  showdown: "摊牌",
  complete: "本手结束",
};

interface PokerTableProps {
  players: TablePlayer[];
  localPlayerId: string;
  community: PlayingCardData[];
  pot: number;
  stage: string;
  handNumber: number;
  theme: TableTheme;
  cardBack: "river" | "amber" | "violet";
}

interface MobilePlayerProps {
  player: TablePlayer;
  cardBack: "river" | "amber" | "violet";
}

function MobilePlayerMarkers({ player }: { player: TablePlayer }) {
  if (!player.dealer && !player.smallBlind && !player.bigBlind && !player.style) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {player.dealer && <Badge variant="warning" className="px-1 text-xs">D</Badge>}
      {player.smallBlind && <Badge variant="info" className="px-1 text-xs">SB</Badge>}
      {player.bigBlind && <Badge variant="destructive" className="px-1 text-xs">BB</Badge>}
      {player.style && <Badge variant="outline" className="px-1 text-xs">{player.style}</Badge>}
    </div>
  );
}

function MobileOpponentCard({ player }: { player: TablePlayer }) {
  return (
    <Card className="flex min-w-0 flex-col gap-1 rounded-sm border border-border bg-background/85 p-1.5">
      <div className="flex items-center gap-1">
        <PixelAvatar
          name={player.avatar}
          label={`${player.name}的头像`}
          active={player.active}
          folded={player.folded}
          className={cn("size-6 shrink-0", player.active && "turn-pulse")}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold">
            {player.name}
            {player.active && <span className="sr-only">（当前行动）</span>}
          </div>
          <div className="flex items-center gap-1 text-xs text-primary">
            <Chip className="size-2 shrink-0" />
            <span>{player.chips}</span>
          </div>
        </div>
      </div>

      <MobilePlayerMarkers player={player} />

      <div className="flex flex-wrap items-center gap-0.5">
        {player.bet > 0 && <Badge variant="secondary" className="px-1 text-xs">已下 {player.bet}</Badge>}
        {player.action && <span className="break-words text-xs text-foreground/70">{player.action}</span>}
      </div>

      {player.cards.length > 0 ? (
        <div className="flex items-start justify-center">
          {player.cards.map((card, cardIndex) => (
            <PlayingCard
              key={`${card.rank}-${card.suit}-${cardIndex}`}
              card={card}
              size="sm"
              className={cn("deal-in h-10 w-7 text-xs", cardIndex > 0 && "-ml-2")}
            />
          ))}
        </div>
      ) : player.hiddenCards > 0 ? (
        <div className="text-center text-xs text-muted-foreground">{player.hiddenCards}张</div>
      ) : null}
    </Card>
  );
}

function MobileLocalPlayer({ player, cardBack }: MobilePlayerProps) {
  return (
    <Card className="mt-auto flex items-center gap-2 rounded-sm border border-border bg-background/85 p-2">
      <PixelAvatar
        name={player.avatar}
        label={`${player.name}的头像`}
        active={player.active}
        folded={player.folded}
        className={cn("size-12 shrink-0", player.active && "turn-pulse")}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="truncate text-xs font-bold">
          {player.name}
          {player.active && <span className="sr-only">（当前行动）</span>}
        </div>
        <div className="flex items-center gap-1 text-xs text-primary">
          <Chip className="size-2.5 shrink-0" />
          <span>{player.chips}</span>
        </div>
        <MobilePlayerMarkers player={player} />
        <div className="flex flex-wrap items-center gap-1">
          {player.bet > 0 && <Badge variant="secondary" className="px-1 text-xs">已下 {player.bet}</Badge>}
          {player.action && <span className="break-words text-xs text-foreground/70">{player.action}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-start justify-center">
        {player.cards.map((card, cardIndex) => (
          <PlayingCard
            key={`${card.rank}-${card.suit}-${cardIndex}`}
            card={card}
            size="sm"
            className={cn("deal-in", cardIndex > 0 && "-ml-3")}
          />
        ))}
        {Array.from({ length: player.hiddenCards }, (_, cardIndex) => (
          <PlayingCard
            key={`hidden-${cardIndex}`}
            hidden
            back={cardBack}
            size="sm"
            className={cn(cardIndex > 0 && "-ml-5")}
          />
        ))}
      </div>
    </Card>
  );
}

export function PokerTable({
  players,
  localPlayerId,
  community,
  pot,
  stage,
  handNumber,
  theme,
  cardBack,
}: PokerTableProps) {
  const localIndex = Math.max(0, players.findIndex((player) => player.id === localPlayerId));
  const ordered = players.slice(localIndex).concat(players.slice(0, localIndex));
  const localPlayer = players.find((player) => player.id === localPlayerId);
  const opponents = ordered.filter((player) => player.id !== localPlayerId);

  return (
    <div className="relative min-h-[600px] flex-1 overflow-hidden sm:min-h-[620px]">
      <TableBackground theme={theme} />
      <div className="relative z-10 flex h-full min-h-[inherit] flex-col p-3 sm:p-5">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <Badge variant="secondary" className="text-xs sm:text-sm">第 {handNumber} 手</Badge>
          <Badge variant="primary" className="text-xs sm:text-sm">{STAGE_NAMES[stage] ?? stage}</Badge>
        </div>

        <div className="relative min-h-[540px] flex-1 sm:min-h-[530px]">
          <div className="table-felt absolute inset-x-[7%] inset-y-[13%] rounded-[46%]" />

          <div className="relative flex min-h-[540px] flex-col gap-2 sm:hidden">
            <div className="grid grid-cols-4 gap-1">
              {opponents.map((player) => (
                <MobileOpponentCard key={player.id} player={player} />
              ))}
            </div>

            <div className="flex min-h-28 flex-1 flex-col items-center justify-center gap-2 py-3">
              <div className="flex items-center gap-2 rounded-sm bg-background/85 px-3 py-1.5 shadow-md">
                <Chip />
                <span className="text-xs text-muted-foreground">底池</span>
                <strong className="text-lg text-primary">{pot}</strong>
              </div>
              <div className="flex min-h-14 items-center gap-1">
                {community.map((card, index) => (
                  <PlayingCard key={`${card.rank}-${card.suit}-${index}`} card={card} size="sm" className="deal-in" />
                ))}
                {Array.from({ length: Math.max(0, 5 - community.length) }, (_, index) => (
                  <span key={`empty-${index}`} className="h-14 w-10 rounded-sm border border-dashed border-foreground/15" aria-hidden="true" />
                ))}
              </div>
            </div>

            {localPlayer && <MobileLocalPlayer player={localPlayer} cardBack={cardBack} />}
          </div>

          <div className="absolute inset-0 hidden sm:block">
            <div className="absolute left-1/2 top-[43%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
              <div className="flex items-center gap-2 rounded-sm bg-background/85 px-4 py-2 shadow-md">
                <Chip />
                <span className="text-sm text-muted-foreground">底池</span>
                <strong className="text-xl text-primary">{pot}</strong>
              </div>
              <div className="flex min-h-20 items-center gap-1 sm:gap-2">
                {community.map((card, index) => (
                  <PlayingCard key={`${card.rank}-${card.suit}-${index}`} card={card} size="sm" className="deal-in sm:h-20 sm:w-14 sm:text-xl" />
                ))}
                {Array.from({ length: Math.max(0, 5 - community.length) }, (_, index) => (
                  <span key={`empty-${index}`} className="h-14 w-10 rounded-sm border border-dashed border-foreground/15 sm:h-20 sm:w-14" aria-hidden="true" />
                ))}
              </div>
            </div>

            {ordered.map((player, index) => {
              const position = POSITIONS[index] ?? POSITIONS[0];
              const isLocal = player.id === localPlayerId;
              return (
                <div
                  key={player.id}
                  className="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 sm:w-32"
                  style={{ left: `${position[0]}%`, top: `clamp(48px, ${position[1]}%, calc(100% - 84px))` }}
                >
                  <div className="relative">
                    <PixelAvatar
                      name={player.avatar}
                      label={`${player.name}的头像`}
                      active={player.active}
                      folded={player.folded}
                      className={cn("size-12 sm:size-14", player.active && "turn-pulse")}
                    />
                    <div className="absolute -right-3 -top-2 flex gap-1">
                      {player.dealer && <Badge variant="warning" className="px-1.5 text-xs">D</Badge>}
                      {player.smallBlind && <Badge variant="info" className="px-1.5 text-xs">SB</Badge>}
                      {player.bigBlind && <Badge variant="destructive" className="px-1.5 text-xs">BB</Badge>}
                    </div>
                  </div>
                  <div className="max-w-full truncate text-center text-xs font-bold sm:text-sm">
                    {player.name}
                    {player.active && <span className="sr-only">（当前行动）</span>}
                  </div>
                  {player.style && <Badge variant="outline" className="px-1 text-xs">{player.style}</Badge>}
                  <div className="flex items-center gap-1 text-xs text-primary sm:text-sm">
                    <Chip className="size-2.5" />
                    <span>{player.chips}</span>
                  </div>
                  {player.bet > 0 && <Badge variant="secondary" className="text-xs sm:text-sm">已下 {player.bet}</Badge>}
                  {player.action && <span className="text-xs text-foreground/70">{player.action}</span>}
                  <div className={cn("min-h-10 items-start justify-center", player.cards.length > 0 ? "flex" : "hidden sm:flex")}>
                    {player.cards.map((card, cardIndex) => (
                      <PlayingCard
                        key={`${card.rank}-${card.suit}-${cardIndex}`}
                        card={card}
                        size="sm"
                        className={cn("deal-in", cardIndex > 0 && "-ml-3", isLocal && "sm:h-20 sm:w-14 sm:text-xl")}
                      />
                    ))}
                    {Array.from({ length: player.hiddenCards }, (_, cardIndex) => (
                      <PlayingCard
                        key={`hidden-${cardIndex}`}
                        hidden
                        back={cardBack}
                        size="sm"
                        className={cn(cardIndex > 0 && "-ml-5")}
                      />
                    ))}
                  </div>
                  {player.hiddenCards > 0 && <Badge variant="secondary" className="text-xs sm:hidden">{player.hiddenCards} 张牌</Badge>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
