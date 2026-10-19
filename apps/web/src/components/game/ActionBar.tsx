import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface LegalActionState {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
  canAllIn: boolean;
  allInTo: number;
}

interface ActionBarProps {
  legal: LegalActionState | null;
  onAction: (action: "fold" | "check" | "call" | "raise" | "all-in", raiseTo?: number) => void;
}

export function ActionBar({ legal, onAction }: ActionBarProps) {
  const [raiseTo, setRaiseTo] = useState(legal?.minRaiseTo ?? 0);
  const [raiseOpen, setRaiseOpen] = useState(false);

  useEffect(() => {
    if (legal?.canRaise) setRaiseTo(legal.minRaiseTo);
    setRaiseOpen(false);
  }, [legal?.minRaiseTo, legal?.canRaise]);

  return (
    <div className="safe-bottom border-t border-border bg-background/95 p-3 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-wrap items-end justify-center gap-2 sm:flex-nowrap">
        <Button
          variant="destructive"
          className="min-w-20 flex-1"
          disabled={!legal?.canFold}
          onClick={() => onAction("fold")}
        >
          弃牌
        </Button>
        <Button
          variant="secondary"
          className="min-w-24 flex-1"
          disabled={!legal?.canCheck && !legal?.canCall}
          onClick={() => onAction(legal?.canCheck ? "check" : "call")}
        >
          {legal?.canCheck ? "过牌" : legal?.canCall ? `跟注 ${legal.callAmount}` : "等待"}
        </Button>
        {raiseOpen && legal?.canRaise ? (
          <div id="raise-controls" className="flex min-w-52 flex-1 items-end gap-2">
            <div className="grid flex-1 gap-1">
              <label htmlFor="raise-to" className="text-xs text-muted-foreground">加注到</label>
              <Input
                id="raise-to"
                type="number"
                inputMode="numeric"
                min={legal.minRaiseTo}
                max={legal.maxRaiseTo}
                value={raiseTo}
                onChange={(event) => setRaiseTo(Number(event.target.value))}
                className="h-9"
              />
            </div>
            <Button variant="primary" onClick={() => onAction("raise", raiseTo)}>确认</Button>
            <Button variant="outline" disabled={!legal.canAllIn} onClick={() => onAction("all-in", legal.allInTo)}>全下</Button>
          </div>
        ) : (
          <Button
            variant="primary"
            className="min-w-24 flex-1"
            disabled={!legal?.canRaise}
            aria-expanded={raiseOpen}
            aria-controls="raise-controls"
            onClick={() => setRaiseOpen(true)}
          >
            加注
          </Button>
        )}
      </div>
    </div>
  );
}
