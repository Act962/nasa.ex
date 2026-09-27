"use client";

import { toast } from "sonner";
import { Copy, ExternalLink, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInChatLink } from "@/features/tracking-chat/hooks/use-in-chat-link";

/**
 * Faixa do canal "Chat do site": o link público que a empresa divulga no site,
 * na bio ou em campanha. Sem link divulgado, ninguém chega por este canal.
 */
export function InChatLinkBar({ trackingId }: { trackingId: string | null }) {
  const { url } = useInChatLink(trackingId);
  if (!url) return null;

  return (
    <div className="mt-2 flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/5 px-3 py-2">
      <Globe className="size-4 shrink-0 text-violet-500" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium">Link do chat do site</p>
        <p className="truncate text-[11px] text-muted-foreground">{url}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        aria-label="Copiar link"
        onClick={() => {
          void navigator.clipboard.writeText(url);
          toast.success("Link copiado");
        }}
      >
        <Copy className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Abrir chat do site">
          <ExternalLink className="size-4" />
        </a>
      </Button>
    </div>
  );
}
