import { Calculator, ChevronDown } from "lucide-react";
import {
  FormBlockInstance,
  FormBlockType,
  FormCategoryType,
  ObjectBlockType,
} from "@/features/form/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { usePrefillValue } from "@/features/form/context/form-prefill-context";
import { CALCULATION_BLOCK_TYPE, type CalculationOperation } from "@/features/form-records/lib/calculation";
import { ITEM_LIST_BLOCK_TYPE } from "@/features/form-records/lib/item-list-value";
import { CURRENCY_UNIT_ID, MEASURE_UNITS } from "@/features/form-records/lib/measure-units";
import { NUMBER_MEASURE_BLOCK_TYPE } from "@/features/form-records/lib/number-measure-value";

// Bloco "Cálculo" (spec 0075, RF-3): mostra o resultado de uma conta sobre
// outros campos. Quem calcula é o servidor, ao salvar; aqui é só leitura.

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "Calculation";

const OPERATION_LABELS: Record<CalculationOperation, string> = {
  SUM: "Somar",
  SUBTRACT: "Subtrair (primeiro menos os demais)",
  MULTIPLY: "Multiplicar",
  DIVIDE: "Dividir (primeiro pelos demais)",
};

const NUMERIC_SOURCE_TYPES: ReadonlySet<string> = new Set([
  NUMBER_MEASURE_BLOCK_TYPE,
  ITEM_LIST_BLOCK_TYPE,
  CALCULATION_BLOCK_TYPE,
  "Slider",
]);

type AttributesType = {
  label: string;
  helperText: string;
  operation: CalculationOperation;
  sourceBlockIds: string[];
  resultUnit: string;
};

type Instance = FormBlockInstance & { attributes: AttributesType };

export const CalculationBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id) => ({
    id,
    blockType,
    attributes: {
      label: "Total",
      helperText: "",
      operation: "SUM",
      sourceBlockIds: [],
      resultUnit: CURRENCY_UNIT_ID,
    } satisfies AttributesType,
  }),
  blockBtnElement: { icon: Calculator, label: "Cálculo" },
  canvasComponent: CanvasView,
  formComponent: FormView,
  propertiesComponent: PropertiesView,
};

function ResultBox({ label, helperText, result }: { label: string; helperText: string; result: string }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
        <span className="min-w-0 break-words text-base">{label?.trim() || "Resultado"}</span>
        <span className="shrink-0 text-base font-semibold tabular-nums">{result}</span>
      </div>
      {helperText && <p className="whitespace-normal break-words text-[0.8rem] text-muted-foreground">{helperText}</p>}
    </div>
  );
}

function CanvasView({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const { label, helperText, sourceBlockIds } = (blockInstance as Instance).attributes;
  return (
    <ResultBox
      label={label}
      helperText={helperText}
      result={sourceBlockIds.length === 0 ? "escolha os campos" : "calculado ao salvar"}
    />
  );
}

function FormView({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const { label, helperText } = (blockInstance as Instance).attributes;
  const savedResult = usePrefillValue(blockInstance.id);
  return <ResultBox label={label} helperText={helperText} result={savedResult?.trim() || "calculado ao salvar"} />;
}

function PropertiesView({
  positionIndex,
  parentId,
  blockInstance,
}: {
  positionIndex?: number;
  parentId?: string;
  blockInstance: FormBlockInstance;
}) {
  const block = blockInstance as Instance;
  const { updateChildBlock, blockLayouts } = useBuilderStore();
  const attributes = block.attributes;

  const commit = (partial: Partial<AttributesType>) => {
    if (!parentId) return;
    updateChildBlock(parentId, block.id, { ...block, attributes: { ...attributes, ...partial } });
  };

  // Só campos que vêm ANTES deste: o servidor calcula na ordem do formulário.
  const allFields = blockLayouts.flatMap((layout) => layout.childblocks ?? []);
  const ownIndex = allFields.findIndex((field) => field.id === block.id);
  const sourceOptions = allFields
    .slice(0, ownIndex === -1 ? allFields.length : ownIndex)
    .filter((field) => NUMERIC_SOURCE_TYPES.has(field.blockType));

  const toggleSource = (sourceId: string, isSelected: boolean) =>
    commit({
      sourceBlockIds: isSelected
        ? [...attributes.sourceBlockIds, sourceId]
        : attributes.sourceBlockIds.filter((currentId) => currentId !== sourceId),
    });

  return (
    <div className="w-full pb-4">
      <div className="mb-[10px] flex h-auto w-full flex-row items-center justify-between gap-1 rounded-md bg-foreground/10 p-1 px-2">
        <span className="text-sm font-medium tracking-wider text-muted-foreground">Cálculo {positionIndex}</span>
        <ChevronDown className="h-4 w-4" />
      </div>
      <div className="w-full space-y-3 px-4">
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Título</Label>
          <Input value={attributes.label} onChange={(event) => commit({ label: event.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Conta</Label>
          <Select value={attributes.operation} onValueChange={(operation) => commit({ operation: operation as CalculationOperation })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(OPERATION_LABELS).map(([operation, operationLabel]) => (
                <SelectItem key={operation} value={operation}>
                  {operationLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[13px] font-normal">Campos usados na conta</Label>
          {sourceOptions.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              Coloque antes deste um campo de número com medida ou uma lista de itens.
            </p>
          )}
          {sourceOptions.map((field) => (
            <div key={field.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 break-words text-[13px]">{String(field.attributes?.label ?? "Campo sem título")}</span>
              <Switch
                aria-label={`Usar ${String(field.attributes?.label ?? "campo")} na conta`}
                checked={attributes.sourceBlockIds.includes(field.id)}
                onCheckedChange={(isSelected) => toggleSource(field.id, isSelected)}
              />
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Mostrar o resultado em</Label>
          <Select value={attributes.resultUnit || "none"} onValueChange={(unitId) => commit({ resultUnit: unitId === "none" ? "" : unitId })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Número puro</SelectItem>
              {MEASURE_UNITS.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.label} ({unit.symbol})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Nota</Label>
          <Input value={attributes.helperText} onChange={(event) => commit({ helperText: event.target.value })} />
        </div>
      </div>
    </div>
  );
}
