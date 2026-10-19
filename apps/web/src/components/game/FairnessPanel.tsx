import { useMemo, useState } from "react";
import { createDeckCommitment, createShuffledDeck, verifyDeckCommitment } from "@riverlight/engine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyIcon } from "@/components/icons";

interface FairnessPanelProps {
  seed: string;
  handNumber: number;
  complete: boolean;
}

export function FairnessPanel({ seed, handNumber, complete }: FairnessPanelProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const material = useMemo(
    () => createDeckCommitment(createShuffledDeck(seed), seed),
    [seed],
  );
  const verified = complete && verifyDeckCommitment(material.commitment, material.reveal);

  return (
    <div className="grid gap-3 text-sm">
      <p className="leading-relaxed text-muted-foreground">开局前锁定牌堆承诺，结束后公开材料。它能防止事后换牌，不能阻止房主提前读牌。</p>
      <div className="grid gap-1">
        <span className="text-muted-foreground">第 {handNumber} 手承诺</span>
        <code className="break-all rounded-sm bg-background p-2 text-xs text-foreground">{material.commitment}</code>
      </div>
      {complete ? (
        <>
          <Badge variant={verified ? "success" : "destructive"} className="w-fit">{verified ? "验证通过" : "验证失败"}</Badge>
          <div className="grid gap-1">
            <span className="text-muted-foreground">公开种子</span>
            <code className="break-all rounded-sm bg-background p-2 text-xs">{material.reveal.secret}</code>
          </div>
          <div className="grid gap-1">
            <span className="text-muted-foreground">完整牌序</span>
            <code className="break-all rounded-sm bg-background p-2 text-xs leading-relaxed">{material.reveal.deck.join(" ")}</code>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(JSON.stringify(material, null, 2));
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
      ) : (
        <Badge variant="secondary" className="w-fit">等待本手结束</Badge>
      )}
      {copyError && <p role="alert" className="text-sm text-destructive">{copyError}</p>}
    </div>
  );
}
