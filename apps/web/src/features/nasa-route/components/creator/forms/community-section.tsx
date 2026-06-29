"use client";

import { MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  COMMUNITY_TYPES,
  COMMUNITY_TYPE_LABELS,
  type CommunityType,
} from "@/features/nasa-route/lib/formats";

const TYPE_ICON: Record<CommunityType, string> = {
  whatsapp: "💚",
  telegram: "✈️",
  discord: "🎮",
  other: "🔗",
};

const TYPE_PLACEHOLDER: Record<CommunityType, string> = {
  whatsapp: "https://chat.whatsapp.com/...",
  telegram: "https://t.me/...",
  discord: "https://discord.gg/...",
  other: "https://...",
};

export interface CommunityData {
  communityType: CommunityType | null;
  communityInviteUrl: string | null;
  communityRules: string | null;
}

interface Props {
  value: CommunityData;
  onChange: (next: CommunityData) => void;
}

export function CommunitySection({ value, onChange }: Props) {
  const selected = value.communityType;

  return (
    <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800/40 dark:bg-emerald-900/10">
      <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
        <MessageCircle className="size-4" />
        <h3 className="text-sm font-semibold">Detalhes da comunidade</h3>
      </div>

      <div className="space-y-2">
        <Label>Tipo *</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {COMMUNITY_TYPES.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => onChange({ ...value, communityType: t })}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-xs font-medium transition",
                selected === t
                  ? "border-emerald-500 bg-emerald-100 dark:bg-emerald-800/30"
                  : "border-border hover:border-emerald-300",
              )}
            >
              <span className="text-xl">{TYPE_ICON[t]}</span>
              {COMMUNITY_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="communityInviteUrl">Link de convite *</Label>
        <Input
          id="communityInviteUrl"
          type="url"
          value={value.communityInviteUrl ?? ""}
          onChange={(e) =>
            onChange({ ...value, communityInviteUrl: e.target.value || null })
          }
          placeholder={selected ? TYPE_PLACEHOLDER[selected] : "https://..."}
          required
        />
        <p className="text-xs text-muted-foreground">
          O link é mostrado pro aluno na tela do produto após a compra.
          Mantenha-o atualizado se o grupo for trocado.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="communityRules">Regras / observações (opcional)</Label>
        <Textarea
          id="communityRules"
          value={value.communityRules ?? ""}
          onChange={(e) =>
            onChange({ ...value, communityRules: e.target.value || null })
          }
          placeholder="Ex.: Use seu nome real. Proibido spam. Modere a si mesmo."
          rows={4}
        />
      </div>
    </div>
  );
}
