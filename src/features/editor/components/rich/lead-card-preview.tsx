import type { ReactNode } from "react";
import { WhatsappIcon } from "@/components/whatsapp";

// Card do lead, no desenho do funil, para representar o gatilho de um fluxo (spec 0090, RF-8).
// Só apresentação: não usa as lojas nem as gravações do card de verdade (`lead-item.tsx`).

export interface LeadCardTag {
  id: string;
  name: string;
  color?: string | null;
}

export function LeadCardPreview({ caption, tags, badge }: { caption: string; tags: LeadCardTag[]; badge?: ReactNode }) {
  return (
    <div className="w-[236px] rounded-2xl bg-card px-3 py-2.5 text-left">
      <div className="flex items-center gap-2.5">
        <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full border-[3px] border-warning border-l-border text-[11px] font-semibold text-muted-foreground">
          NL
          <span className="absolute -bottom-1 -left-1 flex size-4 items-center justify-center rounded-full border-2 border-card bg-brand-whatsapp text-white">
            <WhatsappIcon className="size-2" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">Nome do lead</span>
          <span className="block truncate text-xs text-muted-foreground">{caption}</span>
        </span>
        {badge && <span className="shrink-0 self-start text-muted-foreground">{badge}</span>}
      </div>
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="max-w-full truncate rounded-full bg-info px-2 py-0.5 text-[10.5px] font-medium text-white"
              // A cor da tag é dado do usuário, não cor de tema.
              style={tag.color ? { backgroundColor: tag.color } : undefined}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
