"use client";

import { Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FiscalTermHint } from "../shared/fiscal-term-hint";

/** Explicação do topo: o que é crédito e por que pedir nota de todo fornecedor. */
export function CreditsIntro({ isTestYear }: { isTestYear: boolean }) {
  return (
    <Card className="border-info/30 bg-info/5">
      <CardContent className="space-y-3 py-5 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <Lightbulb className="size-4 text-info" />
          Imposto que você paga na compra volta como desconto na venda
        </p>
        <p className="text-muted-foreground">
          Com a Reforma Tributária, a <strong>CBS</strong> <FiscalTermHint termId="cbs" /> e o <strong>IBS</strong>{" "}
          <FiscalTermHint termId="ibs" /> destacados na nota do seu fornecedor viram{" "}
          <strong>crédito</strong> <FiscalTermHint termId="credito-nao-cumulativo" />: você abate esse valor do imposto
          das suas vendas. O crédito só fica disponível depois que a compra é paga — e, com o{" "}
          <strong>split payment</strong> <FiscalTermHint termId="split-payment" />, o próprio pagamento já separa o
          imposto.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            <strong>Peça nota de todo fornecedor.</strong> Compra sem nota é crédito jogado fora.
          </li>
          <li>
            Fornecedor do <strong>Simples</strong> <FiscalTermHint termId="simples-nacional" /> ou{" "}
            <strong>MEI</strong> <FiscalTermHint termId="mei" /> costuma gerar crédito menor. Compare o preço dele com o
            crédito que você deixa de ganhar.
          </li>
          <li>Anexe o XML da nota no lançamento de Despesa: o crédito é registrado sozinho.</li>
        </ul>
        {isTestYear && (
          <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning dark:text-warning">
            2026 é o ano-teste: CBS (0,9%) e IBS (0,1%) aparecem nas notas, mas ninguém recolhe nem usa crédito de
            verdade ainda. Os números abaixo são informativos — servem para você organizar as notas antes de 2027,
            quando o crédito passa a valer dinheiro.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
