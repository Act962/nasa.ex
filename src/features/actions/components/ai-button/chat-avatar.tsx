import { Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function ChatAvatar({ role }: { role: "user" | "assistant" | "system" }) {
  if (role === "user") {
    return (
      <Avatar className="size-8 border border-line shrink-0">
        <AvatarFallback className="bg-card text-[10px] text-muted-foreground">
          EU
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <Avatar className="size-8 border border-line shrink-0">
      <AvatarImage src="/nasa-icon.png" />
      <AvatarFallback className="bg-info/20 text-info">
        <Sparkles className="size-4" />
      </AvatarFallback>
    </Avatar>
  );
}
