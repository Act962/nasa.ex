"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CalculatorPanel } from "./calculator-panel";

// Calculadora sugerida para cada seção da aba (documentos abre a lista).
const SUGGESTED_CALCULATOR_BY_SECTION: Record<string, string> = {
  overview: "das_simples",
  assessments: "das_simples",
  pricing: "markup",
  credits: "cbs_ibs",
  reform: "cbs_ibs",
  calendar: "guia_atraso",
  profile: "comparativo_regimes",
  reports: "depreciacao",
  chart: "depreciacao",
};

/** Botão flutuante que abre a calculadora num painel lateral, em qualquer seção. */
export function CalculatorFab({ contextSection }: { contextSection: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Mesmo formato de URL da aba Contábil (`?tab=accounting&sub=`).
  const navigateTo = useCallback(
    (section: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "accounting");
      if (section === "overview") params.delete("sub");
      else params.set("sub", section);
      setIsOpen(false);
      router.replace(`/payment?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            aria-label="Calculadora contábil"
            onClick={() => setIsOpen(true)}
            className="fixed bottom-24 right-4 z-40 size-12 rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700 sm:bottom-6 sm:right-24"
          >
            <Calculator className="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Calculadora contábil</TooltipContent>
      </Tooltip>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Calculator className="size-4 text-violet-600" />
              Calculadora contábil
            </SheetTitle>
            <SheetDescription>Contas de imposto, preço e folha com os dados da sua empresa.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <CalculatorPanel
              key={contextSection}
              initialCalculatorId={SUGGESTED_CALCULATOR_BY_SECTION[contextSection] ?? null}
              onNavigate={navigateTo}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
