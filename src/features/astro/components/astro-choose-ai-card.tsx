"use client";

import Link from "next/link";
import { Orbit, Sparkles } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSetAstroAiMode } from "@/features/astro/hooks/use-astro-ai-mode";
import type { AstroChooseAiPayload } from "@/features/astro/lib/astro-choose-ai";

/** Pedido aberto sem IA escolhida: conectar a IA da empresa ou usar o modelo ÓRBITA (spec 0053, RF-4). */
export function AstroChooseAiCard({
  payload,
  onRespond,
  busy,
}: {
  payload: AstroChooseAiPayload;
  onRespond?: (text: string) => void;
  busy?: boolean;
}) {
  const setAstroAiMode = useSetAstroAiMode();

  const choosePlatformModel = () => {
    setAstroAiMode.mutate(
      { mode: "PLATFORM" },
      {
        onSuccess: () => {
          if (payload.retryText) onRespond?.(payload.retryText);
        },
        onError: () => toast.error("Não consegui salvar a escolha. Tente de novo."),
      },
    );
  };

  return (
    <div className="rounded-[20px] bg-card p-3">
      <div className="flex items-start gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-info/15 text-info">
          <Orbit className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Dê inteligência ao ASTRO</p>
          <p className="text-xs text-muted-foreground">
            Conecte a IA da sua empresa como o primeiro satélite dele, ou use o nosso modelo agora.
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        <Button asChild className="w-full">
          <Link href="/integrations?connect=OPENAI">
            <Orbit className="size-4" />
            Conectar minha IA
          </Link>
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          disabled={busy || setAstroAiMode.isPending}
          onClick={choosePlatformModel}
        >
          {setAstroAiMode.isPending ? <OrbitaSpinner className="size-4 " /> : <Sparkles className="size-4" />}
          Usar modelo ÓRBITA ({payload.platformModelLabel})
        </Button>
      </div>
    </div>
  );
}
