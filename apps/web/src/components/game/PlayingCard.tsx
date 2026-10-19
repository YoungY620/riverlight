import { cn } from "@/lib/utils";

export type CardSuit = "spades" | "hearts" | "clubs" | "diamonds";

export interface PlayingCardData {
  rank: string;
  suit: CardSuit;
}

const SUIT_GLYPHS: Record<CardSuit, string> = {
  spades: "♠",
  hearts: "♥",
  clubs: "♣",
  diamonds: "♦",
};

const SUIT_NAMES: Record<CardSuit, string> = {
  spades: "黑桃",
  hearts: "红桃",
  clubs: "梅花",
  diamonds: "方块",
};

interface PlayingCardProps {
  card?: PlayingCardData;
  hidden?: boolean;
  back?: "river" | "amber" | "violet";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PlayingCard({
  card,
  hidden = false,
  back = "river",
  size = "md",
  className,
}: PlayingCardProps) {
  const dimensions = {
    sm: "h-14 w-10 text-base",
    md: "h-20 w-14 text-xl",
    lg: "h-28 w-20 text-2xl",
  }[size];

  if (hidden || !card) {
    return (
      <img
        className={cn("pixel-card pixelated select-none object-cover", dimensions, className)}
        src={`assets/back-${back}.png`}
        alt="未公开的牌"
        draggable={false}
      />
    );
  }

  const red = card.suit === "hearts" || card.suit === "diamonds";
  return (
    <div
      className={cn(
        "pixel-card relative select-none bg-foreground font-serif font-bold text-background",
        dimensions,
        red && "text-destructive",
        className,
      )}
      role="img"
      aria-label={`${SUIT_NAMES[card.suit]} ${card.rank}`}
    >
      <div aria-hidden="true" className="absolute left-1 top-0.5 flex flex-col items-center leading-none">
        <span>{card.rank}</span>
        <span className="mt-0.5 text-[0.8em]">{SUIT_GLYPHS[card.suit]}</span>
      </div>
      <span aria-hidden="true" className="absolute bottom-1 right-1 text-[1.55em] leading-none">
        {SUIT_GLYPHS[card.suit]}
      </span>
    </div>
  );
}
