import { useMemo, useState } from "react";
import { verifyDeckCommitment, type DeckReveal } from "@riverlight/engine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyIcon } from "@/components/icons";

export interface OnlineFairnessPanelProps {
  handNumber: number;
  commitment: string;
  reveal?: DeckReveal | undefined;
}

export function OnlineFairnessPanel({ handNumber, commitment, reveal }: OnlineFairnessPanelProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const verified = useMemo(
    () => reveal === undefined ? null : verifyDeckCommitment(commitment, reveal),
    [commitment, reveal],
  );

  return (
    <div className="grid gap-3 text-sm">
      <p className="leading-relaxed text-muted-foreground">每手牌堆独立承诺，结束后才公开。承诺可防止事后换牌，不能阻止房主提前看牌。</p>
      <div className="grid gap-1">
        <span className="text-muted-foreground">第 {handNumber} 手承诺</span>
        <code className="break-all rounded-sm bg-background p-2 text-xs text-foreground">{commitment}</code>
      </div>
      {reveal === undefined ? (
        <Badge variant="secondary" className="w-fit">等待本手结束</Badge>
      ) : (
        <>
          <Badge variant={verified ? "success" : "destructive"} className="w-fit">
            {verified ? "验证通过" : "验证失败"}
          </Badge>
          <div className="grid gap-1">
            <span className="text-muted-foreground">本手公开密钥</span>
            <code className="break-all rounded-sm bg-background p-2 text-xs">{reveal.secret}</code>
          </div>
          <div className="grid gap-1">
            <span className="text-muted-foreground">本手完整牌序</span>
            <code className="break-all rounded-sm bg-background p-2 text-xs leading-relaxed">{reveal.deck.join(" ")}</code>
          </div>
          <Button className="min-h-11"
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(JSON.stringify({ handNumber, commitment, reveal }, null, 2));
                setCopied(true);
                setCopyError("");
              } catch {
                setCopyError("复制失败，请手动选择验证材料。");
              }
            }}
          >
            <CopyIcon className="size-4" />{copied ? "已复制" : "复制验证材料"}
          </Button>
        </>
      )}
      {copyError && <p role="alert" className="text-sm text-destructive"><span className="sr-only">错误：</span>{copyError}</p>}
    </div>
  );
}
