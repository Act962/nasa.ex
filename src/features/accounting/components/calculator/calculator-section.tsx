"use client";

import { useState } from "react";
import { Calculator, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OFFICIAL_LINKS } from "@/features/accounting/lib/glossary/terms";
import { CalculatorPanel } from "./calculator-panel";
import { TaxRatesDialog } from "./tax-rates-dialog";

function formatVerifiedDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** Seção "Calculadora" da aba Contábil. */
export function CalculatorSection({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const [isRatesDialogOpen, setIsRatesDialogOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-info/5 p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info dark:text-info">
            <Calculator className="size-5" />
          </div>
          <div className="space-y-1.5 text-sm">
            <p className="font-semibold">Calculadora contábil</p>
            <p className="text-muted-foreground">
              Faça as contas de imposto, preço, folha e juros sem planilha. Os campos já vêm preenchidos com os dados da
              sua empresa, e cada resultado mostra o passo a passo e de onde saiu cada número.
            </p>
            <p className="text-xs text-muted-foreground">
              As tabelas seguem a legislação vigente (conferidas em {formatVerifiedDate(OFFICIAL_LINKS.lc123.lastVerifiedAt)}).
              Itens marcados “a confirmar” usam estimativas até a regulamentação oficial sair.
            </p>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto gap-1.5 px-0 text-info"
              onClick={() => setIsRatesDialogOpen(true)}
            >
              <Table2 className="size-3.5" />
              Ver tabelas de alíquotas
            </Button>
          </div>
        </div>
      </div>

      <CalculatorPanel onNavigate={onNavigate} />

      <TaxRatesDialog open={isRatesDialogOpen} onOpenChange={setIsRatesDialogOpen} />
    </div>
  );
}
