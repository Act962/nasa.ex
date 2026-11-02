"use client";

import { AlertTriangle, CheckCircle2, ExternalLink, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CREATIVE_REVIEW_GROUP_LABEL,
  CREATIVE_REVIEW_VERDICT_LABEL,
  type CreativeReview,
  type CreativeReviewGroup,
  type CreativeReviewItem,
} from "@/features/trafego/lib/creative-review";

/** Resultado da análise do Astro: nota, veredito e o que corrigir por grupo (spec 0126, RF-11). */

const GROUP_ORDER: CreativeReviewGroup[] = ["policy", "technical", "strength"];

const VERDICT_STYLE: Record<CreativeReview["verdict"], string> = {
  ready: "bg-success/15 text-success",
  improve: "bg-warning/15 text-warning",
  risk: "bg-destructive/15 text-destructive",
};

function ItemIcon({ level }: { level: CreativeReviewItem["level"] }) {
  if (level === "BLOCKED") return <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />;
  if (level === "WARNING") return <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />;
  return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />;
}

export function CreativeReviewResult({ review, className }: { review: CreativeReview; className?: string }) {
  return (
    <div className={cn("rounded-[20px] border bg-card p-4", className)}>
      <div className="flex items-center gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-full bg-muted text-lg font-bold tabular-nums">
          {review.score}
        </div>
        <div className="min-w-0">
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", VERDICT_STYLE[review.verdict])}>
            {CREATIVE_REVIEW_VERDICT_LABEL[review.verdict]}
          </span>
          <p className="mt-1 text-sm text-muted-foreground">{review.summary}</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {GROUP_ORDER.map((group) => {
          const items = review.items.filter((item) => item.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <p className="text-xs font-semibold text-muted-foreground">{CREATIVE_REVIEW_GROUP_LABEL[group]}</p>
              <ul className="mt-1.5 space-y-2">
                {items.map((item, index) => (
                  <li key={`${item.label}-${index}`} className="flex gap-2 text-sm">
                    <ItemIcon level={item.level} />
                    <div className="min-w-0">
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.fix}</p>
                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Regra da Meta <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="mt-4 flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Info className="mt-px size-3 shrink-0" />
        Orientação do Astro com base nas regras públicas da Meta. Não garante a aprovação do anúncio.
      </p>
    </div>
  );
}
