"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBps, formatCentsBrl } from "@/features/accounting/lib/format";
import { FiscalTermHint } from "../shared/fiscal-term-hint";

export interface ProposalTaxRow {
  id: string;
  number: number;
  title: string;
  status: string;
  createdAt: Date;
  totalCents: number;
  usedRateBps: number | null;
  effectiveRateBps: number;
  isMissingTax: boolean;
  isRateDifferent: boolean;
}

const VISIBLE_ROWS_DEFAULT = 10;

/** Propostas dos últimos 12 meses sem imposto ou com alíquota diferente da efetiva. */
export function ProposalsTaxReview({ proposals }: { proposals: ProposalTaxRow[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const problematicProposals = proposals.filter((proposal) => proposal.isMissingTax || proposal.isRateDifferent);
  const visibleProposals = isExpanded ? problematicProposals : problematicProposals.slice(0, VISIBLE_ROWS_DEFAULT);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Propostas para revisar</CardTitle>
        <p className="text-sm text-muted-foreground">
          Propostas dos últimos 12 meses que saíram sem imposto no preço, ou com alíquota mais de 1 ponto diferente da
          sua alíquota efetiva <FiscalTermHint termId="aliquota-efetiva" /> de hoje.
        </p>
      </CardHeader>
      <CardContent>
        {proposals.length === 0 ? (
          <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            Nenhuma proposta nos últimos 12 meses. Quando gerar propostas pelo simulador do Forge, o imposto já vai com a
            alíquota do seu perfil fiscal.
          </p>
        ) : problematicProposals.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-success" />
            Todas as {proposals.length} propostas consideram imposto com a alíquota certa.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-3 text-left font-medium">Proposta</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-right font-medium">Alíquota usada</th>
                    <th className="px-3 py-2 text-right font-medium">Efetiva hoje</th>
                    <th className="py-2 pl-3 text-left font-medium">Problema</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibleProposals.map((proposal) => (
                    <tr key={proposal.id}>
                      <td className="py-2 pr-3">
                        <p className="font-medium">
                          #{proposal.number} · {proposal.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(proposal.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCentsBrl(proposal.totalCents)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {proposal.usedRateBps === null ? "—" : formatBps(proposal.usedRateBps)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatBps(proposal.effectiveRateBps)}</td>
                      <td className="py-2 pl-3">
                        {proposal.isMissingTax ? (
                          <Badge variant="outline" className="border-destructive/40 bg-destructive/10 font-normal text-destructive dark:text-destructive">
                            Sem imposto
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-warning/40 bg-warning/10 font-normal text-warning dark:text-warning">
                            Alíquota diferente da efetiva
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {problematicProposals.length > VISIBLE_ROWS_DEFAULT && (
              <Button size="sm" variant="ghost" onClick={() => setIsExpanded((current) => !current)}>
                {isExpanded ? "Mostrar menos" : `Ver todas (${problematicProposals.length})`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
