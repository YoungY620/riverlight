import { useState } from "react";
import type { BotDifficulty } from "@riverlight/engine";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AVATARS, type AvatarName } from "@/components/game/PixelAvatar";
import { TABLE_THEMES, type TableTheme } from "@/components/game/TableBackground";
import { MusicIcon } from "@/components/icons";

export type CardBack = "river" | "amber" | "violet";

interface GameSettingsProps {
  avatar: AvatarName;
  theme: TableTheme;
  cardBack: CardBack;
  musicEnabled: boolean;
  botDifficulty?: BotDifficulty;
  onBotDifficultyChange?: (difficulty: BotDifficulty) => void;
  onChange: (settings: { avatar?: AvatarName; theme?: TableTheme; cardBack?: CardBack }) => void;
  onMusicToggle: () => void;
}

const THEME_NAMES: Record<TableTheme, string> = {
  river: "夜河",
  walnut: "胡桃木",
  garden: "雨后庭院",
};

const BACK_NAMES: Record<CardBack, string> = {
  river: "河流",
  amber: "暖阳",
  violet: "紫晶",
};

const DIFFICULTY_NAMES: Record<BotDifficulty, string> = {
  beginner: "新手",
  intermediate: "标准",
  advanced: "进阶",
  expert: "专家",
};

export function GameSettings({ avatar, theme, cardBack, musicEnabled, botDifficulty, onBotDifficultyChange, onChange, onMusicToggle }: GameSettingsProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>个性化</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>桌面与外观</DialogTitle>
            <DialogDescription>设置仅影响这台设备的显示。</DialogDescription>
          </DialogHeader>

          <fieldset className="grid gap-2">
            <legend className="text-sm text-muted-foreground">头像</legend>
            <div className="grid grid-cols-6 gap-2">
              {AVATARS.map((name) => (
                <Button
                  key={name}
                  variant={avatar === name ? "primary" : "outline"}
                  size="icon"
                  className="h-12 w-full"
                  aria-label={`选择${name}头像`}
                  aria-pressed={avatar === name}
                  onClick={() => onChange({ avatar: name })}
                >
                  <img src={`assets/avatar-${name}.png`} alt="" className="pixelated size-9" />
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="text-sm text-muted-foreground">桌面主题</legend>
            <div className="grid grid-cols-3 gap-2">
              {TABLE_THEMES.map((name) => (
                <Button
                  key={name}
                  variant={theme === name ? "primary" : "outline"}
                  className="h-auto px-2 py-2"
                  aria-pressed={theme === name}
                  onClick={() => onChange({ theme: name })}
                >
                  <span className="grid w-full gap-1 normal-case tracking-normal">
                    <img src={`assets/theme-${name}.png`} alt="" className="pixelated h-12 w-full rounded-sm object-cover" />
                    <span className="text-xs">{THEME_NAMES[name]}</span>
                  </span>
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="text-sm text-muted-foreground">卡背</legend>
            <div className="grid grid-cols-3 gap-2">
              {(["river", "amber", "violet"] as CardBack[]).map((name) => (
                <Button
                  key={name}
                  variant={cardBack === name ? "primary" : "outline"}
                  className="h-auto px-2 py-2"
                  aria-pressed={cardBack === name}
                  onClick={() => onChange({ cardBack: name })}
                >
                  <span className="flex items-center gap-2 normal-case tracking-normal">
                    <img src={`assets/back-${name}.png`} alt="" className="pixelated h-10 w-7" />
                    <span className="text-xs">{BACK_NAMES[name]}</span>
                  </span>
                </Button>
              ))}
            </div>
          </fieldset>

          {botDifficulty && onBotDifficultyChange && (
            <fieldset className="grid gap-2">
              <legend className="text-sm text-muted-foreground">Bot 难度（本地脚本）</legend>
              <div className="grid grid-cols-4 gap-2">
                {(["beginner", "intermediate", "advanced", "expert"] as BotDifficulty[]).map((name) => (
                  <Button
                    key={name}
                    variant={botDifficulty === name ? "primary" : "outline"}
                    className="h-10 px-2"
                    aria-pressed={botDifficulty === name}
                    onClick={() => onBotDifficultyChange(name)}
                  >
                    {DIFFICULTY_NAMES[name]}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">调整估算精度、纪律性和错误率，不使用 AI 模型。</p>
            </fieldset>
          )}

          <Button variant="secondary" onClick={onMusicToggle} aria-pressed={musicEnabled}>
            <MusicIcon className="size-4" />
            {musicEnabled ? "关闭音乐与环境音" : "开启音乐与环境音"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
