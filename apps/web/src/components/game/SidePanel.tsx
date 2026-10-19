import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface ChatMessage {
  id: string;
  author: string;
  text: string;
  system?: boolean;
}

interface SidePanelProps {
  messages: ChatMessage[];
  handLog: string[];
  fairness?: ReactNode;
  onChat: (text: string) => void;
}

export function SidePanel({ messages, handLog, fairness, onChat }: SidePanelProps) {
  const [draft, setDraft] = useState("");

  return (
    <Tabs defaultValue="chat" className="flex min-h-72 flex-col border-t border-border bg-card p-3 lg:h-full lg:border-l lg:border-t-0">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="chat">聊天</TabsTrigger>
        <TabsTrigger value="log">牌局记录</TabsTrigger>
        <TabsTrigger value="verify">验牌</TabsTrigger>
      </TabsList>

      <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="min-h-40 flex-1">
          <div role="log" aria-live="polite" className="grid gap-3 p-2">
            {messages.length === 0 && <p className="text-sm text-muted-foreground">还没有消息。</p>}
            {messages.map((message) => (
              <div key={message.id} className="text-sm leading-relaxed">
                {message.system ? (
                  <span className="text-muted-foreground">{message.text}</span>
                ) : (
                  <><strong className="mr-2 text-primary">{message.author}</strong><span>{message.text}</span></>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const text = draft.trim();
            if (!text) return;
            onChat(text.slice(0, 280));
            setDraft("");
          }}
        >
          <div className="flex-1">
            <label htmlFor="chat-message" className="sr-only">聊天消息</label>
            <Input
              id="chat-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="说点什么…"
              maxLength={280}
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="primary">发送</Button>
        </form>
      </TabsContent>

      <TabsContent value="log" className="min-h-0 flex-1">
        <ScrollArea className="h-64 lg:h-full">
          <ol className="grid gap-2 p-2 text-sm text-muted-foreground">
            {handLog.length === 0 && <li>等待第一手牌。</li>}
            {handLog.map((entry, index) => <li key={`${index}-${entry}`}>{entry}</li>)}
          </ol>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="verify" className="min-h-0 flex-1">
        <ScrollArea className="h-64 lg:h-full">
          <div className="p-2">{fairness ?? <p className="text-sm text-muted-foreground">第一手开始后生成承诺数据。</p>}</div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
