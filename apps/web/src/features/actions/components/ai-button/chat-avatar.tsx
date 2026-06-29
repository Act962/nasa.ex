import { Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function ChatAvatar({ role }: { role: "user" | "assistant" | "system" }) {
  if (role === "user") {
    return (
      <Avatar className="size-8 border border-zinc-800 shrink-0">
        <AvatarFallback className="bg-zinc-800 text-[10px] text-zinc-400">
          EU
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <Avatar className="size-8 border border-zinc-800 shrink-0">
      <AvatarImage src="/nasa-icon.png" />
      <AvatarFallback className="bg-purple-500/20 text-purple-400">
        <Sparkles className="size-4" />
      </AvatarFallback>
    </Avatar>
  );
}
