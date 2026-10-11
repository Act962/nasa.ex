"use client";

import Link from "next/link";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { Button } from "@/components/ui/button";
import { useAiResourcesOverview } from "@/features/ia/hooks/use-ai-resources";

// Aviso na Início para quem ainda está na IA básica da plataforma (spec 0093, RF-14). Só aparece para
// dono e admin (a consulta recusa os demais) e some quando a empresa cadastra uma chave ou dispensa.

const isAiKeyBannerDismissedAtom = atomWithStorage("orbita.ai-key-banner.dismissed", false);

export function AiKeyBanner() {
  const [isDismissed, setIsDismissed] = useAtom(isAiKeyBannerDismissedAtom);
  const { data: overview } = useAiResourcesOverview({ enabled: !isDismissed });
  if (isDismissed || !overview) return null;

  const hasOwnKey = overview.keys.company.length + overview.keys.funnels.length > 0 || overview.keys.hasPlannerKey;
  if (hasOwnKey) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
      <p className="min-w-56 flex-1 text-muted-foreground">
        <span className="font-semibold text-foreground">Sua empresa está usando a IA básica da plataforma.</span> Com a sua chave você escolhe modelos melhores e paga o provedor direto. Leva 2
        minutos.
      </p>
      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setIsDismissed(true)}>
        Agora não
      </Button>
      <Button asChild size="sm" className="rounded-full">
        <Link href="/integrations#ia-da-empresa">Cadastrar minha chave</Link>
      </Button>
    </div>
  );
}
