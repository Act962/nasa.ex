"use client";

import { Info, ExternalLink, Sparkles, TriangleAlert } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { openAstroWidget } from "@/features/astro/lib/open-astro-widget";
import { findGlossaryTerm } from "@/features/accounting/lib/glossary/terms";

interface FiscalTermHintProps {
  termId: string;
  className?: string;
  /** Mostra o rótulo do termo ao lado do ícone. */
  withLabel?: boolean;
}

/**
 * Ícone ⓘ ao lado de todo nome técnico da aba Contábil. O conteúdo vem do
 * glossário (fonte única), e "Perguntar ao ASTRO" abre o assistente já com a
 * pergunta pronta.
 */
export function FiscalTermHint({ termId, className, withLabel = false }: FiscalTermHintProps) {
  const glossaryTerm = findGlossaryTerm(termId);
  if (!glossaryTerm) return null;

  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`O que é ${glossaryTerm.label}?`}
          className={cn(
            "inline-flex items-center gap-1 align-middle text-muted-foreground transition-colors hover:text-info focus-visible:text-info focus-visible:outline-none",
            className,
          )}
        >
          {withLabel && <span className="underline decoration-dotted underline-offset-2">{glossaryTerm.label}</span>}
          <Info className="size-3.5 shrink-0" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80 space-y-2.5 text-sm">
        <p className="font-semibold">{glossaryTerm.label}</p>
        <p className="text-muted-foreground leading-relaxed">{glossaryTerm.plainExplanation}</p>
        {glossaryTerm.example && (
          <p className="rounded-md bg-muted/60 px-2.5 py-2 text-xs leading-relaxed">
            <span className="font-medium">Exemplo: </span>
            {glossaryTerm.example}
          </p>
        )}
        {glossaryTerm.legalBasis && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Base legal: </span>
            {glossaryTerm.legalBasis}
          </p>
        )}
        {glossaryTerm.links.length > 0 && (
          <ul className="space-y-1">
            {glossaryTerm.links.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-info hover:underline"
                >
                  <ExternalLink className="size-3" />
                  {link.label}
                  {link.needsVerification && (
                    <TriangleAlert className="size-3 text-warning" aria-label="Link a confirmar" />
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="w-full gap-1.5"
          onClick={() => openAstroWidget(glossaryTerm.astroPrompt)}
        >
          <Sparkles className="size-3.5" />
          Perguntar ao ASTRO
        </Button>
      </HoverCardContent>
    </HoverCard>
  );
}

/** Rótulo de campo com o ⓘ ao lado — atalho para formulários da aba. */
export function TermLabel({ children, termId, className }: { children: React.ReactNode; termId?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {children}
      {termId && <FiscalTermHint termId={termId} />}
    </span>
  );
}
