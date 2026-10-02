"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAccountingProfile } from "@/features/accounting/hooks/use-accounting-profile";
import { REFORM_TIMELINE } from "@/features/accounting/lib/tax/reforma/reform-timeline";
import { OFFICIAL_LINKS } from "@/features/accounting/lib/glossary/terms";
import { REGIME_LABELS, type TaxRegimeDisplay } from "@/features/accounting/lib/profile/tax-display";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import { ReformSimulator } from "./reform-simulator";

const TIMELINE_TERM_IDS: Record<number, string[]> = {
  2026: ["cbs", "ibs", "cclasstrib"],
  2027: ["cbs", "is", "simples-por-fora"],
  2029: ["ibs", "icms", "iss"],
  2033: ["ibs", "split-payment"],
};

const ADAPTATION_CHECKLIST: Array<{ label: string; description: string; section?: string; termId?: string }> = [
  {
    label: "Classificar produtos e serviços (NCM/NBS + cClassTrib)",
    description: "Cada item precisa do código que define a alíquota e as reduções na nota nova.",
    section: "pricing",
    termId: "cclasstrib",
  },
  {
    label: "Cadastrar o regime dos fornecedores",
    description: "Comprar de quem está no Lucro Presumido/Real gera crédito cheio; do Simples, crédito menor.",
    section: "credits",
    termId: "credito-nao-cumulativo",
  },
  {
    label: "Anexar o XML das notas de compra",
    description: "É o XML que prova o crédito de IBS/CBS que abate o seu imposto.",
    section: "credits",
  },
  {
    label: "Confirmar o layout novo com a emissora de notas",
    description: "Pergunte ao seu sistema emissor se NF-e/NFS-e já saem com os campos de IBS, CBS e cClassTrib.",
  },
  {
    label: "Revisar os preços para 2027",
    description: "Com a CBS cheia em 2027, simule o preço de venda na calculadora.",
    section: "calculator",
  },
];

const REFORM_LINKS = [OFFICIAL_LINKS.lc214, OFFICIAL_LINKS.ec132, OFFICIAL_LINKS.reformaFazenda, OFFICIAL_LINKS.nfePortal, OFFICIAL_LINKS.nfseNacional];

/** Reforma Tributária: linha do tempo, simulação por ano, checklist e fontes oficiais. */
export function ReformSection({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const profileQuery = useAccountingProfile();
  const currentRegime: TaxRegimeDisplay | null = profileQuery.data?.regime ?? null;
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Entre 2026 e 2033 cinco tributos (PIS, COFINS, IPI, ICMS e ISS) dão lugar a três: <strong className="text-foreground">CBS</strong>{" "}
        <FiscalTermHint termId="cbs" />, <strong className="text-foreground">IBS</strong> <FiscalTermHint termId="ibs" /> e o{" "}
        <strong className="text-foreground">Imposto Seletivo</strong> <FiscalTermHint termId="is" />. Veja o que muda em cada ano e o que fazer.
      </p>

      <Card className="gap-4">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm">Linha do tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="relative space-y-6 border-l pl-5">
            {REFORM_TIMELINE.map((milestone) => {
              const isCurrentYear = milestone.year === currentYear;
              const regimeActions = currentRegime ? milestone.actionsByRegime[currentRegime] ?? [] : [];
              const generalActions = milestone.actionsByRegime.TODOS ?? [];
              return (
                <li key={milestone.year} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[27px] top-1 size-3 rounded-full border-2 border-background",
                      isCurrentYear ? "bg-info ring-2 ring-info/30" : "bg-muted-foreground/40",
                    )}
                    aria-hidden
                  />
                  <div className="space-y-2">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold tabular-nums">{milestone.year}</span>
                      <span className="font-semibold">{milestone.title}</span>
                      {isCurrentYear && <Badge className="bg-info text-white">você está aqui</Badge>}
                      {(TIMELINE_TERM_IDS[milestone.year] ?? []).map((termId) => (
                        <FiscalTermHint key={termId} termId={termId} withLabel className="text-xs" />
                      ))}
                    </p>
                    <p className="text-sm text-muted-foreground">{milestone.summary}</p>
                    <ul className="list-disc space-y-0.5 pl-4 text-sm">
                      {milestone.changes.map((change) => (
                        <li key={change}>{change}</li>
                      ))}
                    </ul>
                    {(regimeActions.length > 0 || generalActions.length > 0) && (
                      <div className="space-y-1 rounded-md bg-muted/50 px-3 py-2 text-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">O que fazer</p>
                        <ul className="space-y-1">
                          {regimeActions.map((action) => (
                            <li key={action} className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className="border-info/40 text-info dark:text-info">
                                {currentRegime ? REGIME_LABELS[currentRegime] : ""}
                              </Badge>
                              {action}
                            </li>
                          ))}
                          {generalActions.map((action) => (
                            <li key={action}>• {action}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground">{milestone.legalSource}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      <ReformSimulator />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-4">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm">Checklist de adequação</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {ADAPTATION_CHECKLIST.map((item) => (
                <li key={item.label} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0 space-y-0.5">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      {item.label}
                      {item.termId && <FiscalTermHint termId={item.termId} />}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  {item.section && (
                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => onNavigate?.(item.section ?? "overview")}>
                      Abrir
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="gap-4">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm">Links oficiais</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {REFORM_LINKS.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-info hover:underline"
                  >
                    <ExternalLink className="size-3.5 shrink-0" />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

