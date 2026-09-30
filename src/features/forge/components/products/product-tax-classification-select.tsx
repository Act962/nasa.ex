"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTaxClassifications } from "@/features/accounting/hooks/use-accounting-pricing";
import { FiscalTermHint } from "@/features/accounting/components/shared/fiscal-term-hint";

const NO_CLASSIFICATION = "NONE";

interface ProductTaxClassificationSelectProps {
  value: string | null;
  onChange: (classificationId: string | null) => void;
}

/**
 * Classificação tributária do produto (aba Contábil, spec 0051). Quem não
 * acessa o financeiro recebe FORBIDDEN: o campo some e o formulário segue igual.
 */
export function ProductTaxClassificationSelect({ value, onChange }: ProductTaxClassificationSelectProps) {
  const classificationsQuery = useTaxClassifications({ silent: true });
  if (!classificationsQuery.data) return null;
  const classifications = classificationsQuery.data.classifications;

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1">
        Classificação tributária <FiscalTermHint termId="cclasstrib" />
      </Label>
      {classifications.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Nenhuma classificação criada. Crie em Financeiro › Contábil › Produtos & Preços para ver o imposto deste item.
        </p>
      ) : (
        <Select
          value={value ?? NO_CLASSIFICATION}
          onValueChange={(selected) => onChange(selected === NO_CLASSIFICATION ? null : selected)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CLASSIFICATION}>Sem classificação</SelectItem>
            {classifications.map((classification) => (
              <SelectItem key={classification.id} value={classification.id}>
                {classification.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
