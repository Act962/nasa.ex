"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PolicyHit } from "@/features/trafego/lib/ad-policies/types";

/** O que veio do banco é Json — só renderiza o que tem a forma esperada. */
function parseIssues(raw: unknown): PolicyHit[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is PolicyHit =>
      Boolean(item) && typeof item === "object" && typeof (item as PolicyHit).label === "string",
  );
}

/**
 * Selo de política na copy. O texto reprovado não é bloqueado aqui — a equipe
 * ainda revisa —, mas o cliente precisa saber antes de esperar uma semana pela
 * reprovação da plataforma.
 */
export function CopyComplianceBadge({
  level,
  issues,
}: {
  level: string | null;
  issues: unknown;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const hits = parseIssues(issues);

  if (!level || level === "OK") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
        <ShieldCheck className="size-3" />
        Dentro das regras
      </span>
    );
  }

  const isBlocked = level === "BLOCKED";

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "inline-flex items-center gap-1 text-[11px] font-medium",
          isBlocked
            ? "text-destructive"
            : "text-warning",
        )}
      >
        {isBlocked ? <ShieldAlert className="size-3" /> : <AlertTriangle className="size-3" />}
        {isBlocked ? "Não pode ser veiculada" : "Atenção às regras"}
        {hits.length > 0 && ` · ${hits.length}`}
      </button>

      {isOpen && hits.length > 0 && (
        <ul
          className={cn(
            "mt-2 space-y-2 rounded-[18px] border p-3",
            isBlocked
              ? "border-destructive/30 bg-destructive/15"
              : "border-warning/30 bg-warning/15",
          )}
        >
          {hits.map((hit) => (
            <li key={`${hit.ruleId}-${hit.excerpt}`} className="text-[11px] leading-relaxed">
              <p className="font-semibold">{hit.label}</p>
              <p className="mt-0.5 text-muted-foreground">{hit.reason}</p>
              <p className="mt-0.5">
                <span className="text-muted-foreground">Como resolver: </span>
                {hit.fix}
              </p>
              {hit.sourceUrl && (
                <a
                  href={hit.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 font-medium hover:underline"
                >
                  Ver a política oficial
                  <ExternalLink className="size-2.5" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
