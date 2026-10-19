import { useEffect, useState } from "react";
import type { BotDifficulty } from "@riverlight/engine";
import { HomeScreen } from "@/components/HomeScreen";
import { PracticeScreen } from "@/components/PracticeScreen";
import { HostScreen } from "@/components/HostScreen";
import { GuestScreen } from "@/components/GuestScreen";
import type { AvatarName } from "@/components/game/PixelAvatar";
import type { TableTheme } from "@/components/game/TableBackground";
import type { CardBack } from "@/components/game/GameSettings";
import { riverlightAudio } from "@/lib/audio";

type Screen =
  | { kind: "home" }
  | { kind: "practice"; name: string }
  | { kind: "host"; name: string; password: string }
  | { kind: "guest"; name: string; invite: string; password: string };

interface Preferences {
  name: string;
  avatar: AvatarName;
  theme: TableTheme;
  cardBack: CardBack;
  musicEnabled: boolean;
  botDifficulty: BotDifficulty;
}

const DEFAULTS: Preferences = {
  name: "新玩家",
  avatar: "otter",
  theme: "river",
  cardBack: "river",
  musicEnabled: true,
  botDifficulty: "intermediate",
};

function loadPreferences(): Preferences {
  try {
    const stored = localStorage.getItem("riverlight-preferences-v1");
    return stored ? { ...DEFAULTS, ...JSON.parse(stored) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);

  useEffect(() => {
    localStorage.setItem("riverlight-preferences-v1", JSON.stringify(preferences));
  }, [preferences]);

  const shared = {
    avatar: preferences.avatar,
    theme: preferences.theme,
    cardBack: preferences.cardBack,
    musicEnabled: preferences.musicEnabled,
    botDifficulty: preferences.botDifficulty,
    onBotDifficultyChange: (botDifficulty: BotDifficulty) => {
      setPreferences((current) => ({ ...current, botDifficulty }));
    },
    onSettingsChange: (settings: { avatar?: AvatarName; theme?: TableTheme; cardBack?: CardBack }) => {
      setPreferences((current) => ({ ...current, ...settings }));
    },
    onMusicToggle: () => {
      const enabled = !preferences.musicEnabled;
      setPreferences((current) => ({ ...current, musicEnabled: enabled }));
      void riverlightAudio.setMusicEnabled(enabled);
    },
    onExit: () => setScreen({ kind: "home" }),
  };

  if (screen.kind === "practice") {
    return <PracticeScreen {...shared} name={screen.name} />;
  }
  if (screen.kind === "host") {
    return <HostScreen {...shared} name={screen.name} password={screen.password} />;
  }
  if (screen.kind === "guest") {
    return <GuestScreen {...shared} name={screen.name} invite={screen.invite} password={screen.password} />;
  }

  return (
    <HomeScreen
      initialName={preferences.name}
      musicEnabled={preferences.musicEnabled}
      onMusicToggle={shared.onMusicToggle}
      onPractice={(name) => {
        setPreferences((current) => ({ ...current, name }));
        void riverlightAudio.setMusicEnabled(preferences.musicEnabled);
        void riverlightAudio.start();
        setScreen({ kind: "practice", name });
      }}
      onHost={(name, password) => {
        setPreferences((current) => ({ ...current, name }));
        void riverlightAudio.setMusicEnabled(preferences.musicEnabled);
        void riverlightAudio.start();
        setScreen({ kind: "host", name, password });
      }}
      onJoin={(name, invite, password) => {
        setPreferences((current) => ({ ...current, name }));
        void riverlightAudio.setMusicEnabled(preferences.musicEnabled);
        void riverlightAudio.start();
        setScreen({ kind: "guest", name, invite, password });
      }}
    />
  );
}
