"use client";

import { AlertTriangle, Check, Lightbulb, Loader2, RefreshCw, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useRegenerateTrafegoRecommendations,
  useTrafegoRecommendations,
} from "@/features/trafego/hooks/use-trafego-recommendations";

/** Verde quando está bem, âmbar quando merece atenção. */
const LEVEL_TONE: Record<string, string> = {
  below_minimum: "border-amber-500/30 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300",
  tight: "border-amber-500/30 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300",
  needs_setup: "border-amber-500/30 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300",
};

function toneFor(level: string): string {
  return LEVEL_TONE[level] ?? "border-border bg-muted/40 text-muted-foreground";
}

/**
 * O primeiro card do painel. O cliente acabou de pagar e não sabe o que fazer
 * — aqui ele lê, em ordem, o que depende dele e o que a plataforma recomenda
 * para a verba e o objetivo que ele escolheu.
 */
export function NextStepsCard({ orderId }: { orderId: string }) {
  const { data: recommendations, isLoading } = useTrafegoRecommendations(orderId);
  const regenerate = useRegenerateTrafegoRecommendations();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Montando suas recomendações…
      </div>
    );
  }
  if (!recommendations) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="size-4 text-violet-500" />
            Seus próximos passos
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            O que fazer agora, na ordem, para a campanha entrar no ar.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => regenerate.mutate({ orderId })}
          disabled={regenerate.isPending}
        >
          <RefreshCw className={cn("size-3.5", regenerate.isPending && "animate-spin")} />
          Atualizar
        </Button>
      </header>

      <ol className="mt-4 space-y-2">
        {recommendations.nextSteps.map((step, index) => (
          <li key={step} className="flex gap-2.5 text-sm">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-[11px] font-semibold text-violet-600 dark:text-violet-300">
              {index + 1}
            </span>
            <span className="text-foreground/90">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Advice
          icon={<Video className="size-4" />}
          title={`Criativo: ${recommendations.creativeFormat.label}`}
          text={recommendations.creativeFormat.text}
          tone={toneFor("ok")}
        />
        <Advice
          icon={
            recommendations.budget.level === "comfortable" ? (
              <Check className="size-4" />
            ) : (
              <AlertTriangle className="size-4" />
            )
          }
          title={`Verba: ${recommendations.budget.dailyLabel}`}
          text={recommendations.budget.text}
          tone={toneFor(recommendations.budget.level)}
        />
      </div>

      {recommendations.destination.text && (
        <p
          className={cn(
            "mt-3 rounded-lg border p-3 text-xs leading-relaxed",
            toneFor(recommendations.destination.level),
          )}
        >
          {recommendations.destination.text}
        </p>
      )}

      {recommendations.copyAngle && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Ângulo de texto sugerido: </span>
          {recommendations.copyAngle}
        </p>
      )}
    </section>
  );
}

function Advice({
  icon,
  title,
  text,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  tone: string;
}) {
  return (
    <div className={cn("rounded-lg border p-3.5", tone)}>
      <p className="flex items-center gap-2 text-xs font-semibold">
        {icon}
        {title}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed opacity-90">{text}</p>
    </div>
  );
}
