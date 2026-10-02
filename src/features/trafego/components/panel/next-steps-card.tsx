"use client";

import {
  AlertTriangle,
  Check,
  Lightbulb,
  RefreshCw,
  Video,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useRegenerateTrafegoRecommendations,
  useTrafegoRecommendations,
} from "@/features/trafego/hooks/use-trafego-recommendations";
import { TechnicalTerm, type TechnicalTermKey } from "../technical-term";

const ATTENTION_TONE = "border-warning/30 bg-warning/15 text-warning";

/** Neutro quando está bem, aviso quando merece atenção. */
const LEVEL_TONE: Record<string, string> = {
  below_minimum: ATTENTION_TONE,
  tight: ATTENTION_TONE,
  needs_setup: ATTENTION_TONE,
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
  const { data: recommendations, isLoading } =
    useTrafegoRecommendations(orderId);
  const regenerate = useRegenerateTrafegoRecommendations();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-[20px] border border-border bg-card p-5 text-sm text-muted-foreground">
        <OrbitaSpinner className="size-4" />
        Montando suas recomendações…
      </div>
    );
  }
  if (!recommendations) return null;

  return (
    <section className="rounded-[20px] border border-border bg-card p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="size-4 text-info" />
            Seus próximos passos
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            O que fazer agora, na ordem, para a campanha entrar no ar.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => regenerate.mutate({ orderId })}
          disabled={regenerate.isPending}
          aria-label="Atualizar recomendações"
          className="size-9 shrink-0 rounded-full bg-knob p-0 sm:h-9 sm:w-auto sm:bg-transparent sm:px-3"
        >
          {regenerate.isPending ? (
            <OrbitaSpinner className="size-3.5" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          <span className="max-sm:sr-only">Atualizar</span>
        </Button>
      </header>

      <ol className="mt-4 space-y-2">
        {recommendations.nextSteps.map((step, index) => (
          <li key={step} className="flex gap-2.5 text-sm">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-info/15 text-[11px] font-semibold text-info">
              {index + 1}
            </span>
            <span className="text-foreground/90">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Advice
          icon={<Video className="size-4" />}
          title={`Imagem ou vídeo: ${recommendations.creativeFormat.label}`}
          term="creative"
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
          term="adBudget"
          text={recommendations.budget.text}
          tone={toneFor(recommendations.budget.level)}
        />
      </div>

      {recommendations.destination.text && (
        <p
          className={cn(
            "mt-3 rounded-[18px] border p-3 text-xs leading-relaxed",
            toneFor(recommendations.destination.level),
          )}
        >
          {recommendations.destination.text}
        </p>
      )}

      {recommendations.copyAngle && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">
            Ideia para o texto do anúncio
            <TechnicalTerm term="copy" />:{" "}
          </span>
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
  term,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  tone: string;
  term?: TechnicalTermKey;
}) {
  return (
    <div className={cn("rounded-[18px] border p-3.5", tone)}>
      <p className="flex items-center gap-2 text-xs font-semibold">
        {icon}
        {title}
        {term && <TechnicalTerm term={term} />}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed opacity-90">{text}</p>
    </div>
  );
}
