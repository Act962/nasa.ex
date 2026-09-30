"use client";

import { Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FiscalTermHint } from "../shared/fiscal-term-hint";

/** Explicação do topo da subaba Produtos & Preços. */
export function PricingIntro() {
  return (
    <Card className="border-violet-500/30 bg-violet-500/5">
      <CardContent className="space-y-3 py-5 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <Lightbulb className="size-4 text-violet-600" />
          Preço bom é o que sobra depois do imposto
        </p>
        <p className="text-muted-foreground">
          Toda venda carrega imposto. A <strong>alíquota efetiva</strong> <FiscalTermHint termId="aliquota-efetiva" /> é
          quanto de cada R$ 100 vendidos vai para o governo no seu regime. Para não pagar o imposto do próprio bolso,
          ele entra no preço pelo <strong>markup divisor</strong> <FiscalTermHint termId="markup-divisor" /> (use a
          calculadora).
        </p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            Classifique cada produto com <strong>NCM</strong> <FiscalTermHint termId="ncm" /> e cada serviço com{" "}
            <strong>NBS</strong> <FiscalTermHint termId="nbs" /> ou o <strong>item da LC 116</strong>{" "}
            <FiscalTermHint termId="lc116-item" />.
          </li>
          <li>
            O <strong>cClassTrib</strong> <FiscalTermHint termId="cclasstrib" /> diz se o item tem redução de CBS/IBS
            (30%, 60% ou 100%) — isso muda o preço a partir de 2027.
          </li>
          <li>Propostas sem imposto ou com alíquota antiga aparecem abaixo para você revisar.</li>
        </ul>
      </CardContent>
    </Card>
  );
}
