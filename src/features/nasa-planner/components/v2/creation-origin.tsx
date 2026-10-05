import { Bot, Clapperboard, Sparkles } from "lucide-react";

/** Origem de um conteúdo criado por IA (spec 0065): selo no card do Kanban e no Dashboard. */

type OriginSource = { source: string; sourceActorLabel: string | null };

export function creationOriginLabel(post: OriginSource): string | null {
  if (post.sourceActorLabel) return post.sourceActorLabel;
  if (post.source === "ASTRO") return "Astro";
  if (post.source === "WHATSAPP") return "Astro · WhatsApp";
  if (post.source === "MCP") return "IA";
  return null;
}

export function OriginBadge({ label }: { label: string }) {
  const Icon = /remotion/i.test(label) ? Clapperboard : /astro/i.test(label) ? Sparkles : Bot;
  return (
    <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
      <Icon className="size-3 shrink-0" /> <span className="truncate">{label}</span>
    </span>
  );
}
