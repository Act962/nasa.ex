"use client";

import { Check } from "lucide-react";
import type { TrafegoPlatform } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { PlatformLogos } from "../platform-logos";

interface ChannelCard {
  value: TrafegoPlatform;
  title: string;
  subtitle: string;
  description: string;
  logos: string[];
}

/**
 * O subtítulo repete as marcas filhas ("Instagram + Facebook") porque muita
 * gente não reconhece "Meta" — reconhece onde o anúncio vai aparecer.
 */
const CHANNELS: ChannelCard[] = [
  {
    value: "META_ADS",
    title: "Tráfego pago no Meta",
    subtitle: "Instagram + Facebook",
    description: "Alcance novos clientes e gere demanda.",
    logos: ["meta", "instagram", "facebook"],
  },
  {
    value: "GOOGLE_ADS",
    title: "Tráfego pago no Google",
    subtitle: "Pesquisa + YouTube",
    description: "Encontre pessoas que já estão procurando o que você vende.",
    logos: ["google"],
  },
  {
    value: "WHATSAPP_OFICIAL",
    title: "Disparo no WhatsApp Oficial",
    subtitle: "Mensagens",
    description: "Envie mensagens para sua base com a API oficial da Meta.",
    logos: ["whatsapp"],
  },
];

export function ChannelStep({
  value,
  onSelect,
}: {
  value: TrafegoPlatform | null;
  onSelect: (value: TrafegoPlatform) => void;
}) {
  return (
    <div role="radiogroup" className="grid gap-3 md:grid-cols-3">
      {CHANNELS.map((channel) => {
        const isSelected = value === channel.value;
        return (
          <button
            key={channel.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(channel.value)}
            className={cn(
              "relative flex flex-col rounded-2xl border p-4 text-left transition sm:p-5",
              isSelected
                ? "border-violet-400 bg-violet-500/[0.09] shadow-[0_0_0_1px_rgba(167,139,250,0.3)]"
                : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
            )}
          >
            {isSelected && (
              <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-violet-500">
                <Check className="size-3 text-white" />
              </span>
            )}

            <span
              className={cn(
                "inline-flex w-fit items-center rounded-xl px-3 py-2.5 transition",
                isSelected ? "bg-white/[0.09]" : "bg-white/[0.05]",
              )}
            >
              <PlatformLogos slugs={channel.logos} />
            </span>

            <span className="mt-4 block text-[0.95rem] font-semibold leading-tight text-white">
              {channel.title}
            </span>
            <span className="mt-0.5 block text-xs font-medium text-violet-300/80">
              {channel.subtitle}
            </span>
            <span className="mt-2 block text-xs leading-relaxed text-white/45">
              {channel.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
